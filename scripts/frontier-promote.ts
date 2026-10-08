import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

type CurriculumEntry = {
  id: string;
  prerequisites: string[];
};

type CurriculumUnit = {
  id: string;
  targetEntries: number;
  entries: CurriculumEntry[];
  [key: string]: unknown;
};

export type FrontierCurriculum = {
  version: number;
  assignedMinimum?: number;
  calibrationSlice?: { unit: string; [key: string]: unknown };
  units: CurriculumUnit[];
  [key: string]: unknown;
};

export type FrontierPromotion = {
  dependencyId: string;
  beforeEntryId: string;
  targetUnit: string;
  changesFrozenPilotRoster: boolean;
};

type FrontierPlan = {
  promotions: FrontierPromotion[];
};

export type PilotSafePromotionResult = {
  curriculum: FrontierCurriculum;
  moved: string[];
  alreadySatisfied: string[];
  blocked: { dependencyId: string; reason: string }[];
};

const ROOT = process.cwd();
const CURRICULUM = path.join(ROOT, "content", "curriculum", "A1.json");
const REGISTER = path.join(ROOT, "scripts", "ts-test-register.mjs");

function cloneCurriculum(curriculum: FrontierCurriculum): FrontierCurriculum {
  return JSON.parse(JSON.stringify(curriculum)) as FrontierCurriculum;
}

function flattened(curriculum: FrontierCurriculum): CurriculumEntry[] {
  return curriculum.units.flatMap((unit) => unit.entries);
}

function indexState(curriculum: FrontierCurriculum) {
  const global = new Map<string, number>();
  const unit = new Map<string, number>();
  const within = new Map<string, number>();
  let offset = 0;
  curriculum.units.forEach((group, unitIndex) => {
    group.entries.forEach((entry, entryIndex) => {
      global.set(entry.id, offset + entryIndex);
      unit.set(entry.id, unitIndex);
      within.set(entry.id, entryIndex);
    });
    offset += group.entries.length;
  });
  return { global, unit, within };
}

function assertCurriculumIntegrity(
  before: FrontierCurriculum,
  after: FrontierCurriculum,
): void {
  const beforeIds = flattened(before).map((entry) => entry.id).sort();
  const afterIds = flattened(after).map((entry) => entry.id).sort();
  if (JSON.stringify(beforeIds) !== JSON.stringify(afterIds)) {
    throw new Error("pilot-safe promotion changed the curriculum entry set");
  }

  const beforePilot = before.units.slice(0, 3).map((unit) => unit.entries.map((entry) => entry.id));
  const afterPilot = after.units.slice(0, 3).map((unit) => unit.entries.map((entry) => entry.id));
  if (JSON.stringify(beforePilot) !== JSON.stringify(afterPilot)) {
    throw new Error("pilot-safe promotion changed the frozen Units 1-3 roster");
  }

  const beforeTargetTotal = before.units.reduce((sum, unit) => sum + unit.targetEntries, 0);
  const afterTargetTotal = after.units.reduce((sum, unit) => sum + unit.targetEntries, 0);
  if (beforeTargetTotal !== afterTargetTotal) {
    throw new Error("pilot-safe promotion changed total targetEntries");
  }
  const beforeSpare = new Map(
    before.units.map((unit) => [unit.id, unit.targetEntries - unit.entries.length] as const),
  );
  for (const unit of after.units) {
    if ((beforeSpare.get(unit.id) ?? Number.NaN) !== unit.targetEntries - unit.entries.length) {
      throw new Error(unit.id + ": pilot-safe promotion changed planned spare capacity");
    }
  }

  const balancedWaveFloor = new Map<number, number>([
    [240, 20],
    [460, 40],
    [680, 60],
    [900, 80],
  ]).get(after.assignedMinimum ?? 0);
  if (balancedWaveFloor) {
    for (const unit of after.units) {
      const floor = unit.id === after.calibrationSlice?.unit ? 20 : balancedWaveFloor;
      if (unit.entries.length < floor) {
        throw new Error(unit.id + ": pilot-safe promotion broke balanced-wave floor " + floor);
      }
    }
  }

  const positions = indexState(after).global;
  for (const entry of flattened(after)) {
    const at = positions.get(entry.id);
    if (at === undefined) throw new Error("missing promoted entry " + entry.id);
    for (const prerequisite of entry.prerequisites) {
      const dependencyAt = positions.get(prerequisite);
      if (dependencyAt === undefined) {
        throw new Error(entry.id + ": unknown prerequisite " + prerequisite);
      }
      if (dependencyAt >= at) {
        throw new Error(
          entry.id + ": prerequisite " + prerequisite + " no longer appears earlier",
        );
      }
    }
  }

  for (const unit of after.units) {
    if (!Number.isInteger(unit.targetEntries) || unit.targetEntries < unit.entries.length) {
      throw new Error(
        unit.id + ": targetEntries " + unit.targetEntries + " is below assigned entries " + unit.entries.length,
      );
    }
  }
}

