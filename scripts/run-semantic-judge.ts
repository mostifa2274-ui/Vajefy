import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  aggregateSemanticCriteria,
  semanticCriterionJudgment,
  semanticEvidenceBundle,
  semanticJudgeRecord,
  semanticRubricManifest,
  type SemanticJudgeRole,
} from "../src/lib/learn/assurance";
import { semanticEndpointConfig } from "./semantic-endpoint-config";
import { requestGitHubActionsOidcToken } from "./github-actions-oidc";
import { semanticInputHash } from "./semantic-input";

const ROOT = process.cwd();
const RUBRICS = path.join(ROOT, "content", "assurance", "semantic-rubrics.json");
const KEYLESS_PRESETS = path.join(
  ROOT,
  "content",
  "assurance",
  "semantic",
  "keyless-provider-presets.json",
);

type KeylessPreset = {
  provider: string;
  modelFamily: string;
  model: string;
  modelVersion: string;
  maxTokens: number;
};

type KeylessPresetFile = {
  schemaVersion: 1;
  policy: "zero-cost-keyless";
  transport: "cloudflare-workers-ai-binding";
  gatewayOrigin: string;
  audience: string;
  roles: Record<SemanticJudgeRole, KeylessPreset>;
};

type PacketRole = {
  role: SemanticJudgeRole;
  promptVersion: string;
  rubricVersion: string;
  criteria: string[];
  promptFile: string;
  promptHash: string;
};

type PacketTarget = {
  targetId: string;
  entryId: string;
  contentVersion: string;
  inputHash: string;
  input: Parameters<typeof semanticInputHash>[0];
};

type Packet = {
  schemaVersion: 1;
  unitId: string;
  generationContextKey: string;
  rubricManifestHash: string;
  roles: PacketRole[];
  targets: PacketTarget[];
};

