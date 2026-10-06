import fs from "node:fs";
import path from "node:path";
import type { SemanticJudgeRole } from "../src/lib/learn/assurance";
import { estimateSemanticRoleBudget } from "../src/lib/learn/semantic-budget";
import {
  buildSemanticJudgeUserPayload,
  semanticJudgeInputUtf8Bytes,
} from "./semantic-judge-request";

const ROOT = process.cwd();
const BASE = path.join(
  ROOT,
  "content",
  "assurance",
  "semantic",
);
const PRESETS = path.join(BASE, "keyless-provider-presets.json");
const RATES = path.join(BASE, "workers-ai-neuron-rates.json");
const CALIBRATION = path.join(BASE, "calibration", "v1");
const MANIFEST = path.join(CALIBRATION, "manifest.json");
const OUTPUT = path.join(CALIBRATION, "neuron-budget.json");

type Preset = {
  provider: string;
  modelFamily: string;
  model: string;
  modelVersion: string;
  maxTokens: number;
};

type Presets = {
  schemaVersion: 1;
  roles: Record<SemanticJudgeRole, Preset>;
};

type Rate = {
  inputNeuronsPerMillionTokens: number;
  outputNeuronsPerMillionTokens: number;
  paidBillingRequired: boolean;
};

type Rates = {
  schemaVersion: 1;
  verifiedAt: string;
  source: string;
  freeDailyAllocationNeurons: number;
  calibrationSafetyCeilingNeurons: number;
  protocolOverheadTokensPerRequest: number;
  currentRates: Record<string, Rate>;
};

type Manifest = {
  calibrationVersion: string;
  requiredRunsPerRole: number;
};

type Packet = {
  unitId: string;
  roles: {
    role: SemanticJudgeRole;
    criteria: string[];
    promptFile: string;
  }[];
  targets: {
    targetId: string;
    input: unknown;
  }[];
};

function read<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function daysSince(isoDate: string): number {
  const verified = Date.parse(`${isoDate}T00:00:00Z`);
  if (!Number.isFinite(verified)) return Number.POSITIVE_INFINITY;
  return (Date.now() - verified) / 86_400_000;
}

const roles: SemanticJudgeRole[] = [
  "english",
  "persian",
  "pedagogical",
  "adversarial",
];

const presets = read<Presets>(PRESETS);
const rates = read<Rates>(RATES);
const manifest = read<Manifest>(MANIFEST);

if (presets.schemaVersion !== 1 || rates.schemaVersion !== 1) {
  fail("Unsupported semantic budget input schema.");
}
if (manifest.requiredRunsPerRole < 1) {
  fail("Calibration manifest requires at least one run per role.");
}
if (
  !Number.isInteger(rates.freeDailyAllocationNeurons) ||
  !Number.isInteger(rates.calibrationSafetyCeilingNeurons) ||
  rates.calibrationSafetyCeilingNeurons <= 0 ||
  rates.calibrationSafetyCeilingNeurons >
    rates.freeDailyAllocationNeurons
) {
  fail("Invalid Workers AI free/safety Neuron ceilings.");
}
if (
  !Number.isInteger(rates.protocolOverheadTokensPerRequest) ||
  rates.protocolOverheadTokensPerRequest < 0
) {
  fail("Invalid semantic protocol overhead token reserve.");
}

const roleBudgets: Record<string, unknown> = {};
let totalNeurons = 0;
let totalRequests = 0;

