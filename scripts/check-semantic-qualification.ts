import fs from "node:fs";
import path from "node:path";
import {
  semanticJudgeRole,
  type SemanticJudgeRole,
} from "../src/lib/learn/assurance";

const ROOT = process.cwd();
const CALIBRATION = path.join(
  ROOT,
  "content",
  "assurance",
  "semantic",
  "calibration",
);
const QUALIFIED = path.join(CALIBRATION, "qualified.json");
const MANIFEST = path.join(CALIBRATION, "v1", "manifest.json");
const PRESETS = path.join(
  ROOT,
  "content",
  "assurance",
  "semantic",
  "free-provider-presets.json",
);

type Candidate = {
  provider: string;
  modelId: string;
  modelVersion: string;
  promptVersion: string;
  rubricVersion: string;
};

type Qualification = {
  status: "QUALIFIED";
  calibrationVersion: string;
  candidate: Candidate;
  metrics: Record<string, number>;
  thresholds: Record<string, number>;
  runIds: string[];
  contextKeys: string[];
  evidenceFiles: string[];
};

type QualificationFile = {
  schemaVersion: 1;
  calibrationVersion: string;
  roles: Partial<Record<SemanticJudgeRole, Qualification>>;
};

type Presets = {
  roles: Record<
    SemanticJudgeRole,
    { provider: string; model: string; modelVersion: string }
  >;
};

function option(flag: string): string | undefined {
  const at = process.argv.indexOf(flag);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const requestedRole = option("--role") as SemanticJudgeRole | undefined;
if (
  requestedRole &&
  !["english", "persian", "pedagogical", "adversarial"].includes(requestedRole)
) {
  fail(`Unknown semantic judge role: ${requestedRole}`);
}

const ledger = JSON.parse(fs.readFileSync(QUALIFIED, "utf8")) as QualificationFile;
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as {
  calibrationVersion: string;
};
const presets = JSON.parse(fs.readFileSync(PRESETS, "utf8")) as Presets;

if (ledger.schemaVersion !== 1) fail("Unsupported qualification ledger schema.");
if (ledger.calibrationVersion !== manifest.calibrationVersion) {
  fail("Qualification ledger is stale against current calibration version.");
}

let qualified = 0;
for (const role of semanticJudgeRole.options) {
  const record = ledger.roles[role];
  if (!record) continue;
  qualified += 1;

  if (
    record.status !== "QUALIFIED" ||
    record.calibrationVersion !== manifest.calibrationVersion
  ) {
    fail(`${role}: stale/invalid qualification record`);
  }

  const preset = presets.roles[role];
  if (
    record.candidate.provider !== preset.provider ||
    record.candidate.modelId !== preset.model ||
    record.candidate.modelVersion !== preset.modelVersion
  ) {
    fail(
      `${role}: qualification is stale against current free-provider champion`,
    );
  }
  if (record.runIds.length < 2 || new Set(record.runIds).size !== record.runIds.length) {
    fail(`${role}: qualification requires distinct repeated run ids`);
  }
  if (
    record.contextKeys.length < 2 ||
    new Set(record.contextKeys).size !== record.contextKeys.length
  ) {
    fail(`${role}: qualification requires distinct repeated judge contexts`);
  }
}

if (requestedRole && !ledger.roles[requestedRole]) {
  fail(
    `${requestedRole} is not qualified on ${manifest.calibrationVersion}; run calibration before Unit 1 judging.`,
  );
}

console.log(
  `Semantic qualification ledger: PASS; ${qualified}/4 role champion(s) currently qualified on ${manifest.calibrationVersion}.`,
);
if (requestedRole) {
  const candidate = ledger.roles[requestedRole]!.candidate;
  console.log(
    `- ${requestedRole}: ${candidate.provider}/${candidate.modelId}@${candidate.modelVersion}`,
  );
}
