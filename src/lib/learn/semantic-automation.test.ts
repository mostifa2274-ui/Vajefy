import assert from "node:assert/strict";
import test from "node:test";
import {
  assignJudges,
  blockingRole,
  measuredNeurons,
  planNextCalibration,
  rejectAfterFailures,
  type AutomationState,
  type JudgeCandidate,
  type SemanticAutomationConfig,
  type SemanticAutomationLog,
  type SemanticRejection,
} from "./semantic-automation";

function candidate(modelFamily: string, name: string, maxTokens = 800): JudgeCandidate {
  const model = `@cf/${name}`;
  return { provider: "cloudflare-workers-ai", modelFamily, model, modelVersion: `${model}@catalog`, maxTokens };
}

const nemotron = candidate("nvidia-nemotron", "nvidia/nemotron");
const llama = candidate("meta-llama", "meta/llama-3.3");
const scout = candidate("meta-llama", "meta/llama-4-scout");
const mistral = candidate("mistral", "mistral/small");
const kimi = candidate("moonshot-kimi", "moonshot/kimi");
const glm = candidate("zhipu-glm", "zai/glm");
const gemma = candidate("google-gemma", "google/gemma");
const qwen = candidate("qwen", "qwen/qwen3");

const VERSIONS = { promptVersion: "p1", rubricVersion: "r1" };

function state(overrides: Partial<AutomationState> = {}): AutomationState {
  const candidates = {
    english: [llama, nemotron, mistral, scout],
    persian: [kimi, glm, mistral],
    pedagogical: [nemotron, gemma, mistral],
    adversarial: [nemotron, qwen, mistral],
  };
  const cost: Record<string, number> = {
    [llama.model]: 4000,
    [nemotron.model]: 7000,
    [mistral.model]: 3500,
    [scout.model]: 3000,
    [kimi.model]: 8200,
    [glm.model]: 1000,
    [gemma.model]: 1400,
    [qwen.model]: 1500,
  };
  const campaigns = Object.fromEntries(
    Object.entries(candidates).map(([role, list]) => [
      role,
      Object.fromEntries(list.map((item) => [item.model, { neuronsUpperBound: cost[item.model]!, eligible: true }])),
    ]),
  ) as AutomationState["campaigns"];
  return {
    calibrationVersion: "v1",
    candidates,
    campaigns,
    versions: { english: VERSIONS, persian: VERSIONS, pedagogical: VERSIONS, adversarial: VERSIONS },
    qualified: {},
    rejected: [],
    ...overrides,
  };
}

function rejection(role: SemanticRejection["role"], item: JudgeCandidate, reason: SemanticRejection["reason"] = "did-not-promote"): SemanticRejection {
  return {
    role,
    model: item.model,
    modelVersion: item.modelVersion,
    maxTokens: item.maxTokens,
    ...VERSIONS,
    reason,
    rejectedAt: "2026-10-06",
    runIds: ["1"],
    detail: "test",
  };
}

const CONFIG: SemanticAutomationConfig = {
  schemaVersion: 1,
  enabled: true,
  scope: "test",
  authorizedBy: "owner",
  authorizedAt: "2026-10-06",
  authorization: "test",
  freeAllocationOnly: true,
  dailyNeuronCeiling: 8500,
  ratesMaxAgeDays: 30,
  failurePolicy: { attempts: 3, distinctDays: 2 },
  schedule: "17 */6 * * *",
};

const EMPTY_LOG: SemanticAutomationLog = { schemaVersion: 1, entries: [] };

function plan(current: AutomationState, options: { log?: SemanticAutomationLog; today?: string; config?: Partial<SemanticAutomationConfig>; role?: "english" | "persian" | "pedagogical" | "adversarial" } = {}) {
  return planNextCalibration(current, assignJudges(current), {
    config: { ...CONFIG, ...options.config },
    log: options.log ?? EMPTY_LOG,
    ratesVerifiedAt: "2026-10-06",
    today: options.today ?? "2026-10-07",
    requestedRole: options.role,
  });
}