/**
 * Move only planner recommendations that cannot change Units 1-3 and whose
 * prerequisite closure is already before the requested anchor.
 *
 * The pass is iterative: moving one dependency earlier can make another move
 * legal, but a move is never allowed to leap over an unmet prerequisite.
 */
export function applyPilotSafePromotions(
  curriculum: FrontierCurriculum,
  promotions: readonly FrontierPromotion[],
): PilotSafePromotionResult {
  const next = cloneCurriculum(curriculum);
  const initial = indexState(next);
  const pending = new Map(
    promotions.map((promotion) => [promotion.dependencyId, promotion] as const),
  );
  if (pending.size !== promotions.length) {
    throw new Error("frontier promotion plan contains duplicate dependency ids");
  }
  for (const promotion of promotions) {
    const anchorUnitIndex = initial.unit.get(promotion.beforeEntryId);
    if (anchorUnitIndex === undefined) {
      throw new Error("frontier promotion anchor is missing: " + promotion.beforeEntryId);
    }
    const actualTargetUnit = next.units[anchorUnitIndex]?.id;
    if (actualTargetUnit !== promotion.targetUnit) {
      throw new Error(
        promotion.dependencyId +
          ": stale target unit " +
          promotion.targetUnit +
          "; anchor is now in " +
          actualTargetUnit,
      );
    }
  }
  const moved: string[] = [];
  const alreadySatisfied: string[] = [];

  let changed = true;
  while (changed) {
    changed = false;
    for (const [dependencyId, promotion] of [...pending]) {
      const state = indexState(next);
      const dependencyAt = state.global.get(dependencyId);
      const anchorAt = state.global.get(promotion.beforeEntryId);
      const dependencyUnit = state.unit.get(dependencyId);
      const targetUnit = state.unit.get(promotion.beforeEntryId);

      if (
        dependencyAt === undefined ||
        anchorAt === undefined ||
        dependencyUnit === undefined ||
        targetUnit === undefined
      ) {
        continue;
      }
      if (promotion.changesFrozenPilotRoster || targetUnit < 3) continue;

      if (dependencyAt < anchorAt) {
        alreadySatisfied.push(dependencyId);
        pending.delete(dependencyId);
        changed = true;
        continue;
      }

      const sourceUnit = next.units[dependencyUnit]!;
      const sourceIndex = sourceUnit.entries.findIndex((entry) => entry.id === dependencyId);
      if (sourceIndex < 0) continue;
      const entry = sourceUnit.entries[sourceIndex]!;

      const balancedWaveFloor = new Map<number, number>([
        [240, 20],
        [460, 40],
        [680, 60],
        [900, 80],
      ]).get(next.assignedMinimum ?? 0);
      const sourceFloor =
        balancedWaveFloor === undefined
          ? 0
          : sourceUnit.id === next.calibrationSlice?.unit
            ? 20
            : balancedWaveFloor;
      if (dependencyUnit !== targetUnit && sourceUnit.entries.length - 1 < sourceFloor) {
        continue;
      }

      const prerequisitesReady = entry.prerequisites.every((prerequisite) => {
        const at = state.global.get(prerequisite);
        return at !== undefined && at < anchorAt;
      });
      if (!prerequisitesReady) continue;

      const [removed] = sourceUnit.entries.splice(sourceIndex, 1);
      if (!removed) throw new Error("failed to remove " + dependencyId);

      const target = next.units[targetUnit]!;
      const anchorIndex = target.entries.findIndex((candidate) => candidate.id === promotion.beforeEntryId);
      if (anchorIndex < 0) throw new Error("missing target anchor " + promotion.beforeEntryId);
      target.entries.splice(anchorIndex, 0, removed);

      if (dependencyUnit !== targetUnit) {
        sourceUnit.targetEntries -= 1;
        target.targetEntries += 1;
      }

      moved.push(dependencyId);
      pending.delete(dependencyId);
      changed = true;
    }
  }

  const blocked = [...pending].map(([dependencyId, promotion]) => {
    const state = indexState(next);
    const anchorAt = state.global.get(promotion.beforeEntryId);
    const dependencyAt = state.global.get(dependencyId);
    const targetUnit = state.unit.get(promotion.beforeEntryId);
    if (dependencyAt === undefined) return { dependencyId, reason: "dependency-missing" };
    if (anchorAt === undefined) return { dependencyId, reason: "anchor-missing" };
    if (targetUnit === undefined) return { dependencyId, reason: "target-unit-missing" };
    if (promotion.changesFrozenPilotRoster || targetUnit < 3) {
      return { dependencyId, reason: "frozen-pilot-roster" };
    }

    const entry = flattened(next).find((candidate) => candidate.id === dependencyId);
    if (!entry) return { dependencyId, reason: "dependency-missing" };

    const dependencyUnit = state.unit.get(dependencyId);
    if (dependencyUnit !== undefined && dependencyUnit !== targetUnit) {
      const sourceUnit = next.units[dependencyUnit]!;
      const balancedWaveFloor = new Map<number, number>([
        [240, 20],
        [460, 40],
        [680, 60],
        [900, 80],
      ]).get(next.assignedMinimum ?? 0);
      const sourceFloor =
        balancedWaveFloor === undefined
          ? 0
          : sourceUnit.id === next.calibrationSlice?.unit
            ? 20
            : balancedWaveFloor;
      if (sourceUnit.entries.length - 1 < sourceFloor) {
        return { dependencyId, reason: "source-balanced-wave-floor:" + sourceFloor };
      }
    }

    const unmet = entry.prerequisites.filter((prerequisite) => {
      const at = state.global.get(prerequisite);
      return at === undefined || at >= anchorAt;
    });
    return {
      dependencyId,
      reason: unmet.length
        ? "unmet-prerequisites:" + unmet.join(",")
        : "not-movable",
    };
  });

  assertCurriculumIntegrity(curriculum, next);
  return {
    curriculum: next,
    moved,
    alreadySatisfied,
    blocked,
  };
}