function option(flag: string): string | undefined {
  const at = process.argv.indexOf(flag);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function read<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function exactCriteria(actual: string[], required: string[]): boolean {
  return (
    actual.length === required.length &&
    new Set(actual).size === actual.length &&
    required.every((criterion) => actual.includes(criterion))
  );
}

async function main() {
  const roleRaw = option("--role");
  const packetPath = option("--packet");
  const runId = option("--run-id");
  const outputPath = option("--output");
  if (!roleRaw || !packetPath || !runId || !outputPath) {
    fail(
      "Usage: run-semantic-judge.ts --role <english|persian|pedagogical|adversarial> --packet <file> --run-id <id> --output <file>",
    );
  }

  const role = roleRaw as SemanticJudgeRole;
  if (!["english", "persian", "pedagogical", "adversarial"].includes(role)) {
    fail(`Unknown semantic judge role: ${roleRaw}`);
  }

  const packet = read<Packet>(path.resolve(packetPath));
  if (packet.schemaVersion !== 1) fail("Unsupported semantic packet version.");

  const parsedRubrics = semanticRubricManifest.safeParse(read<unknown>(RUBRICS));
  if (!parsedRubrics.success) fail("Current semantic rubric manifest is invalid.");
  const rubricsText = fs.readFileSync(RUBRICS, "utf8");
  if (sha256Text(rubricsText) !== packet.rubricManifestHash) {
    fail("Semantic packet rubric hash does not match the current rubric manifest.");
  }

  const roleSpec = packet.roles.find((item) => item.role === role);
  const rubric = parsedRubrics.data.roles.find((item) => item.role === role);
  if (!roleSpec || !rubric) fail(`Packet/rubric missing role ${role}`);
  if (
    roleSpec.promptVersion !== rubric.promptVersion ||
    roleSpec.rubricVersion !== rubric.rubricVersion ||
    !exactCriteria(roleSpec.criteria, rubric.criteria)
  ) {
    fail(`Packet role ${role} is stale against current rubric metadata.`);
  }

  const promptPath = path.join(ROOT, roleSpec.promptFile);
  const prompt = fs.readFileSync(promptPath, "utf8");
  if (sha256Text(prompt) !== roleSpec.promptHash) {
    fail(`Prompt hash mismatch for ${roleSpec.promptFile}`);
  }

  for (const target of packet.targets) {
    if (semanticInputHash(target.input) !== target.inputHash) {
      fail(`Packet input hash mismatch for ${target.targetId}`);
    }
  }

  const transport = process.env.SEMANTIC_JUDGE_TRANSPORT ?? "external";
  let provider: string;
  let model: string;
  let modelVersion: string;
  let maxTokens: number;
  let endpoint: string;
  let apiKey: string | undefined;
  let keylessAudience: string | undefined;

  if (transport === "keyless") {
    const presets = read<KeylessPresetFile>(KEYLESS_PRESETS);
    if (
      presets.schemaVersion !== 1 ||
      presets.policy !== "zero-cost-keyless" ||
      presets.transport !== "cloudflare-workers-ai-binding"
    ) {
      fail("Invalid keyless semantic provider preset file.");
    }
    const preset = presets.roles[role];
    if (!preset) fail(`Missing keyless preset for ${role}.`);
    provider = preset.provider;
    model = preset.model;
    modelVersion = preset.modelVersion;
    maxTokens = preset.maxTokens;
    endpoint = `${presets.gatewayOrigin.replace(/\/$/, "")}/api/internal/semantic-judge`;
    keylessAudience = presets.audience;
  } else {
    const config = semanticEndpointConfig(role);
    if (!config.ready || !config.baseUrl || !config.model || !config.modelVersion) {
      fail(
        `Missing/invalid judge configuration for ${role}: ${config.missing.join(", ")}. Run npm run assurance:semantic:preflight for a no-inference report.`,
      );
    }
    provider = config.provider;
    model = config.model;
    modelVersion = config.modelVersion;
    maxTokens = config.maxTokens;
    apiKey =
      process.env[`SEMANTIC_JUDGE_${role.toUpperCase()}_API_KEY`] ??
      process.env.SEMANTIC_JUDGE_API_KEY;
    endpoint = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
  }

  const contextIsolationKey = `judge:${role}:${runId}`;
  if (contextIsolationKey === packet.generationContextKey) {
    fail("Judge context must differ from the source-generation context.");
  }

  const judgments = [];
  for (const [index, target] of packet.targets.entries()) {
    const userPayload = {
      task: "Judge the supplied target using every required criterion exactly once.",
      role,
      requiredCriteria: roleSpec.criteria,
      target: target.input,
    };

    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    let body: unknown;
    if (transport === "keyless") {
      const oidcToken = await requestGitHubActionsOidcToken(keylessAudience!);
      headers.authorization = `Bearer ${oidcToken}`;
      body = {
        role,
        systemPrompt: prompt,
        userPayload,
      };
    } else {
      if (apiKey) headers.authorization = `Bearer ${apiKey}`;
      const config = semanticEndpointConfig(role);
      body = {
        model,
        temperature: 0,
        max_tokens: maxTokens,
        ...(config.jsonResponseFormat
          ? { response_format: { type: "json_object" } }
          : {}),
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
      };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      fail(
        `${role} judge request failed for ${target.targetId}: HTTP ${response.status} ${await response.text()}`,
      );
    }

    let content: string | undefined;
    if (transport === "keyless") {
      const completion = (await response.json()) as {
        content?: string;
        provider?: string;
        modelId?: string;
        modelVersion?: string;
      };
      if (
        completion.provider !== provider ||
        completion.modelId !== model ||
        completion.modelVersion !== modelVersion
      ) {
        fail(`${role} keyless gateway returned unexpected model provenance.`);
      }
      content = completion.content;
    } else {
      const completion = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      content = completion.choices?.[0]?.message?.content;
    }
    if (!content) fail(`${role} judge returned no content for ${target.targetId}`);

    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch {
      fail(`${role} judge returned non-JSON content for ${target.targetId}`);
    }

    const criteriaRaw = (raw as { criteria?: unknown })?.criteria;
    const criteriaParsed = semanticCriterionJudgment.array().safeParse(criteriaRaw);
    if (!criteriaParsed.success) {
      fail(
        `${role} judge criteria invalid for ${target.targetId}: ${criteriaParsed.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`,
      );
    }

    const criteria = criteriaParsed.data;
    if (
      !exactCriteria(
        criteria.map((criterion) => criterion.criterion),
        roleSpec.criteria,
      )
    ) {
      fail(
        `${role} judge did not return the exact required criteria for ${target.targetId}`,
      );
    }

    const status = aggregateSemanticCriteria(criteria);
    const judgment = semanticJudgeRecord.parse({
      schemaVersion: 1,
      role,
      targetId: target.targetId,
      contentVersion: target.contentVersion,
      inputHash: target.inputHash,
      generatedAt: new Date().toISOString(),
      evaluator: {
        kind: "model",
        provider,
        modelId: model,
        modelVersion,
        promptVersion: roleSpec.promptVersion,
        rubricVersion: roleSpec.rubricVersion,
        contextIsolationKey,
        runId,
      },
      criteria,
      status,
    });
    judgments.push(judgment);
    console.log(
      `[${index + 1}/${packet.targets.length}] ${role} ${target.targetId}: ${status}`,
    );
  }

  const bundle = semanticEvidenceBundle.parse({
    schemaVersion: 1,
    unitId: packet.unitId,
    generationContextKey: packet.generationContextKey,
    judgments,
  });

  const fullOutput = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(fullOutput), { recursive: true });
  fs.writeFileSync(fullOutput, `${JSON.stringify(bundle, null, 2)}\n`);
  console.log(
    `Semantic judge run complete: ${role}, ${judgments.length} judgment(s), run ${runId}; wrote ${fullOutput}.`,
  );
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.stack ?? error.message : String(error));
});
