import fs from "node:fs";
import path from "node:path";
import type { SemanticJudgeRole } from "../src/lib/learn/assurance";

const ROOT = process.cwd();
const PRESETS = path.join(
  ROOT,
  "content",
  "assurance",
  "semantic",
  "keyless-provider-presets.json",
);
const WRANGLER = path.join(ROOT, "wrangler.jsonc");
const CALIBRATE = path.join(ROOT, ".github", "workflows", "semantic-calibrate.yml");
const JUDGE = path.join(ROOT, ".github", "workflows", "semantic-judge.yml");
const SMOKE = path.join(
  ROOT,
  ".github",
  "workflows",
  "semantic-gateway-smoke.yml",
);

type Preset = {
  provider: string;
  modelFamily: string;
  model: string;
  modelVersion: string;
  maxTokens: number;
};

type Presets = {
  schemaVersion: 1;
  verifiedAt: string;
  policy: string;
  transport: string;
  gatewayOrigin: string;
  audience: string;
  roles: Record<SemanticJudgeRole, Preset>;
  candidates: Record<SemanticJudgeRole, Preset[]>;
};

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(PRESETS, "utf8")) as Presets;
if (data.schemaVersion !== 1) fail("Unsupported keyless preset schema.");
if (data.policy !== "zero-cost-keyless") fail("Keyless policy must remain zero-cost-keyless.");
if (data.transport !== "cloudflare-workers-ai-binding") {
  fail("Keyless semantic transport must remain the Workers AI binding.");
}
if (!data.gatewayOrigin.startsWith("https://")) fail("Keyless gateway must use HTTPS.");
if (data.audience !== "vajefy-semantic-gateway") fail("Unexpected keyless OIDC audience.");

const roles: SemanticJudgeRole[] = [
  "english",
  "persian",
  "pedagogical",
  "adversarial",
];
const models = new Set<string>();
const families = new Set<string>();

const paidOnly = new Set([
  "@cf/moonshotai/kimi-k2.6",
  "@cf/moonshotai/kimi-k2.7-code",
  "@cf/zai-org/glm-5.2",
  "@cf/zai-org/glm-5.3",
  "@cf/zai-org/glm-5.3-flash",
  "@cf/deepseek-ai/deepseek-v4-flash-0731",
  "@cf/deepseek-ai/deepseek-v4-pro-0813",
]);

function checkPreset(label: string, preset: Preset) {
  if (preset.provider !== "cloudflare-workers-ai") {
    fail(`${label}: keyless provider must be cloudflare-workers-ai.`);
  }
  if (!preset.model.startsWith("@cf/")) fail(`${label}: model must be Cloudflare-hosted.`);
  if (paidOnly.has(preset.model)) fail(`${label}: model currently requires paid billing.`);
  if (!preset.modelVersion.includes(preset.model)) fail(`${label}: modelVersion must name the model.`);
  if (!preset.modelFamily) fail(`${label}: modelFamily is required.`);
  if (!Number.isInteger(preset.maxTokens) || preset.maxTokens < 256 || preset.maxTokens > 1200) {
    fail(`${label}: maxTokens must be an integer from 256 through 1200.`);
  }
}

let candidateCount = 0;
for (const role of roles) {
  const candidates = data.candidates?.[role];
  if (!candidates?.length) fail(`${role}: no pre-registered candidates.`);
  if (new Set(candidates.map((item) => item.model)).size !== candidates.length) {
    fail(`${role}: a model is registered twice.`);
  }
  for (const candidate of candidates) checkPreset(`${role} candidate ${candidate.model}`, candidate);
  candidateCount += candidates.length;

  const preset = data.roles[role];
  if (!preset) fail(`Missing keyless preset for ${role}.`);
  checkPreset(role, preset);
  const registered = candidates.find((item) => item.model === preset.model);
  if (
    !registered ||
    registered.modelVersion !== preset.modelVersion ||
    registered.modelFamily !== preset.modelFamily ||
    registered.maxTokens !== preset.maxTokens
  ) {
    fail(`${role}: the active judge must be one of its pre-registered candidates.`);
  }
  models.add(preset.model);
  families.add(preset.modelFamily);
}

if (models.size !== 4) fail("Keyless judges must use four distinct model ids.");
if (families.size !== 4) fail("Keyless judges must use four distinct model families.");

const wrangler = JSON.parse(fs.readFileSync(WRANGLER, "utf8")) as {
  ai?: { binding?: string };
};
if (wrangler.ai?.binding !== "AI") fail("wrangler.jsonc must declare AI binding.");

for (const workflowFile of [CALIBRATE, JUDGE]) {
  const workflow = fs.readFileSync(workflowFile, "utf8");
  if (!workflow.includes("id-token: write")) {
    fail(`${path.basename(workflowFile)} must request GitHub OIDC id-token: write.`);
  }
  if (!workflow.includes("SEMANTIC_JUDGE_TRANSPORT: keyless")) {
    fail(`${path.basename(workflowFile)} must force keyless semantic transport.`);
  }
  if (/secrets\.SEMANTIC_JUDGE_|SEMANTIC_JUDGE_.*API_KEY/.test(workflow)) {
    fail(`${path.basename(workflowFile)} must not reference semantic API-key secrets.`);
  }
}


const smoke = fs.readFileSync(SMOKE, "utf8");
const smokeRequired = [
  "push:",
  "- main",
  "id-token: write",
  "Wait for exact production revision",
  "/api/version",
  "ACTIONS_ID_TOKEN_REQUEST_URL",
  "audience=vajefy-semantic-gateway",
  "/api/internal/semantic-judge",
  "Authenticated keyless gateway contract: PASS (no inference).",
];

for (const marker of smokeRequired) {
  if (!smoke.includes(marker)) {
    fail(`semantic-gateway-smoke.yml missing safety marker: ${marker}`);
  }
}
if (/secrets\./.test(smoke)) {
  fail("Keyless gateway smoke must not use repository secrets.");
}
if (/curl[^\n]*(?:-X|--request)\s+POST|method\s*:\s*POST/i.test(smoke)) {
  fail("Keyless gateway smoke must remain GET-only and never invoke inference.");
}
if (!/branches:\s*\n\s*- main/.test(smoke)) {
  fail("Keyless gateway smoke must run only for pushes to main.");
}

console.log(
  `Keyless semantic contract: PASS (OIDC + Workers AI binding, 4 model families, ${candidateCount} pre-registered candidates, no semantic API keys, verified ${data.verifiedAt}).`,
);
