import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type Curriculum = {
  units: { id: string; entries: { id: string }[] }[];
};

type FrontierDependency = {
  token: string;
  frontier: number;
  frontierEntryId?: string;
  dependencyId?: string;
  dependencyAt?: number;
};

type AssuranceFinding = {
  code: string;
  where: string;
  message: string;
  frontier?: FrontierDependency;
};

type AssuranceReport = {
  findings: number;
  byCode: Record<string, number>;
  details: AssuranceFinding[];
};

type Promotion = {
  dependencyId: string;
  tokens: string[];
  occurrences: number;
  taskOccurrences: number;
  sceneOccurrences: number;
  currentPosition: number;
  currentUnit: string;
  earliestRequiredPosition: number;
  beforeEntryId: string;
  targetUnit: string;
  positionsEarlier: number;
  changesFrozenPilotRoster: boolean;
};

type SupportRepair = {
  token: string;
  occurrences: number;
  taskOccurrences: number;
  sceneOccurrences: number;
};

type FrontierPlan = {
  schemaVersion: 1;
  frontierFindings: number;
  promotableFindings: number;
  supportOrRewordFindings: number;
  uniquePromotions: number;
  uniqueSupportRepairs: number;
  frozenPilotPromotions: number;
  promotions: Promotion[];
  supportOrReword: SupportRepair[];
};

const ROOT = process.cwd();
const curriculumAt = process.argv.indexOf("--curriculum");
// --curriculum plans for another curriculum order; content-assurance assesses the same file.
const curriculumFile =
  curriculumAt >= 0 && process.argv[curriculumAt + 1]
    ? path.resolve(process.argv[curriculumAt + 1]!)
    : path.join(ROOT, "content", "curriculum", "A1.json");
const curriculum = JSON.parse(fs.readFileSync(curriculumFile, "utf8")) as Curriculum;
const ordered = curriculum.units.flatMap((unit) => unit.entries.map((entry) => entry.id));
const position = new Map(ordered.map((id, index) => [id, index] as const));
const unitByEntry = new Map<string, { id: string; ordinal: number }>();
curriculum.units.forEach((unit, index) => {
  for (const entry of unit.entries) unitByEntry.set(entry.id, { id: unit.id, ordinal: index + 1 });
});

function assurance(): AssuranceReport {
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--no-warnings",
      "--import",
      "./scripts/ts-test-register.mjs",
      "scripts/content-assurance.ts",
      "--json",
      "--curriculum",
      curriculumFile,
    ],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.stderr.write(result.stdout);
    throw new Error(`content assurance failed with exit code ${result.status ?? "unknown"}`);
  }
  return JSON.parse(result.stdout) as AssuranceReport;
}

