import fs from "node:fs";
import path from "node:path";
import type { SemanticJudgeRole } from "../src/lib/learn/assurance";
import { requestGitHubActionsOidcToken } from "./github-actions-oidc";

const ROOT = process.cwd();
const PRESETS = path.join(
  ROOT,
  "content",
  "assurance",
  "semantic",
  "keyless-provider-presets.json",
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
  policy: "zero-cost-keyless";
  transport: "cloudflare-workers-ai-binding";
  gatewayOrigin: string;
  audience: string;
  roles: Record<SemanticJudgeRole, Preset>;
};

function option(flag: string): string | undefined {
  const at = process.argv.indexOf(flag);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const role = option("--role") as SemanticJudgeRole | undefined;
if (!role || !["english", "persian", "pedagogical", "adversarial"].includes(role)) {
  fail("--role must be english, persian, pedagogical or adversarial.");
}

const presets = JSON.parse(fs.readFileSync(PRESETS, "utf8")) as Presets;
const preset = presets.roles[role];
if (!preset) fail(`Missing keyless preset for ${role}.`);

const token = await requestGitHubActionsOidcToken(presets.audience);
const response = await fetch(
  `${presets.gatewayOrigin.replace(/\/$/, "")}/api/internal/semantic-judge`,
  { headers: { authorization: `Bearer ${token}` } },
);

if (!response.ok) {
  fail(
    `Keyless semantic gateway preflight failed: HTTP ${response.status} ${await response.text()}`,
  );
}

const status = (await response.json()) as {
  ok?: boolean;
  transport?: string;
  candidates?: Record<string, Preset[]>;
};
// The deployed Worker must allowlist the active candidate with identical settings.
const remote = status.candidates?.[role]?.find((item) => item.model === preset.model);
if (
  status.ok !== true ||
  status.transport !== presets.transport ||
  !remote ||
  remote.provider !== preset.provider ||
  remote.modelFamily !== preset.modelFamily ||
  remote.model !== preset.model ||
  remote.modelVersion !== preset.modelVersion ||
  remote.maxTokens !== preset.maxTokens
) {
  fail(`Keyless gateway model contract mismatch for ${role}.`);
}

console.log(
  `Keyless semantic preflight: PASS; ${role} -> ${preset.model} through GitHub OIDC + Workers AI binding (no API key).`,
);
