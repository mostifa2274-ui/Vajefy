import fs from "node:fs";
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

function readPlan(): FrontierPlan {
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--no-warnings",
      "--import",
      REGISTER,
      path.join(ROOT, "scripts", "frontier-repair.ts"),
      "--json",
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