function charged(date: string, neuronsCharged: number): SemanticAutomationLog {
  return { schemaVersion: 1, entries: [{ kind: "reservation", date, neuronsCharged, note: "test" }] };
}

test("each role takes its strongest unrejected candidate whose family is still free", () => {
  const current = state({ rejected: [rejection("english", llama)] });
  const assigned = assignJudges(current);
  assert.equal(assigned.english.candidate, nemotron);
  assert.deepEqual(assigned.english.status === "pending" && assigned.english.skipped, [
    { model: llama.model, reason: "rejected: did-not-promote" },
  ]);
  assert.equal(assigned.persian.candidate, kimi);
  assert.equal(assigned.pedagogical.candidate, gemma);
  assert.equal(assigned.adversarial.candidate, qwen);
});

test("a rejected judge frees its family for the next role in order", () => {
  const current = state({ rejected: [rejection("english", llama), rejection("english", nemotron)] });
  const assigned = assignJudges(current);
  assert.equal(assigned.english.candidate, mistral);
  assert.equal(assigned.pedagogical.candidate, nemotron);
  assert.equal(assigned.adversarial.candidate, qwen);
});

test("a rejection applies only to the exact role, model, token limit, prompt and rubric", () => {
  const otherPrompt = { ...rejection("english", llama), promptVersion: "p0" };
  const otherTokens = { ...rejection("english", llama), maxTokens: 500 };
  const otherRole = rejection("persian", llama);
  assert.equal(assignJudges(state({ rejected: [otherPrompt, otherTokens, otherRole] })).english.candidate, llama);
});

test("qualified roles keep their judge and claim its family first", () => {
  const current = state({ qualified: { adversarial: { modelId: nemotron.model, modelVersion: nemotron.modelVersion } } });
  const assigned = assignJudges(current);
  assert.equal(assigned.adversarial.status, "qualified");
  assert.equal(assigned.adversarial.candidate, nemotron);
  // English would otherwise fall back to Nemotron after Llama.
  assert.equal(assigned.english.candidate, llama);
  assert.equal(assigned.pedagogical.candidate, gemma);
});

test("a role whose candidates are all rejected keeps a distinct placeholder that is never calibrated", () => {
  const current = state({
    rejected: [rejection("persian", kimi), rejection("persian", glm), rejection("persian", mistral)],
  });
  const assigned = assignJudges(current);
  assert.equal(assigned.persian.status, "exhausted");
  assert.notEqual(assigned.persian.candidate.modelFamily, assigned.english.candidate.modelFamily);
  const families = new Set(Object.values(assigned).map((item) => item.candidate.modelFamily));
  assert.equal(families.size, 4);
});

test("ineligible candidates are skipped", () => {
  const current = state();
  current.campaigns.english[llama.model] = { neuronsUpperBound: 9000, eligible: false, ineligibleReason: "over-daily-ceiling" };
  const assigned = assignJudges(current);
  assert.equal(assigned.english.candidate, nemotron);
});

test("a role waits while an earlier pending role could still free a stronger family", () => {
  const current = state({ rejected: [rejection("english", llama)] });
  const assigned = assignJudges(current);
  assert.equal(blockingRole(current, assigned, "english"), null);
  assert.equal(blockingRole(current, assigned, "persian"), null);
  // English holds Nemotron, which pedagogy and adversarial rank first.
  assert.equal(blockingRole(current, assigned, "pedagogical"), "english");
  assert.equal(blockingRole(current, assigned, "adversarial"), "english");
});

test("the planner runs the first ready role whose campaign fits today's remaining ceiling", () => {
  const current = state({ rejected: [rejection("english", llama)] });
  const first = plan(current);
  assert.equal(first.action, "calibrate");
  assert.equal(first.action === "calibrate" && first.role, "english");

  // 2,000 used: English (7,000) and Persian (8,200) no longer fit, and the
  // cheaper roles still wait for English.
  const tight = plan(current, { log: charged("2026-10-07", 2000) });
  assert.equal(tight.action, "none");
  assert.equal(tight.action === "none" && tight.reason, "daily-ceiling");

  // Yesterday's usage does not count today.
  assert.equal(plan(current, { log: charged("2026-10-06", 8500) }).action, "calibrate");
});

