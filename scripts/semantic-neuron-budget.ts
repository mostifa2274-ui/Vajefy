import fs from "node:fs";
import path from "node:path";
import type { SemanticJudgeRole } from "../src/lib/learn/assurance";
import {
  estimateCampaign,
  type CampaignEstimate,
  type CampaignPreset,
  type NeuronRates,
} from "./semantic-campaign";

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

type Presets = {
  schemaVersion: 1;
  roles: Record<SemanticJudgeRole, CampaignPreset>;
  /** Each role's allowlisted candidates, in the order calibration tries them. */
  candidates: Record<SemanticJudgeRole, CampaignPreset[]>;
};

type Manifest = {
  calibrationVersion: string;
  requiredRunsPerRole: number;
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
const rates = read<NeuronRates>(RATES);
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

const context = {
  root: ROOT,
  rates,
  repeats: manifest.requiredRunsPerRole,
  calibrationDir: CALIBRATION,
};

const roleBudgets: Record<string, CampaignEstimate & { candidates: unknown[] }> = {};
const ineligibleActive: string[] = [];
const ineligibleCandidates: string[] = [];

for (const role of roles) {
  const preset = presets.roles[role];
  if (!preset) fail(`Missing keyless preset for ${role}.`);
  const active = estimateCampaign(context, role, preset);
  if (!active.eligible) {
    ineligibleActive.push(`${role}:${preset.model} (${active.ineligibleReason})`);
  }

  // Calibration runs one role campaign at a time within a daily ceiling, so
  // a candidate is eligible only if its campaign fits under it on its own.
  const candidates = (presets.candidates?.[role] ?? []).map((candidate) => {
    const budget = estimateCampaign(context, role, candidate);
    if (!budget.eligible) {
      ineligibleCandidates.push(`${role}:${candidate.model} (${budget.ineligibleReason})`);
    }
    return {
      model: candidate.model,
      maxOutputTokensPerRequest: candidate.maxTokens,
      totalRequests: budget.totalRequests,
      maxRequestNeuronsUpperBound: budget.maxRequestNeuronsUpperBound,
      neuronsUpperBound: budget.neuronsUpperBound,
      eligible: budget.eligible,
      ...(budget.ineligibleReason ? { ineligibleReason: budget.ineligibleReason } : {}),
    };
  });
  if (!candidates.length) fail(`${role}: no allowlisted candidates.`);

  roleBudgets[role] = { ...active, candidates };
}

const totalNeurons = roles.reduce(
  (total, role) => total + (roleBudgets[role]!.neuronsUpperBound ?? 0),
  0,
);
const totalRequests = roles.reduce(
  (total, role) => total + roleBudgets[role]!.totalRequests,
  0,
);
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
  campaignPolicy:
    "One role campaign at a time. A candidate is eligible only if it needs no paid billing and its full campaign fits the safety ceiling; the automation's usage log keeps each UTC day under the ceiling.",
  requiredRunsPerRole: manifest.requiredRunsPerRole,
  activeJudgesTotalRequests: totalRequests,
  activeJudgesNeuronsUpperBound: totalNeurons,
  roles: roleBudgets,
  ineligibleActiveJudges: ineligibleActive,
  ineligibleCandidates,
  status: ineligibleActive.length ? "FAIL" : "PASS",
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
  `Semantic calibration Neuron budget: ${report.status}; each active judge's campaign fits ${rates.calibrationSafetyCeilingNeurons} Neurons per UTC day.`,
);
for (const role of roles) {
  const budget = roleBudgets[role]!;
  console.log(
    `- ${role}: ${budget.neuronsUpperBound ?? "?"} neurons upper bound across ${budget.totalRequests} requests (${budget.model})`,
  );
}
for (const item of ineligibleActive) console.log(`! active judge ${item} is not eligible`);
for (const item of ineligibleCandidates) console.log(`- not eligible: ${item}`);

if (report.status !== "PASS") process.exit(1);
