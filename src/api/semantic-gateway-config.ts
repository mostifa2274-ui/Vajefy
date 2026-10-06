export const KEYLESS_SEMANTIC_AUDIENCE = "vajefy-semantic-gateway";
export const KEYLESS_SEMANTIC_REPOSITORY = "mostifa2274-ui/Vajefy";
export const KEYLESS_SEMANTIC_REF = "refs/heads/main";

export const KEYLESS_SEMANTIC_WORKFLOWS = [
  "mostifa2274-ui/Vajefy/.github/workflows/semantic-calibrate.yml@refs/heads/main",
  "mostifa2274-ui/Vajefy/.github/workflows/semantic-judge.yml@refs/heads/main",
] as const;

export const KEYLESS_SEMANTIC_SMOKE_WORKFLOW =
  "mostifa2274-ui/Vajefy/.github/workflows/semantic-gateway-smoke.yml@refs/heads/main";

export const KEYLESS_SEMANTIC_STATUS_WORKFLOWS = [
  ...KEYLESS_SEMANTIC_WORKFLOWS,
  KEYLESS_SEMANTIC_SMOKE_WORKFLOW,
] as const;

export const KEYLESS_SEMANTIC_MODELS = {
  english: {
    provider: "cloudflare-workers-ai",
    modelFamily: "meta-llama",
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    modelVersion:
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast@cloudflare-catalog-2026-10-06",
    maxTokens: 500,
  },
  persian: {
    provider: "cloudflare-workers-ai",
    modelFamily: "zhipu-glm",
    model: "@cf/zai-org/glm-4.7-flash",
    modelVersion:
      "@cf/zai-org/glm-4.7-flash@cloudflare-catalog-2026-10-06",
    maxTokens: 800,
  },
  pedagogical: {
    provider: "cloudflare-workers-ai",
    modelFamily: "google-gemma",
    model: "@cf/google/gemma-4-26b-a4b-it",
    modelVersion:
      "@cf/google/gemma-4-26b-a4b-it@cloudflare-catalog-2026-10-06",
    maxTokens: 800,
  },
  adversarial: {
    provider: "cloudflare-workers-ai",
    modelFamily: "qwen",
    model: "@cf/qwen/qwen3-30b-a3b-fp8",
    modelVersion:
      "@cf/qwen/qwen3-30b-a3b-fp8@cloudflare-catalog-2026-10-06",
    maxTokens: 1000,
  },
} as const;

export type KeylessSemanticRole = keyof typeof KEYLESS_SEMANTIC_MODELS;

export function isKeylessSemanticRole(
  value: unknown,
): value is KeylessSemanticRole {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(KEYLESS_SEMANTIC_MODELS, value)
  );
}
