import fs from "node:fs";
import path from "node:path";
import {
  semanticEvidenceBundle,
  semanticJudgeRole,
  type SemanticEvidenceBundle,
  type SemanticJudgeRole,
} from "../src/lib/learn/assurance";
import {
  validateSemanticEvidenceBundles,
  type SemanticPacketReference,
} from "../src/lib/learn/semantic-evidence";

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
const PACKETS = path.join(BASE, "packets");

type Category = "clean" | "defect" | "abstain";
type Result = "PASS" | "FAIL" | "UNCERTAIN";

type CalibrationCase = {
  id: string;
  role: SemanticJudgeRole;
  category: Category;
  expectedCriterion: string | null;
  expectedResult: Result;
};

type CasesFile = {
  calibrationVersion: string;
  cases: CalibrationCase[];
};

type Manifest = {
  requiredRunsPerRole: number;
  thresholds: {
    schemaComplianceRate: number;
    defectRecall: number;
    cleanFalsePositiveRateMax: number;
    cleanUncertainRateMax: number;
    abstainAccuracy: number;
    expectedLabelStability: number;
  };
};

function option(flag: string): string | undefined {
  const at = process.argv.indexOf(flag);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

function options(flag: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === flag && process.argv[index + 1]) {
      values.push(process.argv[index + 1]!);
    }
  }
  return values;
}

function read<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function ratio(numerator: number, denominator: number): number {
  return denominator ? numerator / denominator : 1;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const roleRaw = option("--role");
if (!roleRaw) fail("--role is required.");
const roleParsed = semanticJudgeRole.safeParse(roleRaw);
if (!roleParsed.success) fail(`Invalid semantic judge role: ${roleRaw}`);
const role = roleParsed.data;

const runFiles = options("--run");
if (!runFiles.length) {
  fail("Provide calibration evidence with repeated --run <bundle.json>.");
}

const casesFile = read<CasesFile>(CASES);
const manifest = read<Manifest>(MANIFEST);
const roleCases = casesFile.cases.filter((item) => item.role === role);
const caseById = new Map(roleCases.map((item) => [item.id, item] as const));
const packet = read<SemanticPacketReference>(
  path.join(PACKETS, `${role}.json`),
);

type ValidRun = {
  file: string;
  bundle: SemanticEvidenceBundle;
  labels: Map<string, Result>;
  statuses: Map<string, Result>;
};

const validRuns: ValidRun[] = [];
const invalidRuns: { file: string; problems: string[] }[] = [];

for (const runFile of runFiles) {
  const full = path.resolve(runFile);
  if (!fs.existsSync(full)) {
    invalidRuns.push({ file: runFile, problems: ["file-missing"] });
    continue;
  }

  const parsed = semanticEvidenceBundle.safeParse(read<unknown>(full));
  if (!parsed.success) {
    invalidRuns.push({
      file: runFile,
      problems: parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      ),
    });
    continue;
  }

  const validation = validateSemanticEvidenceBundles(packet, [parsed.data], true);
  if (validation.problems.length) {
    invalidRuns.push({ file: runFile, problems: validation.problems });
    continue;
  }

  const labels = new Map<string, Result>();
  const statuses = new Map<string, Result>();
  for (const judgment of parsed.data.judgments) {
    const calibrationCase = caseById.get(judgment.targetId);
    if (!calibrationCase) continue;
    statuses.set(calibrationCase.id, judgment.status);
    if (calibrationCase.expectedCriterion) {
      const criterion = judgment.criteria.find(
        (item) => item.criterion === calibrationCase.expectedCriterion,
      );
      if (criterion) labels.set(calibrationCase.id, criterion.result);
    } else {
      labels.set(calibrationCase.id, judgment.status);
    }
  }

  validRuns.push({ file: runFile, bundle: parsed.data, labels, statuses });
}

let defectTotal = 0;
let defectDetected = 0;
let cleanTotal = 0;
let cleanFalsePositive = 0;
let cleanUncertain = 0;
let abstainTotal = 0;
let abstainCorrect = 0;