test("once English settles, cheaper roles may share a day", () => {
  const current = state({
    qualified: { english: { modelId: nemotron.model, modelVersion: nemotron.modelVersion } },
  });
  const next = plan(current, { log: charged("2026-10-07", 6000) });
  assert.equal(next.action, "calibrate");
  assert.equal(next.action === "calibrate" && next.role, "pedagogical");
});

test("the planner stops when disabled, when rates are stale, and when nothing is pending", () => {
  const current = state();
  const disabled = plan(current, { config: { enabled: false } });
  assert.equal(disabled.action === "none" && disabled.reason, "automation-disabled");
  const stale = plan(current, { today: "2026-11-06" });
  assert.equal(stale.action === "none" && stale.reason, "rates-stale");

  const all = state({
    qualified: {
      english: { modelId: llama.model, modelVersion: llama.modelVersion },
      persian: { modelId: kimi.model, modelVersion: kimi.modelVersion },
      pedagogical: { modelId: nemotron.model, modelVersion: nemotron.modelVersion },
      adversarial: { modelId: qwen.model, modelVersion: qwen.modelVersion },
    },
  });
  const done = plan(all);
  assert.equal(done.action === "none" && done.reason, "all-qualified");
  const notPending = plan(all, { role: "persian" });
  assert.equal(notPending.action === "none" && notPending.reason, "role-not-pending");
});

test("a requested role still waits for the roles before it", () => {
  const current = state({ rejected: [rejection("english", llama)] });
  const waiting = plan(current, { role: "adversarial" });
  assert.equal(waiting.action === "none" && waiting.reason, "waiting-for-earlier-role");
  const persian = plan(current, { role: "persian" });
  assert.equal(persian.action === "calibrate" && persian.role, "persian");
});

test("only model failures on enough attempts and enough days reject a candidate", () => {
  const failure = (date: string, runId: string, kind: "model" | "gateway" = "model") => ({
    kind: "calibration" as const,
    date,
    at: `${date}T00:17:00Z`,
    runId,
    role: "english" as const,
    model: nemotron.model,
    modelVersion: nemotron.modelVersion,
    maxTokens: nemotron.maxTokens,
    ...VERSIONS,
    outcome: "failed" as const,
    failure: { kind, code: kind === "model" ? "invalid-json" : "http-401", detail: "" },
    requestsSent: 1,
    neuronsCharged: 100,
    measured: null,
  });
  const decide = (entries: ReturnType<typeof failure>[]) =>
    rejectAfterFailures({ schemaVersion: 1, entries }, "v1", "english", nemotron, VERSIONS, CONFIG.failurePolicy);

  assert.equal(decide([failure("2026-10-07", "a"), failure("2026-10-07", "b"), failure("2026-10-07", "c")]).reject, false);
  assert.equal(decide([failure("2026-10-07", "a"), failure("2026-10-08", "b")]).reject, false);
  assert.equal(
    decide([failure("2026-10-07", "a"), failure("2026-10-08", "b", "gateway"), failure("2026-10-08", "c", "gateway")]).reject,
    false,
  );
  const rejected = decide([failure("2026-10-07", "a"), failure("2026-10-07", "b"), failure("2026-10-08", "c")]);
  assert.equal(rejected.reject, true);
  assert.deepEqual(rejected.runIds, ["a", "b", "c"]);
});

test("measured usage converts to Neurons at the model's rate, rounded up", () => {
  assert.equal(measuredNeurons(1_000_000, 0, { inputNeuronsPerMillionTokens: 4625, outputNeuronsPerMillionTokens: 30475 }), 4625);
  assert.equal(measuredNeurons(10, 10, { inputNeuronsPerMillionTokens: 4625, outputNeuronsPerMillionTokens: 30475 }), 1);
});
