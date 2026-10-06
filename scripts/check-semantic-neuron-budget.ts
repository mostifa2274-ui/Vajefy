import fs from "node:fs";
import path from "node:path";
import type { SemanticJudgeRole } from "../src/lib/learn/assurance";

const ROOT = process.cwd();
const SEMANTIC = path.join(ROOT, "content", "assurance", "semantic");
const PRESETS = path.join(SEMANTIC, "keyless-provider-presets.json");
const BUDGET = path.join(SEMANTIC, "keyless-neuron-budget.json");
const MANIFEST = path.join(SEMANTIC, "calibration", "v1", "manifest.json");
const PACKETS = path.join(SEMANTIC, "calibration", "v1", "packets");

type Role = SemanticJudgeRole;

type Presets = {
  schemaVersion: 1;
  verifiedAt: string;
  roles: Record<
    Role,
    {
      model: string;
      modelVersion: string;
      maxTokens: number;
    }
  >;
};

type Budget = {
  schemaVersion: 1;
  verifiedAt: string;
  dailyFreeNeurons: number;
  maxPlannedCalibrationNeurons: number;
  requiredReserveNeurons: number;
  inputAccounting: {
    policy: string;
    perRequestOverheadTokens: number;
  };
  modelRates: Record<
    string,
    {
      inputNeuronsPerMillionTokens: number;
      outputNeuronsPerMillionTokens: number;
    }
  >;
  paidOnlyDenylist: string[];
};

type Manifest = {
  calibrationVersion: string;
  requiredRunsPerRole: number;
};

type Packet = {
  roles: {
    role: Role;
    promptFile: string;
    criteria: string[];
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

function neurons(
  tokens: number,
  neuronsPerMillionTokens: number,
): number {
  return (tokens * neuronsPerMillionTokens) / 1_000_000;
}

const roles: Role[] = ["english", "persian", "pedagogical", "adversarial"];
const presets = read<Presets>(PRESETS);
const budget = read<Budget>(BUDGET);
const manifest = read<Manifest>(MANIFEST);

if (presets.schemaVersion !== 1 || budget.schemaVersion !== 1) {
  fail("Unsupported keyless semantic budget/preset schema.");
}
if (budget.verifiedAt !== presets.verifiedAt) {
  fail("Keyless model presets and Neuron pricing must share a verification date.");
}
if (
  budget.dailyFreeNeurons !==
  budget.maxPlannedCalibrationNeurons + budget.requiredReserveNeurons
) {
  fail("Free Neuron budget must preserve the explicitly configured reserve.");
}
if (manifest.requiredRunsPerRole < 1) {
  fail("Calibration must require at least one run per role.");
}
if (
  budget.inputAccounting.policy !==
  "utf8-bytes-as-token-upper-bound-plus-fixed-overhead"
) {
  fail("Unexpected semantic input accounting policy.");
}
if (
  !Number.isInteger(budget.inputAccounting.perRequestOverheadTokens) ||
  budget.inputAccounting.perRequestOverheadTokens < 256
) {
  fail("Semantic budget framing overhead must be at least 256 tokens/request.");
}

let totalNeurons = 0;
const report: Record<string, unknown> = {};

for (const role of roles) {
  const preset = presets.roles[role];
  if (!preset) fail(`Missing keyless model preset for ${role}.`);
  if (budget.paidOnlyDenylist.includes(preset.model)) {
    fail(`${role}: configured model is explicitly paid-only: ${preset.model}`);
  }

  const rate = budget.modelRates[preset.model];
  if (!rate) {
    fail(`${role}: no verified Neuron rate for ${preset.model}`);
  }

  const packet = read<Packet>(path.join(PACKETS, `${role}.json`));
  const roleSpec = packet.roles.find((item) => item.role === role);
  if (!roleSpec) fail(`${role}: calibration packet missing role metadata`);

  const promptPath = path.join(ROOT, roleSpec.promptFile);
  const prompt = fs.readFileSync(promptPath, "utf8");

  let inputUpperOneRun = 0;
  for (const target of packet.targets) {
    const userPayload = {
      task: "Judge the supplied target using every required criterion exactly once.",
      role,
      requiredCriteria: roleSpec.criteria,
      target: target.input,
    };

    const payload = JSON.stringify(userPayload);
    inputUpperOneRun +=
      Buffer.byteLength(prompt, "utf8") +
      Buffer.byteLength(payload, "utf8") +
      budget.inputAccounting.perRequestOverheadTokens;
  }

  const requests = packet.targets.length * manifest.requiredRunsPerRole;
  const inputUpper =
    inputUpperOneRun * manifest.requiredRunsPerRole;
  const outputUpper = requests * preset.maxTokens;

  const inputNeurons = neurons(
    inputUpper,
    rate.inputNeuronsPerMillionTokens,
  );
  const outputNeurons = neurons(
    outputUpper,
    rate.outputNeuronsPerMillionTokens,
  );
  const roleNeurons = inputNeurons + outputNeurons;
  totalNeurons += roleNeurons;

  report[role] = {
    model: preset.model,
    requests,
    inputTokenUpperBound: inputUpper,
    outputTokenUpperBound: outputUpper,
    inputNeurons,
    outputNeurons,
    totalNeurons: roleNeurons,
  };
}

const roundedTotal = Math.ceil(totalNeurons * 100) / 100;
const remaining = budget.dailyFreeNeurons - roundedTotal;

console.log(
  `Keyless calibration Neuron budget: ${roundedTotal.toFixed(2)} / ${budget.dailyFreeNeurons} free Neurons; reserve ${remaining.toFixed(2)}.`,
);
for (const role of roles) {
  const row = report[role] as { model: string; totalNeurons: number };
  console.log(
    `- ${role}: ${row.model} <= ${row.totalNeurons.toFixed(2)} Neurons`,
  );
}

if (roundedTotal > budget.maxPlannedCalibrationNeurons) {
  fail(
    `Planned calibration can consume ${roundedTotal.toFixed(2)} Neurons, exceeding the zero-cost planning ceiling of ${budget.maxPlannedCalibrationNeurons}.`,
  );
}

if (remaining < budget.requiredReserveNeurons) {
  fail(
    `Calibration reserve ${remaining.toFixed(2)} is below required ${budget.requiredReserveNeurons} Neurons.`,
  );
}

if (process.argv.includes("--json")) {
  console.log(
    JSON.stringify(
      {
        calibrationVersion: manifest.calibrationVersion,
        requiredRunsPerRole: manifest.requiredRunsPerRole,
        verifiedAt: budget.verifiedAt,
        dailyFreeNeurons: budget.dailyFreeNeurons,
        maxPlannedCalibrationNeurons: budget.maxPlannedCalibrationNeurons,
        requiredReserveNeurons: budget.requiredReserveNeurons,
        totalNeurons: roundedTotal,
        remainingFreeNeurons: remaining,
        roles: report,
      },
      null,
      2,
    ),
  );
}
