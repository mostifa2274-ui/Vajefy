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
const SMOKE_SCRIPT = path.join(ROOT, "scripts", "smoke-keyless-semantic-gateway.ts");

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

for (const role of roles) {
  const preset = data.roles[role];
  if (!preset) fail(`Missing keyless preset for ${role}.`);
  if (preset.provider !== "cloudflare-workers-ai") {
    fail(`${role}: keyless provider must be cloudflare-workers-ai.`);
  }
  if (!preset.model.startsWith("@cf/")) fail(`${role}: model must be Cloudflare-hosted.`);
  if (paidOnly.has(preset.model)) fail(`${role}: model currently requires paid billing.`);
  if (!preset.modelVersion.includes(preset.model)) fail(`${role}: modelVersion must name the model.`);
  if (!Number.isInteger(preset.maxTokens) || preset.maxTokens < 256 || preset.maxTokens > 1200) {
    fail(`${role}: maxTokens must be an integer from 256 through 1200.`);
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

const smokeWorkflow = fs.readFileSync(SMOKE, "utf8");
if (!smokeWorkflow.includes("push:") || !smokeWorkflow.includes("- main")) {
  fail("Keyless gateway smoke must run automatically on main pushes.");
}
if (!smokeWorkflow.includes("id-token: write")) {
  fail("Keyless gateway smoke must request GitHub OIDC id-token: write.");
}
if (!smokeWorkflow.includes("contents: read") || /contents:\s*write/.test(smokeWorkflow)) {
  fail("Keyless gateway smoke must keep repository contents read-only.");
}
if (/secrets\.|API_KEY|SEMANTIC_JUDGE_.*API_KEY/.test(smokeWorkflow)) {
  fail("Keyless gateway smoke must not reference secrets or API keys.");
}
if (!smokeWorkflow.includes("scripts/smoke-keyless-semantic-gateway.ts")) {
  fail("Keyless gateway smoke must run the exact-revision smoke script.");
}

const smokeScript = fs.readFileSync(SMOKE_SCRIPT, "utf8");
if (!smokeScript.includes('method: "GET"')) {
  fail("Keyless gateway smoke must verify the gateway using GET.");
}
if (/method:\s*["']POST["']|assurance:semantic:judge|\.run\(/.test(smokeScript)) {
  fail("Keyless gateway smoke must never execute model inference.");
}
if (!smokeScript.includes("expectedRevision")) {
  fail("Keyless gateway smoke must wait for the exact deployed revision.");
}

console.log(
  `Keyless semantic contract: PASS (OIDC + Workers AI binding, 4 model families, no semantic API keys, exact-revision no-inference smoke, verified ${data.verifiedAt}).`,
);
