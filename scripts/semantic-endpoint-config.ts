import type { SemanticJudgeRole } from "../src/lib/learn/assurance";

export type SemanticEndpointConfig = {
  role: SemanticJudgeRole;
  baseUrl: string | null;
  model: string | null;
  modelVersion: string | null;
  provider: string;
  apiKeyPresent: boolean;
  maxTokens: number;
  jsonResponseFormat: boolean;
  missing: string[];
  ready: boolean;
};

function envValue(
  env: NodeJS.ProcessEnv,
  role: SemanticJudgeRole,
  name: string,
): string | undefined {
  const scoped = `SEMANTIC_JUDGE_${role.toUpperCase()}_${name}`;
  return env[scoped] ?? env[`SEMANTIC_JUDGE_${name}`];
}

export function semanticEndpointConfig(
  role: SemanticJudgeRole,
  env: NodeJS.ProcessEnv = process.env,
): SemanticEndpointConfig {
  const baseUrl = envValue(env, role, "BASE_URL")?.trim() || null;
  const model = envValue(env, role, "MODEL")?.trim() || null;
  const modelVersion = envValue(env, role, "MODEL_VERSION")?.trim() || null;
  const provider =
    envValue(env, role, "PROVIDER")?.trim() || "openai-compatible";
  const apiKeyPresent = Boolean(envValue(env, role, "API_KEY")?.trim());

  const rawMaxTokens = envValue(env, role, "MAX_TOKENS") ?? "2400";
  const maxTokens = Number(rawMaxTokens);
  const maxTokensValid = Number.isInteger(maxTokens) && maxTokens >= 256;

  const rawJson = (envValue(env, role, "JSON_RESPONSE_FORMAT") ?? "true")
    .trim()
    .toLowerCase();
  const jsonResponseFormat = !["0", "false", "no", "off"].includes(rawJson);

  const missing: string[] = [];
  if (!baseUrl) missing.push("BASE_URL");
  if (!model) missing.push("MODEL");
  if (!modelVersion) missing.push("MODEL_VERSION");
  if (!maxTokensValid) missing.push("MAX_TOKENS>=256");

  return {
    role,
    baseUrl,
    model,
    modelVersion,
    provider,
    apiKeyPresent,
    maxTokens: maxTokensValid ? maxTokens : 2400,
    jsonResponseFormat,
    missing,
    ready: missing.length === 0,
  };
}