export type FindingCounts = Record<string, number>;

const FRONTIER_CODES = ["FRONTIER_TASK_VOCABULARY", "FRONTIER_SCENE_VOCABULARY"] as const;

function frontierTotal(counts: FindingCounts): number {
  return FRONTIER_CODES.reduce((sum, code) => sum + (counts[code] ?? 0), 0);
}

/** A strict improvement: fewer frontier findings, and no finding code rises. */
export function improves(before: FindingCounts, after: FindingCounts): boolean {
  if (frontierTotal(after) >= frontierTotal(before)) return false;
  return Object.keys({ ...before, ...after }).every((code) => (after[code] ?? 0) <= (before[code] ?? 0));
}

export type MonotonicPromotionResult = {
  curriculum: FrontierCurriculum;
  accepted: { dependencyId: string; frontierBefore: number; frontierAfter: number }[];
  counts: FindingCounts;
  rounds: number;
};

/**
 * Apply pilot-safe promotions one at a time, keeping a move only when the
 * assurance report strictly improves, then plan again from the new order.
 *
 * Moving an entry earlier can also move a task that uses an untaught word
 * earlier, so a planned promotion can add findings: the first batch's
 * `spelling` move did. Each kept move lowers the frontier total, so the
 * process ends, and it never makes any finding code worse.
 */
