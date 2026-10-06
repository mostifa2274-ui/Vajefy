import assert from "node:assert/strict";
import test from "node:test";
import {
  semanticEvidenceBundle,
  semanticJudgeRecord,
  type SemanticEvidenceBundle,
  type SemanticJudgeRole,
} from "./assurance";
import {
  validateSemanticEvidenceBundles,
  type SemanticPacketReference,
} from "./semantic-evidence";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

const packet: SemanticPacketReference = {
  schemaVersion: 1,
  unitId: "01-introductions",
  generationContextKey: "source-context",
  roles: [{ role: "english" }, { role: "persian" }],
  targets: [
    {
      targetId: "lex:A1:test",
      contentVersion: "v1",
      inputHash: HASH_A,
    },
    {
      targetId: "lex:A1:other",
      contentVersion: "v2",
      inputHash: HASH_B,
    },
  ],
};

function judgment(
  role: SemanticJudgeRole,
  targetId = "lex:A1:test",
  overrides: {
    contentVersion?: string;
    inputHash?: string;
    contextIsolationKey?: string;
    runId?: string;
  } = {},
) {
  const target = packet.targets.find((item) => item.targetId === targetId)!;
  return semanticJudgeRecord.parse({
    schemaVersion: 1,
    role,
    targetId,
    contentVersion: overrides.contentVersion ?? target.contentVersion,
    inputHash: overrides.inputHash ?? target.inputHash,
    generatedAt: "2026-10-06T00:00:00Z",
    evaluator: {
      kind: "model",
      provider: "fixture",
      modelId: `fixture-${role}`,
      modelVersion: "1",
      promptVersion: `${role}-prompt-v1`,
      rubricVersion: `${role}-rubric-v1`,
      contextIsolationKey:
        overrides.contextIsolationKey ?? `context-${role}`,
      runId: overrides.runId ?? `run-${role}`,
    },
    criteria: [
      {
        criterion: "fixture",
        result: "PASS",
        confidence: 0.99,
        evidence: ["sense.meaning"],
        reasonCode: null,
      },
    ],
    status: "PASS",
  });
}

function bundle(
  judgments: ReturnType<typeof judgment>[],
  overrides: { unitId?: string; generationContextKey?: string } = {},
): SemanticEvidenceBundle {
  return semanticEvidenceBundle.parse({
    schemaVersion: 1,
    unitId: overrides.unitId ?? packet.unitId,
    generationContextKey:
      overrides.generationContextKey ?? packet.generationContextKey,
    judgments,
  });
}

test("valid isolated semantic bundles pass ingestion validation", () => {
  const result = validateSemanticEvidenceBundles(packet, [
    bundle([judgment("english")]),
    bundle([judgment("persian")]),
  ]);
  assert.deepEqual(result.problems, []);
  assert.equal(result.judgments.length, 2);
});

test("stale semantic content version is rejected before merge", () => {
  const result = validateSemanticEvidenceBundles(packet, [
    bundle([judgment("english", "lex:A1:test", { contentVersion: "old" })]),
  ]);
  assert.ok(
    result.problems.includes(
      "bundle[0]:stale-content-version:lex:A1:test:english",
    ),
  );
});

test("stale semantic input hash is rejected before merge", () => {
  const result = validateSemanticEvidenceBundles(packet, [
    bundle([
      judgment("english", "lex:A1:test", { inputHash: "c".repeat(64) }),
    ]),
  ]);
  assert.ok(
    result.problems.includes(
      "bundle[0]:stale-input-hash:lex:A1:test:english",
    ),
  );
});

test("one run bundle cannot mix semantic judge roles", () => {
  const result = validateSemanticEvidenceBundles(packet, [
    bundle([judgment("english"), judgment("persian")]),
  ]);
  assert.ok(result.problems.includes("bundle[0]:mixed-roles:english,persian"));
});

test("different semantic roles cannot reuse one judge context", () => {
  const result = validateSemanticEvidenceBundles(packet, [
    bundle([
      judgment("english", "lex:A1:test", {
        contextIsolationKey: "shared-context",
      }),
    ]),
    bundle([
      judgment("persian", "lex:A1:test", {
        contextIsolationKey: "shared-context",
      }),
    ]),
  ]);
  assert.ok(
    result.problems.includes(
      "shared-context-across-roles:shared-context:english,persian",
    ),
  );
});

test("semantic judge context cannot equal source generation context", () => {
  const result = validateSemanticEvidenceBundles(packet, [
    bundle([
      judgment("english", "lex:A1:test", {
        contextIsolationKey: packet.generationContextKey,
      }),
    ]),
  ]);
  assert.ok(
    result.problems.includes(
      "bundle[0]:judge-context-matches-generator:lex:A1:test:english",
    ),
  );
});

test("duplicate semantic target-role pair is rejected", () => {
  const result = validateSemanticEvidenceBundles(packet, [
    bundle([judgment("english")]),
    bundle([
      judgment("english", "lex:A1:test", {
        contextIsolationKey: "context-english-second",
        runId: "run-english-second",
      }),
    ]),
  ]);
  assert.ok(
    result.problems.includes(
      "bundle[1]:duplicate-target-role:lex:A1:test|english",
    ),
  );
});

test("wrong semantic unit and source context are rejected", () => {
  const result = validateSemanticEvidenceBundles(packet, [
    bundle([judgment("english")], {
      unitId: "02-family-home",
      generationContextKey: "other-source",
    }),
  ]);
  assert.ok(result.problems.includes("bundle[0]:unit-mismatch:02-family-home"));
  assert.ok(result.problems.includes("bundle[0]:generation-context-mismatch"));
});

test("complete semantic ingestion reports every missing target-role pair", () => {
  const result = validateSemanticEvidenceBundles(
    packet,
    [bundle([judgment("english")])],
    true,
  );
  assert.ok(result.problems.includes("incomplete:3"));
  assert.deepEqual(result.missing.sort(), [
    "lex:A1:other|english",
    "lex:A1:other|persian",
    "lex:A1:test|persian",
  ]);
});
