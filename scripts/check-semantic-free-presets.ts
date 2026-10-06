import fs from "node:fs";
import path from "node:path";
import type { SemanticJudgeRole } from "../src/lib/learn/assurance";

const ROOT = process.cwd();
const FILE = path.join(
  ROOT,
  "content",
  "assurance",
  "semantic",
  "free-provider-presets.json",
);

type Preset = {
  provider: string;
  baseUrl?: string;
  baseUrlTemplate?: string;
  model: string;
  modelVersion: string;
  jsonResponseFormat: boolean;
  maxTokens: number;
  auth: string;
  secret: string;
  freeTier: string;
  freeLimitNote: string;
  rationale: string;
  provenanceCaveat: string;
};

type Presets = {
  schemaVersion: 1;
  verifiedAt: string;
  policy: string;
  roles: Partial<Record<SemanticJudgeRole, Preset>>;
};

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(FILE)) fail("Missing free-provider preset file.");

const data = JSON.parse(fs.readFileSync(FILE, "utf8")) as Presets;
if (data.schemaVersion !== 1) fail("Unsupported free-provider preset schema.");
if (data.policy !== "zero-cost-only") {
  fail("Semantic provider preset policy must remain zero-cost-only.");
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(data.verifiedAt)) {
  fail("Semantic provider presets require an ISO verification date.");
}

const requiredRoles: SemanticJudgeRole[] = [
  "english",
  "persian",
  "pedagogical",
  "adversarial",
];

const providers = new Set<string>();
const models = new Set<string>();

for (const role of requiredRoles) {
  const preset = data.roles[role];
  if (!preset) fail(`Missing free-provider preset for ${role}.`);
  if (!preset.provider || !preset.model || !preset.modelVersion) {
    fail(`${role}: provider/model/modelVersion is required.`);
  }
  if (!preset.baseUrl && !preset.baseUrlTemplate) {
    fail(`${role}: baseUrl or baseUrlTemplate is required.`);
  }
  if (preset.baseUrl && !preset.baseUrl.startsWith("https://")) {
    fail(`${role}: free provider base URL must use HTTPS.`);
  }
  if (
    preset.baseUrlTemplate &&
    !preset.baseUrlTemplate.startsWith("https://")
  ) {
    fail(`${role}: free provider base URL template must use HTTPS.`);
  }
  if (!Number.isInteger(preset.maxTokens) || preset.maxTokens < 256) {
    fail(`${role}: maxTokens must be an integer >= 256.`);
  }
  if (!preset.freeTier || !preset.freeLimitNote || !preset.rationale) {
    fail(`${role}: free-tier evidence notes and rationale are required.`);
  }
  if (!preset.provenanceCaveat) {
    fail(`${role}: provider reproducibility caveat is required.`);
  }
  providers.add(preset.provider);
  models.add(preset.model);
}

if (providers.size !== requiredRoles.length) {
  fail("Zero-cost semantic judges must use four distinct provider profiles.");
}
if (models.size !== requiredRoles.length) {
  fail("Zero-cost semantic judges must use four distinct model ids.");
}

console.log(
  `Zero-cost semantic presets: PASS (${requiredRoles.length} roles, ${providers.size} providers, verified ${data.verifiedAt}).`,
);
