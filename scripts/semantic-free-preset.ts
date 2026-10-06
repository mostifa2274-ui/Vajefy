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
  accountVariable?: string;
  secret: string;
  freeTier: string;
  freeLimitNote: string;
  rationale: string;
  provenanceCaveat: string;
};

type Presets = {
  schemaVersion: 1;
  verifiedAt: string;
  policy: "zero-cost-only";
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
  fail("Usage: semantic-free-preset.ts --role <english|persian|pedagogical|adversarial> [--github-env|--json]");
}

const parsed = JSON.parse(fs.readFileSync(FILE, "utf8")) as Presets;
if (parsed.schemaVersion !== 1 || parsed.policy !== "zero-cost-only") {
  fail("Unsupported semantic free-provider preset file.");
}
const preset = parsed.roles[role];
if (!preset) fail(`Missing zero-cost preset for ${role}.`);

let baseUrl = preset.baseUrl ?? null;
if (!baseUrl && preset.baseUrlTemplate) {
  baseUrl = preset.baseUrlTemplate.replace(
    /\$\{([A-Z0-9_]+)\}/g,
    (_match, name: string) => process.env[name] ?? `MISSING_${name}`,
  );
}

const config = {
  role,
  verifiedAt: parsed.verifiedAt,
  provider: preset.provider,
  baseUrl,
  model: preset.model,
  modelVersion: preset.modelVersion,
  maxTokens: preset.maxTokens,
  jsonResponseFormat: preset.jsonResponseFormat,
  secret: preset.secret,
  accountVariable: preset.accountVariable ?? null,
  freeTier: preset.freeTier,
  freeLimitNote: preset.freeLimitNote,
  provenanceCaveat: preset.provenanceCaveat,
};

if (process.argv.includes("--github-env")) {
  const target = process.env.GITHUB_ENV;
  if (!target) fail("--github-env requires GITHUB_ENV.");
  const existing = process.env;
  const values: Record<string, string> = {
    SEMANTIC_JUDGE_PROVIDER: config.provider,
    SEMANTIC_JUDGE_BASE_URL: config.baseUrl ?? "",
    SEMANTIC_JUDGE_MODEL: config.model,
    SEMANTIC_JUDGE_MODEL_VERSION: config.modelVersion,
    SEMANTIC_JUDGE_MAX_TOKENS: String(config.maxTokens),
    SEMANTIC_JUDGE_JSON_RESPONSE_FORMAT: String(config.jsonResponseFormat),
  };
  const lines = Object.entries(values)
    .filter(([key, value]) => !existing[key] && value)
    .map(([key, value]) => `${key}=${value}`);
  if (lines.length) fs.appendFileSync(target, `${lines.join("\n")}\n`);
  console.log(
    `Applied zero-cost ${role} preset (${config.provider}/${config.model}); explicit SEMANTIC_JUDGE_* values remain authoritative.`,
  );
} else if (process.argv.includes("--json")) {
  console.log(JSON.stringify(config, null, 2));
} else {
  console.log(
    `${role}: provider=${config.provider}; model=${config.model}; base=${config.baseUrl}; freeTier=${config.freeTier}; verified=${config.verifiedAt}`,
  );
}
