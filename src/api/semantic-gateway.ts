import {
  KEYLESS_SEMANTIC_AUDIENCE,
  KEYLESS_SEMANTIC_MODELS,
  KEYLESS_SEMANTIC_REF,
  KEYLESS_SEMANTIC_REPOSITORY,
  KEYLESS_SEMANTIC_WORKFLOWS,
  isKeylessSemanticRole,
} from "./semantic-gateway-config";
import { verifyGitHubActionsRequest } from "./github-oidc";

type GatewayBody = {
  role?: unknown;
  systemPrompt?: unknown;
  userPayload?: unknown;
};

function jsonError(error: string, status: number): Response {
  return Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function extractContent(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  if (typeof record.response === "string") return record.response;

  const choices = record.choices;
  if (Array.isArray(choices)) {
    const first = choices[0];
    if (first && typeof first === "object") {
      const message = (first as Record<string, unknown>).message;
      if (message && typeof message === "object") {
        const content = (message as Record<string, unknown>).content;
        if (typeof content === "string") return content;
      }
    }
  }

  const result = record.result;
  if (result && typeof result === "object") {
    const response = (result as Record<string, unknown>).response;
    if (typeof response === "string") return response;
  }

  return null;
}

async function authenticate(request: Request) {
  return verifyGitHubActionsRequest(request, {
    audience: KEYLESS_SEMANTIC_AUDIENCE,
    repository: KEYLESS_SEMANTIC_REPOSITORY,
    ref: KEYLESS_SEMANTIC_REF,
    workflows: [...KEYLESS_SEMANTIC_WORKFLOWS],
    events: ["workflow_dispatch", "push"],
  });
}

export async function handleSemanticGateway(
  request: Request,
  ai: WorkersAiLike | undefined,
): Promise<Response> {
  if (!ai) return jsonError("workers-ai-unavailable", 503);

  let claims;
  try {
    claims = await authenticate(request);
  } catch {
    return jsonError("unauthorized", 401);
  }

  if (request.method === "GET") {
    return Response.json(
      {
        ok: true,
        transport: "cloudflare-workers-ai-binding",
        repository: claims.repository,
        workflowRef: claims.workflow_ref,
        roles: Object.fromEntries(
          Object.entries(KEYLESS_SEMANTIC_MODELS).map(([role, preset]) => [
            role,
            {
              provider: preset.provider,
              modelFamily: preset.modelFamily,
              model: preset.model,
              modelVersion: preset.modelVersion,
              maxTokens: preset.maxTokens,
            },
          ]),
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (request.method !== "POST") return jsonError("method-not-allowed", 405);
  if (claims.event_name !== "workflow_dispatch") {
    return jsonError("inference-requires-manual-dispatch", 403);
  }

  const raw = await request.text();
  if (!raw || raw.length > 180_000) return jsonError("invalid-body", 400);

  let body: GatewayBody;
  try {
    body = JSON.parse(raw) as GatewayBody;
  } catch {
    return jsonError("invalid-json", 400);
  }

  if (!isKeylessSemanticRole(body.role)) return jsonError("invalid-role", 400);
  if (
    typeof body.systemPrompt !== "string" ||
    body.systemPrompt.length < 1 ||
    body.systemPrompt.length > 40_000
  ) {
    return jsonError("invalid-prompt", 400);
  }

  const userJson = JSON.stringify(body.userPayload);
  if (!userJson || userJson.length > 120_000) {
    return jsonError("invalid-payload", 400);
  }

  const preset = KEYLESS_SEMANTIC_MODELS[body.role];

  let result: unknown;
  try {
    result = await ai.run(preset.model, {
      messages: [
        { role: "system", content: body.systemPrompt },
        { role: "user", content: userJson },
      ],
      temperature: 0,
      max_tokens: preset.maxTokens,
    });
  } catch (error) {
    console.error("Semantic Workers AI call failed", {
      role: body.role,
      model: preset.model,
      runId: claims.run_id ?? null,
      message: error instanceof Error ? error.message : String(error),
    });
    return jsonError("inference-failed", 502);
  }

  const content = extractContent(result);
  if (!content) return jsonError("empty-model-content", 502);

  return Response.json(
    {
      content,
      provider: preset.provider,
      modelFamily: preset.modelFamily,
      modelId: preset.model,
      modelVersion: preset.modelVersion,
      workflowRunId: claims.run_id ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