for (const run of validRuns) {
  for (const calibrationCase of roleCases) {
    const label = run.labels.get(calibrationCase.id);
    const status = run.statuses.get(calibrationCase.id);
    if (!label || !status) continue;

    if (calibrationCase.category === "defect") {
      defectTotal += 1;
      if (label === "FAIL") defectDetected += 1;
    } else if (calibrationCase.category === "clean") {
      cleanTotal += 1;
      if (status === "FAIL") cleanFalsePositive += 1;
      if (status === "UNCERTAIN") cleanUncertain += 1;
    } else {
      abstainTotal += 1;
      if (label === "UNCERTAIN") abstainCorrect += 1;
    }
  }
}

let stableCases = 0;
for (const calibrationCase of roleCases) {
  const labels = validRuns
    .map((run) => run.labels.get(calibrationCase.id))
    .filter((value): value is Result => Boolean(value));
  if (
    labels.length === validRuns.length &&
    labels.length > 0 &&
    new Set(labels).size === 1
  ) {
    stableCases += 1;
  }
}

const metrics = {
  requestedRuns: runFiles.length,
  validRuns: validRuns.length,
  requiredRuns: manifest.requiredRunsPerRole,
  schemaComplianceRate: ratio(validRuns.length, runFiles.length),
  defectRecall: ratio(defectDetected, defectTotal),
  cleanFalsePositiveRate: ratio(cleanFalsePositive, cleanTotal),
  cleanUncertainRate: ratio(cleanUncertain, cleanTotal),
  abstainAccuracy: ratio(abstainCorrect, abstainTotal),
  expectedLabelStability: ratio(stableCases, roleCases.length),
};

const thresholds = manifest.thresholds;
const checks = {
  enoughRuns: validRuns.length >= manifest.requiredRunsPerRole,
  schemaCompliance:
    metrics.schemaComplianceRate >= thresholds.schemaComplianceRate,
  defectRecall: metrics.defectRecall >= thresholds.defectRecall,
  cleanFalsePositive:
    metrics.cleanFalsePositiveRate <= thresholds.cleanFalsePositiveRateMax,
  cleanUncertain:
    metrics.cleanUncertainRate <= thresholds.cleanUncertainRateMax,
  abstainAccuracy: metrics.abstainAccuracy >= thresholds.abstainAccuracy,
  stability:
    metrics.expectedLabelStability >= thresholds.expectedLabelStability,
};

const promoted = Object.values(checks).every(Boolean);
const report = {
  schemaVersion: 1,
  calibrationVersion: casesFile.calibrationVersion,
  role,
  candidate:
    validRuns[0]?.bundle.judgments[0]?.evaluator ?? null,
  cases: roleCases.length,
  metrics,
  thresholds,
  checks,
  promoted,
  invalidRuns,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `Semantic calibration [${role}]: ${promoted ? "PROMOTE" : "DO NOT PROMOTE"}; valid runs ${metrics.validRuns}/${metrics.requestedRuns} (required ${metrics.requiredRuns}).`,
  );
  console.log(
    `- defect recall: ${(metrics.defectRecall * 100).toFixed(1)}% (>= ${(thresholds.defectRecall * 100).toFixed(1)}%)`,
  );
  console.log(
    `- clean false-positive rate: ${(metrics.cleanFalsePositiveRate * 100).toFixed(1)}% (<= ${(thresholds.cleanFalsePositiveRateMax * 100).toFixed(1)}%)`,
  );
  console.log(
    `- clean uncertain rate: ${(metrics.cleanUncertainRate * 100).toFixed(1)}% (<= ${(thresholds.cleanUncertainRateMax * 100).toFixed(1)}%)`,
  );
  console.log(
    `- abstain accuracy: ${(metrics.abstainAccuracy * 100).toFixed(1)}% (>= ${(thresholds.abstainAccuracy * 100).toFixed(1)}%)`,
  );
  console.log(
    `- expected-label stability: ${(metrics.expectedLabelStability * 100).toFixed(1)}% (>= ${(thresholds.expectedLabelStability * 100).toFixed(1)}%)`,
  );
  if (invalidRuns.length) {
    for (const invalid of invalidRuns) {
      console.log(`! invalid run ${invalid.file}: ${invalid.problems.join("; ")}`);
    }
  }
}

if (process.argv.includes("--require-promote") && !promoted) {
  process.exit(1);
}
