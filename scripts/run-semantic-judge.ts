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
import { semanticInputHash } from "./semantic-input";

const ROOT = process.cwd();
const RUBRICS = path.join(ROOT, "content", "assurance", "semantic-rubrics.json");

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
  const { createHash } = requireHash();
  return createHash("sha256").update(value).digest("hex");
}

function requireHash() {
  // Kept behind a tiny function so the rest of the runner stays runtime-only.
  return {
    createHash: (
      algorithm: string,
    ): import("node:crypto").Hash =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("node:crypto").createHash(algorithm),
  };
}

function roleEnv(role: string, name: string): string | undefined {
  const scoped = `SEMANTIC_JUDGE_${role.toUpperCase()}_${name}`;
  return process.env[scoped] ?? process.env[`SEMANTIC_JUDGE_${name}`];
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

  const baseUrl = roleEnv(role, "BASE_URL");
  const model = roleEnv(role, "MODEL");
  const modelVersion = roleEnv(role, "MODEL_VERSION");
  const provider = roleEnv(role, "PROVIDER") ?? "openai-compatible";
  const apiKey = roleEnv(role, "API_KEY");
  if (!baseUrl || !model || !modelVersion) {
    fail(
      `Missing judge configuration for ${role}. Set SEMANTIC_JUDGE_${role.toUpperCase()}_BASE_URL, _MODEL and _MODEL_VERSION (or generic SEMANTIC_JUDGE_* fallbacks).`,
    );
  }

  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const maxTokens = Number(roleEnv(role, "MAX_TOKENS") ?? "2400");
  if (!Number.isInteger(maxTokens) || maxTokens < 256) {
    fail("SEMANTIC_JUDGE_MAX_TOKENS must be an integer >= 256.");
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
    if (apiKey) headers.authorization = `Bearer ${apiKey}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
      }),
    });

    if (!response.ok) {
      fail(
        `${role} judge request failed for ${target.targetId}: HTTP ${response.status} ${await response.text()}`,
      );
    }

    const completion = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = completion.choices?.[0]?.message?.content;
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
