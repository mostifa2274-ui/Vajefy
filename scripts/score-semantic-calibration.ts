import fs from "node:fs";
import path from "node:path";
import {
  semanticEvidenceBundle,
  semanticJudgeRole,
  type SemanticEvidenceBundle,
} from "../src/lib/learn/assurance";
import {
  scoreSemanticCalibration,
  type CalibrationRunInput,
  type SemanticCalibrationCase,
  type SemanticCalibrationManifest,
  type SemanticCalibrationPacket,
} from "../src/lib/learn/semantic-calibration";

const ROOT = process.cwd();
const BASE = path.join(
  ROOT,
  "content",
  "assurance",
  "semantic",
  "calibration",
  "v1",
);

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

const cases = read<{ cases: SemanticCalibrationCase[] }>(
  path.join(BASE, "cases.json"),
).cases;
const manifest = read<SemanticCalibrationManifest>(
  path.join(BASE, "manifest.json"),
);
const packet = read<SemanticCalibrationPacket>(
  path.join(BASE, "packets", `${role}.json`),
);

const runInputs: CalibrationRunInput[] = runFiles.map((runFile) => {
  const full = path.resolve(runFile);
  if (!fs.existsSync(full)) {
    return { file: runFile, parseProblems: ["file-missing"] };
  }
  const parsed = semanticEvidenceBundle.safeParse(read<unknown>(full));
  if (!parsed.success) {
    return {
      file: runFile,
      parseProblems: parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      ),
    };
  }
  return { file: runFile, bundle: parsed.data as SemanticEvidenceBundle };
});

const report = scoreSemanticCalibration(
  role,
  cases,
  manifest,
  packet,
  runInputs,
);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `Semantic calibration [${role}]: ${report.promoted ? "PROMOTE" : "DO NOT PROMOTE"}; valid runs ${report.metrics.validRuns}/${report.metrics.requestedRuns} (required ${report.metrics.requiredRuns}).`,
  );
  console.log(
    `- defect recall: ${(report.metrics.defectRecall * 100).toFixed(1)}%`,
  );
  console.log(
    `- clean false-positive rate: ${(report.metrics.cleanFalsePositiveRate * 100).toFixed(1)}%`,
  );
  console.log(
    `- clean uncertain rate: ${(report.metrics.cleanUncertainRate * 100).toFixed(1)}%`,
  );
  console.log(
    `- abstain accuracy: ${(report.metrics.abstainAccuracy * 100).toFixed(1)}%`,
  );
  console.log(
    `- expected-label stability: ${(report.metrics.expectedLabelStability * 100).toFixed(1)}%`,
  );
  console.log(
    `- same candidate: ${report.checks.sameCandidate ? "yes" : "no"}; independent repeats: ${report.checks.independentRepeats ? "yes" : "no"}`,
  );
  for (const invalid of report.invalidRuns) {
    console.log(`! invalid run ${invalid.file}: ${invalid.problems.join("; ")}`);
  }
}

if (process.argv.includes("--require-promote") && !report.promoted) {
  process.exit(1);
}
