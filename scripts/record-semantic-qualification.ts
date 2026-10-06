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
const CALIBRATION = path.join(
  ROOT,
  "content",
  "assurance",
  "semantic",
  "calibration",
);
const V1 = path.join(CALIBRATION, "v1");
const QUALIFIED = path.join(CALIBRATION, "qualified.json");

type QualificationFile = {
  schemaVersion: 1;
  calibrationVersion: string;
  roles: Record<string, unknown>;
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
  fail("Provide repeated calibration bundles with --run <file>.");
}

const cases = read<{ calibrationVersion: string; cases: SemanticCalibrationCase[] }>(
  path.join(V1, "cases.json"),
);
const manifest = read<SemanticCalibrationManifest>(path.join(V1, "manifest.json"));
const packet = read<SemanticCalibrationPacket>(
  path.join(V1, "packets", `${role}.json`),
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
  cases.cases,
  manifest,
  packet,
  runInputs,
);

if (!report.promoted || !report.candidate) {
  console.error(JSON.stringify(report, null, 2));
  fail(`${role} candidate did not meet the pre-registered Vajefy calibration gate.`);
}

const qualification = read<QualificationFile>(QUALIFIED);
if (
  qualification.schemaVersion !== 1 ||
  qualification.calibrationVersion !== cases.calibrationVersion
) {
  fail("Qualification ledger does not match the current calibration version.");
}
if (qualification.roles[role] && !process.argv.includes("--replace")) {
  fail(
    `${role} already has a qualification record. Use --replace only after an intentional re-calibration.`,
  );
}

const parsedBundles = runInputs
  .map((item) => item.bundle)
  .filter((bundle): bundle is SemanticEvidenceBundle => Boolean(bundle));
const runIds = [
  ...new Set(
    parsedBundles.flatMap((bundle) =>
      bundle.judgments.map((judgment) => judgment.evaluator.runId),
    ),
  ),
];
const contextKeys = [
  ...new Set(
    parsedBundles.flatMap((bundle) =>
      bundle.judgments.map(
        (judgment) => judgment.evaluator.contextIsolationKey,
      ),
    ),
  ),
];

qualification.roles[role] = {
  status: "QUALIFIED",
  calibrationVersion: cases.calibrationVersion,
  qualifiedAt: new Date().toISOString(),
  candidate: report.candidate,
  metrics: report.metrics,
  thresholds: report.thresholds,
  runIds,
  contextKeys,
  evidenceFiles: runFiles.map((file) => path.basename(file)),
};

fs.writeFileSync(QUALIFIED, `${JSON.stringify(qualification, null, 2)}\n`);
console.log(
  `Qualified ${role}: ${report.candidate.provider}/${report.candidate.modelId}@${report.candidate.modelVersion} on ${cases.calibrationVersion}.`,
);