for (const role of roles) {
  const preset = presets.roles[role];
  if (!preset) fail(`Missing keyless preset for ${role}.`);

  const rate = rates.currentRates[preset.model];
  if (!rate) fail(`Missing current Neuron rate for ${preset.model}.`);
  if (rate.paidBillingRequired) {
    fail(`${role}: ${preset.model} requires paid billing and is forbidden.`);
  }

  const packetFile = path.join(CALIBRATION, "packets", `${role}.json`);
  const packet = read<Packet>(packetFile);
  const roleSpec = packet.roles.find((item) => item.role === role);
  if (!roleSpec) fail(`${role}: calibration packet role spec missing.`);

  const prompt = fs.readFileSync(
    path.join(ROOT, roleSpec.promptFile),
    "utf8",
  );

  const requestBounds = packet.targets.map((target) => {
    const payload = buildSemanticJudgeUserPayload(
      role,
      roleSpec.criteria,
      target.input,
    );
    const utf8Bytes = semanticJudgeInputUtf8Bytes(prompt, payload);
    return {
      targetId: target.targetId,
      utf8Bytes,
      inputTokensUpperBound:
        utf8Bytes + rates.protocolOverheadTokensPerRequest,
    };
  });

  const estimate = estimateSemanticRoleBudget(
    requestBounds.map((request) => ({
      inputTokensUpperBound: request.inputTokensUpperBound,
    })),
    manifest.requiredRunsPerRole,
    preset.maxTokens,
    rate,
  );

  totalNeurons += estimate.neuronsUpperBound;
  totalRequests += estimate.requestsPerRun * estimate.repeats;

  roleBudgets[role] = {
    model: preset.model,
    modelVersion: preset.modelVersion,
    maxOutputTokensPerRequest: preset.maxTokens,
    rate,
    requestsPerRun: estimate.requestsPerRun,
    repeats: estimate.repeats,
    totalRequests: estimate.requestsPerRun * estimate.repeats,
    maxRequestUtf8Bytes: Math.max(
      ...requestBounds.map((request) => request.utf8Bytes),
    ),
    maxInputTokensUpperBound: Math.max(
      ...requestBounds.map(
        (request) => request.inputTokensUpperBound,
      ),
    ),
    inputTokensUpperBoundTotal: estimate.inputTokensUpperBoundTotal,
    outputTokensUpperBoundTotal: estimate.outputTokensUpperBoundTotal,
    neuronsUpperBound: estimate.neuronsUpperBound,
  };
}

const reserve = rates.freeDailyAllocationNeurons - totalNeurons;
const safetyReserve =
  rates.calibrationSafetyCeilingNeurons - totalNeurons;
const report = {
  schemaVersion: 1,
  calibrationVersion: manifest.calibrationVersion,
  generatedFrom: {
    presets: path.relative(ROOT, PRESETS).replaceAll("\\", "/"),
    rates: path.relative(ROOT, RATES).replaceAll("\\", "/"),
    manifest: path.relative(ROOT, MANIFEST).replaceAll("\\", "/"),
  },
  pricingVerifiedAt: rates.verifiedAt,
  pricingSource: rates.source,
  freeDailyAllocationNeurons: rates.freeDailyAllocationNeurons,
  calibrationSafetyCeilingNeurons:
    rates.calibrationSafetyCeilingNeurons,
  protocolOverheadTokensPerRequest:
    rates.protocolOverheadTokensPerRequest,
  tokenBoundPolicy:
    "UTF-8 bytes + fixed protocol overhead; output at configured maxTokens.",
  requiredRunsPerRole: manifest.requiredRunsPerRole,
  totalRequests,
  roles: roleBudgets,
  totalNeuronsUpperBound: totalNeurons,
  reserveToFreeAllocationNeurons: reserve,
  reserveToSafetyCeilingNeurons: safetyReserve,
  freeAllocationUtilization:
    totalNeurons / rates.freeDailyAllocationNeurons,
  safetyCeilingUtilization:
    totalNeurons / rates.calibrationSafetyCeilingNeurons,
  status:
    totalNeurons <= rates.calibrationSafetyCeilingNeurons
      ? "PASS"
      : "FAIL",
};

const output = `${JSON.stringify(report, null, 2)}\n`;

if (process.argv.includes("--check")) {
  if (!fs.existsSync(OUTPUT)) {
    fail("Missing committed semantic calibration Neuron budget.");
  }
  if (fs.readFileSync(OUTPUT, "utf8") !== output) {
    fail(
      "Committed semantic calibration Neuron budget is stale; regenerate before inference.",
    );
  }
} else {
  fs.writeFileSync(OUTPUT, output);
}

if (process.argv.includes("--require-current")) {
  const age = daysSince(rates.verifiedAt);
  if (age < -1 || age > 30) {
    fail(
      `Workers AI pricing verification is stale (${age.toFixed(
        1,
      )} days); re-verify current rates before inference.`,
    );
  }
}

console.log(
  `Semantic calibration Neuron budget: ${report.status}; ${totalNeurons}/${rates.calibrationSafetyCeilingNeurons} safety ceiling, ${reserve} free-allocation reserve; ${totalRequests} request(s).`,
);
for (const role of roles) {
  const budget = roleBudgets[role] as {
    neuronsUpperBound: number;
    totalRequests: number;
    model: string;
  };
  console.log(
    `- ${role}: ${budget.neuronsUpperBound} neurons upper bound across ${budget.totalRequests} requests (${budget.model})`,
  );
}

if (report.status !== "PASS") process.exit(1);
