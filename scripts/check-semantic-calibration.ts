import fs from "node:fs";
import path from "node:path";
import {
  semanticJudgeRole,
  semanticRubricManifest,
  type SemanticJudgeRole,
} from "../src/lib/learn/assurance";
import { semanticInputHash } from "./semantic-input";

const ROOT = process.cwd();
const BASE = path.join(
  ROOT,
  "content",
  "assurance",
  "semantic",
  "calibration",
  "v1",
);
const CASES = path.join(BASE, "cases.json");
const MANIFEST = path.join(BASE, "manifest.json");
const RUBRICS = path.join(ROOT, "content", "assurance", "semantic-rubrics.json");

type Category = "clean" | "defect" | "abstain";

type CalibrationCase = {
  id: string;
  role: SemanticJudgeRole;
  category: Category;
  sourceTargetId: string;
  expectedCriterion: string | null;
  expectedResult: "PASS" | "FAIL" | "UNCERTAIN";
  severity: string;
  mutationDescription: string;
  target: Parameters<typeof semanticInputHash>[0];
};

type CasesFile = {
  schemaVersion: 1;
  calibrationVersion: string;
  frozenAt: string;
  sourcePacket: string;
  sourcePacketCommit: string;
  goldPolicy: Record<string, string>;
  cases: CalibrationCase[];
};

type Manifest = {
  schemaVersion: 1;
  calibrationVersion: string;
  frozenAt: string;
  casesFile: string;
  requiredRunsPerRole: number;
  thresholds: {
    schemaComplianceRate: number;
    defectRecall: number;
    cleanFalsePositiveRateMax: number;
    cleanUncertainRateMax: number;
    abstainAccuracy: number;
    expectedLabelStability: number;
  };
  promotionPolicy: string;
  notes: string[];
};

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function read<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

const casesFile = read<CasesFile>(CASES);
const manifest = read<Manifest>(MANIFEST);
const rubricsParsed = semanticRubricManifest.safeParse(read<unknown>(RUBRICS));
if (!rubricsParsed.success) fail("Semantic rubric manifest is invalid.");
const rubrics = rubricsParsed.data;

if (casesFile.schemaVersion !== 1 || manifest.schemaVersion !== 1) {
  fail("Unsupported semantic calibration schema version.");
}
if (casesFile.calibrationVersion !== manifest.calibrationVersion) {
  fail("Calibration cases/manifest version mismatch.");
}
if (casesFile.frozenAt !== manifest.frozenAt) {
  fail("Calibration cases/manifest frozenAt mismatch.");
}
if (manifest.requiredRunsPerRole < 2) {
  fail("Judge calibration requires at least two repeated runs per role.");
}

const thresholds = manifest.thresholds;
for (const [name, value] of Object.entries(thresholds)) {
  if (typeof value !== "number" || value < 0 || value > 1) {
    fail(`Calibration threshold ${name} must be between 0 and 1.`);
  }
}

const ids = new Set<string>();
const roleCounts = new Map<SemanticJudgeRole, Record<Category, number>>();
for (const role of semanticJudgeRole.options) {
  roleCounts.set(role, { clean: 0, defect: 0, abstain: 0 });
}

for (const calibrationCase of casesFile.cases) {
  if (!calibrationCase.id.startsWith("cal-")) {
    fail(`Calibration id must start with cal-: ${calibrationCase.id}`);
  }
  if (ids.has(calibrationCase.id)) {
    fail(`Duplicate calibration case id: ${calibrationCase.id}`);
  }
  ids.add(calibrationCase.id);

  const roleParsed = semanticJudgeRole.safeParse(calibrationCase.role);
  if (!roleParsed.success) fail(`${calibrationCase.id}: invalid role`);

  const counts = roleCounts.get(calibrationCase.role)!;
  counts[calibrationCase.category] += 1;

  const rubric = rubrics.roles.find((role) => role.role === calibrationCase.role);
  if (!rubric) fail(`${calibrationCase.id}: missing rubric for role`);

  if (!calibrationCase.mutationDescription.trim()) {
    fail(`${calibrationCase.id}: mutationDescription is required`);
  }
  if (!calibrationCase.sourceTargetId.trim()) {
    fail(`${calibrationCase.id}: sourceTargetId is required`);
  }

  if (calibrationCase.category === "clean") {
    if (
      calibrationCase.expectedCriterion !== null ||
      calibrationCase.expectedResult !== "PASS"
    ) {
      fail(`${calibrationCase.id}: clean cases require null criterion and PASS`);
    }
  } else {
    if (
      !calibrationCase.expectedCriterion ||
      !rubric.criteria.includes(calibrationCase.expectedCriterion)
    ) {
      fail(
        `${calibrationCase.id}: expected criterion must exist in ${calibrationCase.role} rubric`,
      );
    }
    const required =
      calibrationCase.category === "defect" ? "FAIL" : "UNCERTAIN";
    if (calibrationCase.expectedResult !== required) {
      fail(
        `${calibrationCase.id}: ${calibrationCase.category} requires expected result ${required}`,
      );
    }
  }

  if (
    !calibrationCase.target?.entry?.id ||
    !calibrationCase.target?.entry?.headword ||
    !calibrationCase.target?.sense?.id
  ) {
    fail(`${calibrationCase.id}: target snapshot is incomplete`);
  }

  const hash = semanticInputHash(calibrationCase.target);
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    fail(`${calibrationCase.id}: target hash failed`);
  }
}

for (const [role, counts] of roleCounts) {
  if (counts.clean < 1 || counts.defect < 1 || counts.abstain < 1) {
    fail(
      `${role}: calibration requires clean, defect and abstain cases; got ${JSON.stringify(counts)}`,
    );
  }
  const total = counts.clean + counts.defect + counts.abstain;
  if (total < 6) {
    fail(`${role}: calibration requires at least 6 cases; found ${total}`);
  }
}

console.log(
  `Semantic calibration: PASS; ${casesFile.cases.length} frozen cases, ${manifest.requiredRunsPerRole} required runs/role, thresholds pre-registered.`,
);
for (const [role, counts] of roleCounts) {
  console.log(
    `- ${role}: clean=${counts.clean}, defect=${counts.defect}, abstain=${counts.abstain}`,
  );
}
