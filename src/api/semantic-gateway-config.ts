export const KEYLESS_SEMANTIC_AUDIENCE = "vajefy-semantic-gateway";
export const KEYLESS_SEMANTIC_REPOSITORY = "mostifa2274-ui/Vajefy";
export const KEYLESS_SEMANTIC_REF = "refs/heads/main";

/** The automatic calibration workflow (plan §3.4): manual or scheduled. */
export const KEYLESS_SEMANTIC_CALIBRATE_WORKFLOW =
  "mostifa2274-ui/Vajefy/.github/workflows/semantic-calibrate.yml@refs/heads/main";

export const KEYLESS_SEMANTIC_WORKFLOWS = [
  KEYLESS_SEMANTIC_CALIBRATE_WORKFLOW,
  "mostifa2274-ui/Vajefy/.github/workflows/semantic-judge.yml@refs/heads/main",
] as const;

export const KEYLESS_SEMANTIC_SMOKE_WORKFLOW =
  "mostifa2274-ui/Vajefy/.github/workflows/semantic-gateway-smoke.yml@refs/heads/main";

export const KEYLESS_SEMANTIC_STATUS_WORKFLOWS = [
  ...KEYLESS_SEMANTIC_WORKFLOWS,
  KEYLESS_SEMANTIC_SMOKE_WORKFLOW,
] as const;

/**
 * Which GitHub events may call the gateway. Only the calibration workflow may
 * run on a schedule, so no other workflow can spend inference unattended.
 */
export function keylessSemanticEventAllowed(
  workflowRef: string,
  event: string,
  mode: "status" | "inference",
): boolean {
  if (event === "workflow_dispatch") return true;
  if (event === "schedule") return workflowRef === KEYLESS_SEMANTIC_CALIBRATE_WORKFLOW;
  if (event === "push") {
    return mode === "status" && workflowRef === KEYLESS_SEMANTIC_SMOKE_WORKFLOW;
  }
  return false;
}

export type KeylessSemanticCandidate = {
  provider: "cloudflare-workers-ai";
  modelFamily: string;
  model: string;
  modelVersion: string;
  maxTokens: number;
};

const CATALOG = "cloudflare-catalog-2026-10-06";

/**
 * Marks a candidate that runs with its built-in reasoning switched off. The
 * model's catalog entry documents `chat_template_kwargs.enable_thinking`,
 * and reasoning is on by default. With it on, Nemotron 3 spent all 1,200
 * output tokens reasoning and returned no answer on three runs (2026-10-07),
 * so a free-budget judge must answer directly. The flag is part of the
 * candidate's identity.
 */
export const NO_THINKING = "+no-thinking";

function candidate(
  modelFamily: string,
  model: string,
  maxTokens: number,
  options: { thinking?: false } = {},
): KeylessSemanticCandidate {
  return {
    provider: "cloudflare-workers-ai",
    modelFamily,
    model,
    modelVersion: `${model}@${CATALOG}${options.thinking === false ? NO_THINKING : ""}`,
    maxTokens,
  };
}

/** Whether the gateway must switch the model's reasoning off. */
export function reasoningOff(candidate: Pick<KeylessSemanticCandidate, "modelVersion">): boolean {
  return candidate.modelVersion.endsWith(NO_THINKING);
}

/**
 * The fixed server-side allowlist: for each role, the free Workers AI models
 * it may run, strongest first, in the pre-registered order calibration tries
 * them. Every candidate's full calibration fits the free daily Neuron
 * allocation. Mirrors `candidates` in
 * content/assurance/semantic/keyless-provider-presets.json.
 */
export const KEYLESS_SEMANTIC_CANDIDATES = {
  english: [
    candidate("meta-llama", "@cf/meta/llama-3.3-70b-instruct-fp8-fast", 500),
    candidate("nvidia-nemotron", "@cf/nvidia/nemotron-3-120b-a12b", 1200, { thinking: false }),
    candidate("mistral", "@cf/mistralai/mistral-small-3.1-24b-instruct", 600),
    candidate("meta-llama", "@cf/meta/llama-4-scout-17b-16e-instruct", 600),
  ],
  persian: [
    candidate("moonshot-kimi", "@cf/moonshotai/kimi-k2.5", 700),
    candidate("zhipu-glm", "@cf/zai-org/glm-4.7-flash", 800, { thinking: false }),
    candidate("qwen", "@cf/qwen/qwen3.8-27b", 800, { thinking: false }),
    candidate("mistral", "@cf/mistralai/mistral-small-3.1-24b-instruct", 800),
    candidate("nvidia-nemotron", "@cf/nvidia/nemotron-3-120b-a12b", 1200, { thinking: false }),
  ],
  pedagogical: [
    candidate("nvidia-nemotron", "@cf/nvidia/nemotron-3-120b-a12b", 1200, { thinking: false }),
    candidate("google-gemma", "@cf/google/gemma-4-26b-a4b-it", 800, { thinking: false }),
    candidate("qwen", "@cf/qwen/qwen3.8-27b", 700, { thinking: false }),
    candidate("meta-llama", "@cf/meta/llama-4-scout-17b-16e-instruct", 800),
    candidate("mistral", "@cf/mistralai/mistral-small-3.1-24b-instruct", 800),
  ],
  adversarial: [
    candidate("nvidia-nemotron", "@cf/nvidia/nemotron-3-120b-a12b", 600, { thinking: false }),
    candidate("qwen", "@cf/qwen/qwen3-30b-a3b-fp8", 1000),
    candidate("openai-gpt-oss", "@cf/openai/gpt-oss-120b", 1200),
    candidate("mistral", "@cf/mistralai/mistral-small-3.1-24b-instruct", 1000),
    candidate("meta-llama", "@cf/meta/llama-4-scout-17b-16e-instruct", 1000),
  ],
} as const satisfies Record<string, readonly KeylessSemanticCandidate[]>;

export type KeylessSemanticRole = keyof typeof KEYLESS_SEMANTIC_CANDIDATES;

export function isKeylessSemanticRole(
  value: unknown,
): value is KeylessSemanticRole {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(KEYLESS_SEMANTIC_CANDIDATES, value)
  );
}

/** The allowlisted candidate for this role and model, if there is one. */
export function keylessSemanticCandidate(
  role: KeylessSemanticRole,
  model: unknown,
): KeylessSemanticCandidate | undefined {
  return KEYLESS_SEMANTIC_CANDIDATES[role].find((item) => item.model === model);
}