export function applyMonotonicPromotions(
  curriculum: FrontierCurriculum,
  plan: (current: FrontierCurriculum) => readonly FrontierPromotion[],
  evaluate: (candidate: FrontierCurriculum) => FindingCounts,
): MonotonicPromotionResult {
  let current = cloneCurriculum(curriculum);
  let counts = evaluate(current);
  const accepted: MonotonicPromotionResult["accepted"] = [];
  let rounds = 0;
  for (;;) {
    rounds += 1;
    let kept = false;
    for (const promotion of plan(current)) {
      const step = applyPilotSafePromotions(current, [promotion]);
      if (!step.moved.length) continue;
      const next = evaluate(step.curriculum);
      if (!improves(counts, next)) continue;
      accepted.push({
        dependencyId: promotion.dependencyId,
        frontierBefore: frontierTotal(counts),
        frontierAfter: frontierTotal(next),
      });
      current = step.curriculum;
      counts = next;
      kept = true;
      // The plan was made for the previous order; make a new one.
      break;
    }
    if (!kept) break;
  }
  assertCurriculumIntegrity(curriculum, current);
  return { curriculum: current, accepted, counts, rounds };
}

function readCounts(curriculumFile: string): FindingCounts {
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--no-warnings",
      "--import",
      REGISTER,
      path.join(ROOT, "scripts", "content-assurance.ts"),
      "--json",
      "--curriculum",
      curriculumFile,
    ],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0 || !result.stdout) {
    process.stderr.write(result.stderr);
    throw new Error("content assurance failed");
  }
  return (JSON.parse(result.stdout) as { byCode: FindingCounts }).byCode;
}

function writeCurriculum(file: string, curriculum: FrontierCurriculum): void {
  fs.writeFileSync(file, JSON.stringify(curriculum, null, 2) + "\n");
}

/**
 * Candidates are written to a scratch copy that the planner and the
 * assurance report read through --curriculum. The canonical curriculum is
 * replaced once, at the end, by renaming a finished file over it, so an
 * interrupted search leaves it untouched.
 */
function monotonic(curriculum: FrontierCurriculum): void {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "vajefy-frontier-"));
  const candidateFile = path.join(scratch, "A1.json");
  try {
    const result = applyMonotonicPromotions(
      curriculum,
      (current) => {
        writeCurriculum(candidateFile, current);
        return readPlan(candidateFile).promotions;
      },
      (candidate) => {
        writeCurriculum(candidateFile, candidate);
        return readCounts(candidateFile);
      },
    );
    const finished = CURRICULUM + ".monotonic";
    writeCurriculum(finished, result.curriculum);
    fs.renameSync(finished, CURRICULUM);
    console.log(
      `Monotonic frontier promotion: ${result.accepted.length} move(s) kept in ${result.rounds} round(s); ` +
        `frontier findings ${result.accepted[0]?.frontierBefore ?? frontierTotal(result.counts)} -> ${frontierTotal(result.counts)}.`,
    );
    for (const move of result.accepted) {
      console.log(`- ${move.dependencyId}: ${move.frontierBefore} -> ${move.frontierAfter}`);
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

function readPlan(curriculumFile = CURRICULUM): FrontierPlan {
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--no-warnings",
      "--import",
      REGISTER,
      path.join(ROOT, "scripts", "frontier-repair.ts"),
      "--json",
      "--curriculum",
      curriculumFile,
    ],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0 || !result.stdout) {
    process.stderr.write(result.stderr);
    throw new Error("frontier repair planner failed");
  }
  return JSON.parse(result.stdout) as FrontierPlan;
}

function main(): void {
  const curriculum = JSON.parse(fs.readFileSync(CURRICULUM, "utf8")) as FrontierCurriculum;
  if (process.argv.includes("--monotonic")) {
    monotonic(curriculum);
    return;
  }
  const plan = readPlan();
  const result = applyPilotSafePromotions(curriculum, plan.promotions);

  if (process.argv.includes("--json")) {
    console.log(
      JSON.stringify(
        {
          moved: result.moved,
          alreadySatisfied: result.alreadySatisfied,
          blocked: result.blocked,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(
      "Pilot-safe frontier promotion: " +
        result.moved.length +
        " movable, " +
        result.alreadySatisfied.length +
        " already satisfied, " +
        result.blocked.length +
        " blocked.",
    );
    for (const item of result.blocked.slice(0, 20)) {
      console.log("- " + item.dependencyId + ": " + item.reason);
    }
  }

  if (process.argv.includes("--apply")) {
    fs.writeFileSync(CURRICULUM, JSON.stringify(result.curriculum, null, 2) + "\n");
    console.log("Updated content/curriculum/A1.json with pilot-safe frontier promotions.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
