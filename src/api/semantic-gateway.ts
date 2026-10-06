import {
  KEYLESS_SEMANTIC_AUDIENCE,
  KEYLESS_SEMANTIC_MODELS,
  KEYLESS_SEMANTIC_REF,
  KEYLESS_SEMANTIC_REPOSITORY,
  KEYLESS_SEMANTIC_STATUS_WORKFLOWS,
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

function collectTextParts(value: unknown, depth = 0): string[] {
  if (depth > 6) return [];
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (!value || typeof value !== "object") return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectTextParts(item, depth + 1));
  }

  const record = value as Record<string, unknown>;
  const direct: string[] = [];

  for (const key of ["output_text", "response"]) {
    if (typeof record[key] === "string" && record[key]!.trim()) {
      direct.push(record[key]!.trim());
    }
  }

  if (typeof record.text === "string" && record.text.trim()) {
    const type = typeof record.type === "string" ? record.type : "";
    if (
      !type ||
      type === "output_text" ||
      type === "text" ||
      type === "message"
    ) {
      direct.push(record.text.trim());
    }
  }

  const choices = record.choices;
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      if (!choice || typeof choice !== "object") continue;
      const choiceRecord = choice as Record<string, unknown>;
      direct.push(...collectTextParts(choiceRecord.message, depth + 1));
      direct.push(...collectTextParts(choiceRecord.text, depth + 1));
    }
  }

  for (const key of ["output", "content", "result"]) {
    if (record[key] != null) {
      direct.push(...collectTextParts(record[key], depth + 1));
    }
  }

  return direct;
}

export function extractWorkersAiContent(value: unknown): string | null {
  const parts = collectTextParts(value);
  if (!parts.length) return null;
  return [...new Set(parts)].join("\n").trim() || null;
}

function workersAiDiagnostic(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valueType: Array.isArray(value) ? "array" : typeof value };
  }
  const record = value as Record<string, unknown>;
  const output = Array.isArray(record.output) ? record.output : [];
  return {
    keys: Object.keys(record).sort(),
    status: typeof record.status === "string" ? record.status : null,
    incompleteDetails:
      record.incomplete_details && typeof record.incomplete_details === "object"
        ? record.incomplete_details
        : null,
    outputTypes: output
      .map((item) =>
        item && typeof item === "object"
          ? (item as Record<string, unknown>).type
          : typeof item,
      )
      .filter((type) => type != null),
    usage:
      record.usage && typeof record.usage === "object" ? record.usage : null,
  };
}

async function authenticate(
  request: Request,
  mode: "status" | "inference",
) {
  return verifyGitHubActionsRequest(request, {
    audience: KEYLESS_SEMANTIC_AUDIENCE,
    repository: KEYLESS_SEMANTIC_REPOSITORY,
    ref: KEYLESS_SEMANTIC_REF,
    workflows:
      mode === "status"
        ? [...KEYLESS_SEMANTIC_STATUS_WORKFLOWS]
        : [...KEYLESS_SEMANTIC_WORKFLOWS],
    events: mode === "status" ? ["workflow_dispatch", "push"] : ["workflow_dispatch"],
  });
}

export async function handleSemanticGateway(
  request: Request,
  ai: WorkersAiLike | undefined,
): Promise<Response> {
  if (!ai) return jsonError("workers-ai-unavailable", 503);

  if (request.method !== "GET" && request.method !== "POST") {
    return jsonError("method-not-allowed", 405);
  }

  let claims;
  try {
    claims = await authenticate(
      request,
      request.method === "GET" ? "status" : "inference",
    );
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

  const content = extractWorkersAiContent(result);
  if (!content) {
    console.error("Semantic Workers AI returned no extractable final text", {
      role: body.role,
      model: preset.model,
      runId: claims.run_id ?? null,
      diagnostic: workersAiDiagnostic(result),
    });
    return jsonError("empty-model-content", 502);
  }

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