function buildPlan(report: AssuranceReport): FrontierPlan {
  const frontierFindings = report.details.filter(
    (finding) =>
      finding.code === "FRONTIER_TASK_VOCABULARY" ||
      finding.code === "FRONTIER_SCENE_VOCABULARY",
  );

  const malformed = frontierFindings.filter((finding) => {
    const meta = finding.frontier;
    if (!meta || !meta.token || !Number.isInteger(meta.frontier) || meta.frontier < 0) return true;
    if (meta.frontierEntryId !== ordered[meta.frontier]) return true;
    if (meta.dependencyId) {
      return (
        meta.dependencyAt === undefined ||
        position.get(meta.dependencyId) !== meta.dependencyAt ||
        meta.dependencyAt <= meta.frontier
      );
    }
    return meta.dependencyAt !== undefined;
  });
  if (malformed.length) {
    const sample = malformed
      .slice(0, 5)
      .map((finding) => `${finding.code} ${finding.where}: ${finding.message}`)
      .join("\n");
    throw new Error(
      `frontier findings are missing or contradict structured dependency metadata (${malformed.length})\n${sample}`,
    );
  }

  const promotionGroups = new Map<
    string,
    {
      tokens: Set<string>;
      occurrences: number;
      taskOccurrences: number;
      sceneOccurrences: number;
      earliest: FrontierDependency;
    }
  >();
  const supportGroups = new Map<
    string,
    { occurrences: number; taskOccurrences: number; sceneOccurrences: number }
  >();

  for (const finding of frontierFindings) {
    const meta = finding.frontier!;
    const task = finding.code === "FRONTIER_TASK_VOCABULARY";
    if (!meta.dependencyId) {
      const group = supportGroups.get(meta.token) ?? {
        occurrences: 0,
        taskOccurrences: 0,
        sceneOccurrences: 0,
      };
      group.occurrences += 1;
      if (task) group.taskOccurrences += 1;
      else group.sceneOccurrences += 1;
      supportGroups.set(meta.token, group);
      continue;
    }

    const group = promotionGroups.get(meta.dependencyId) ?? {
      tokens: new Set<string>(),
      occurrences: 0,
      taskOccurrences: 0,
      sceneOccurrences: 0,
      earliest: meta,
    };
    group.tokens.add(meta.token);
    group.occurrences += 1;
    if (task) group.taskOccurrences += 1;
    else group.sceneOccurrences += 1;
    if (meta.frontier < group.earliest.frontier) group.earliest = meta;
    promotionGroups.set(meta.dependencyId, group);
  }

  const promotions: Promotion[] = [...promotionGroups.entries()]
    .map(([dependencyId, group]) => {
      const currentPosition = position.get(dependencyId);
      const current = unitByEntry.get(dependencyId);
      const anchorId = group.earliest.frontierEntryId;
      const target = anchorId ? unitByEntry.get(anchorId) : undefined;
      if (
        currentPosition === undefined ||
        !current ||
        !anchorId ||
        !target ||
        group.earliest.dependencyAt !== currentPosition
      ) {
        throw new Error(`cannot locate curriculum dependency ${dependencyId}`);
      }
      return {
        dependencyId,
        tokens: [...group.tokens].sort((a, b) => a.localeCompare(b)),
        occurrences: group.occurrences,
        taskOccurrences: group.taskOccurrences,
        sceneOccurrences: group.sceneOccurrences,
        currentPosition,
        currentUnit: current.id,
        earliestRequiredPosition: group.earliest.frontier,
        beforeEntryId: anchorId,
        targetUnit: target.id,
        positionsEarlier: currentPosition - group.earliest.frontier,
        changesFrozenPilotRoster: target.ordinal <= 3 && current.ordinal > target.ordinal,
      };
    })
    .sort(
      (a, b) =>
        b.occurrences - a.occurrences ||
        a.earliestRequiredPosition - b.earliestRequiredPosition ||
        a.dependencyId.localeCompare(b.dependencyId),
    );

  const supportOrReword: SupportRepair[] = [...supportGroups.entries()]
    .map(([token, group]) => ({ token, ...group }))
    .sort((a, b) => b.occurrences - a.occurrences || a.token.localeCompare(b.token));

  const promotableFindings = promotions.reduce((sum, item) => sum + item.occurrences, 0);
  const supportOrRewordFindings = supportOrReword.reduce((sum, item) => sum + item.occurrences, 0);

  return {
    schemaVersion: 1,
    frontierFindings: frontierFindings.length,
    promotableFindings,
    supportOrRewordFindings,
    uniquePromotions: promotions.length,
    uniqueSupportRepairs: supportOrReword.length,
    frozenPilotPromotions: promotions.filter((item) => item.changesFrozenPilotRoster).length,
    promotions,
    supportOrReword,
  };
}

const plan = buildPlan(assurance());
const expected =
  (plan.frontierFindings ===
    (plan.promotableFindings + plan.supportOrRewordFindings)) &&
  plan.frontierFindings ===
    ((plan.promotions.reduce((sum, item) => sum + item.occurrences, 0)) +
      plan.supportOrReword.reduce((sum, item) => sum + item.occurrences, 0));
if (!expected) throw new Error("frontier plan accounting does not balance");

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(plan, null, 2));
} else {
  console.log(
    `A1 frontier repair plan: ${plan.frontierFindings} finding(s); ` +
      `${plan.promotableFindings} can be addressed by ${plan.uniquePromotions} curriculum promotion(s), ` +
      `${plan.supportOrRewordFindings} need explicit support or rewording across ${plan.uniqueSupportRepairs} token(s).`,
  );
  console.log(
    `Pilot-sensitive promotions: ${plan.frozenPilotPromotions}. Top curriculum dependencies:`,
  );
  for (const item of plan.promotions.slice(0, 30)) {
    console.log(
      `- ${item.dependencyId}: ${item.occurrences} finding(s), ${item.currentUnit} -> ${item.targetUnit} before ${item.beforeEntryId}` +
        (item.changesFrozenPilotRoster ? " [changes frozen Units 1-3 roster]" : ""),
    );
  }
  if (plan.supportOrReword.length) {
    console.log("Top non-A1/support-language repairs:");
    for (const item of plan.supportOrReword.slice(0, 20)) {
      console.log(`- ${item.token}: ${item.occurrences} finding(s)`);
    }
  }
}

if (process.argv.includes("--require-zero") && plan.frontierFindings > 0) {
  console.error("Curriculum frontier is not release-clean.");
  process.exit(1);
}
