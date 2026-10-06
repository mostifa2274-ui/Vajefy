import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "semantic-automation.ts");
const REGISTER = path.join(ROOT, "scripts", "ts-test-register.mjs");
const SEMANTIC = path.join("content", "assurance", "semantic");
const CALIBRATION = path.join(SEMANTIC, "calibration");
const ROLE = "adversarial";

type Packet = {
  unitId: string;
  generationContextKey: string;
  roles: { role: string; promptVersion: string; rubricVersion: string; criteria: string[] }[];
  targets: { targetId: string; contentVersion: string; inputHash: string }[];
};
type Case = { id: string; expectedCriterion: string | null; expectedResult: string };
type Preset = { provider: string; model: string; modelVersion: string; status: string };

function workspace() {
  const dir = mkdtempSync(path.join(tmpdir(), "vajefy-calibration-"));
  cpSync(path.join(ROOT, SEMANTIC), path.join(dir, SEMANTIC), { recursive: true });
  // Start from an empty usage log, so no day is reserved.
  writeFileSync(path.join(dir, CALIBRATION, "automation-log.json"), JSON.stringify({ schemaVersion: 1, entries: [] }));
  const json = <T,>(file: string): T => JSON.parse(readFileSync(path.join(dir, file), "utf8")) as T;
  const run = (...args: string[]) => {
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--no-warnings", "--import", REGISTER, SCRIPT, ...args],
      { cwd: dir, encoding: "utf8" },
    );
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  };
  const active = () => json<{ roles: Record<string, Preset> }>(path.join(SEMANTIC, "keyless-provider-presets.json")).roles[ROLE]!;
  const log = () => json<{ entries: Record<string, unknown>[] }>(path.join(CALIBRATION, "automation-log.json")).entries;
  const rejected = () => json<{ rejected: Record<string, unknown>[] }>(path.join(CALIBRATION, "rejected.json")).rejected;

  /** Three repeats from the active judge; perfect ones match every frozen gold label. */
  const campaign = (name: string, quality: "perfect" | "lenient") => {
    const preset = active();
    const packet = json<Packet>(path.join(CALIBRATION, "v1", "packets", `${ROLE}.json`));
    const cases = json<{ cases: Case[] }>(path.join(CALIBRATION, "v1", "cases.json")).cases;
    const spec = packet.roles[0]!;
    const files: string[] = [];
    for (const repeat of [1, 2, 3]) {
      const runId = `${name}-${repeat}`;
      const judgments = packet.targets.map((target) => {
        const gold = cases.find((item) => item.id === target.targetId)!;
        const criteria = spec.criteria.map((criterion) => {
          const result = quality === "perfect" && criterion === gold.expectedCriterion ? gold.expectedResult : "PASS";
          return { criterion, result, confidence: 0.9, evidence: ["sense"], reasonCode: result === "PASS" ? null : "fixture" };
        });
        const status = criteria.some((item) => item.result === "FAIL")
          ? "FAIL"
          : criteria.some((item) => item.result === "UNCERTAIN")
            ? "UNCERTAIN"
            : "PASS";
        return {
          schemaVersion: 1,
          role: ROLE,
          targetId: target.targetId,
          contentVersion: target.contentVersion,
          inputHash: target.inputHash,
          generatedAt: "2026-10-07T00:20:00Z",
          evaluator: {
            kind: "model",
            provider: preset.provider,
            modelId: preset.model,
            modelVersion: preset.modelVersion,
            promptVersion: spec.promptVersion,
            rubricVersion: spec.rubricVersion,
            contextIsolationKey: `judge:${ROLE}:${runId}`,
            runId,
          },
          criteria,
          status,
        };
      });
      const file = `${name}-${repeat}.json`;
      writeFileSync(
        path.join(dir, file),
        JSON.stringify({ schemaVersion: 1, unitId: packet.unitId, generationContextKey: packet.generationContextKey, judgments }),
      );
      files.push(file);
    }
    return files;
  };

  const attempt = (file: string, record: Record<string, unknown>) => {
    writeFileSync(path.join(dir, file), JSON.stringify(record));
    return file;
  };
  const complete = (name: string) =>
    [1, 2, 3].map((repeat) =>
      attempt(`${name}-attempt-${repeat}.json`, {
        status: "complete",
        requestsSent: 9,
        usage: { responses: 9, responsesWithUsage: 9, inputTokens: 3000, outputTokens: 300 },
      }),
    );
  const record = (runId: string, runs: string[], attempts: string[], today = "2026-10-07") =>
    run(
      "record",
      "--role",
      ROLE,
      "--run-id",
      runId,
      "--today",
      today,
      ...runs.flatMap((file) => ["--run", file]),
      ...attempts.flatMap((file) => ["--attempt", file]),
    );

  return { dir, run, json, active, log, rejected, campaign, attempt, complete, record };
}

test("a campaign that meets the frozen gate qualifies the judge, logs its usage and keeps checks green", () => {
  const space = workspace();
  try {
    assert.equal(space.run("plan", "--today", "2026-10-07").status, 0);
    const judge = space.active();
    const result = space.record("100.1", space.campaign("good", "perfect"), space.complete("good"));
    assert.equal(result.status, 0, result.output);

    const qualified = space.json<{ roles: Record<string, { candidate: { modelId: string } }> }>(
      path.join(CALIBRATION, "qualified.json"),
    );
    assert.equal(qualified.roles[ROLE]?.candidate.modelId, judge.model);
    assert.ok(existsSync(path.join(space.dir, CALIBRATION, "results", `${ROLE}.json`)));
    assert.equal(space.active().status, "qualified");

    const [entry] = space.log();
    assert.equal(entry?.outcome, "qualified");
    assert.equal(entry?.requestsSent, 27);
    assert.equal(entry?.neuronsCharged, 1440);
    // 9,000 input and 900 output tokens at Qwen3 30B's rates.
    assert.deepEqual(entry?.measured, { inputTokens: 9000, outputTokens: 900, neurons: 70 });
    const check = space.run("check");
    assert.equal(check.status, 0, check.output);
  } finally {
    rmSync(space.dir, { recursive: true, force: true });
  }
});

test("a campaign that misses the gate rejects the candidate and activates the next one", () => {
  const space = workspace();
  try {
    space.run("plan", "--today", "2026-10-07");
    const before = space.active();
    const result = space.record("101.1", space.campaign("weak", "lenient"), space.complete("weak"));
    assert.equal(result.status, 0, result.output);
    const rejection = space.rejected().at(-1)!;
    assert.equal(rejection.model, before.model);
    assert.equal(rejection.reason, "did-not-promote");
    assert.match(String(rejection.detail), /defectRecall/);
    assert.notEqual(space.active().model, before.model);
    assert.equal(space.active().status, "calibrating");
    assert.equal(space.run("check").status, 0);
  } finally {
    rmSync(space.dir, { recursive: true, force: true });
  }
});

test("model failures are retried, then rejected after three attempts on two UTC days", () => {
  const space = workspace();
  try {
    space.run("plan", "--today", "2026-10-07");
    const judge = space.active();
    const failed = (name: string) => [
      space.attempt(`${name}-1.json`, {
        status: "failed",
        failure: { kind: "model", code: "invalid-json", targetId: "cal-adv-mistranslation", detail: "not JSON" },
        requestsSent: 2,
        usage: { responses: 2, responsesWithUsage: 2, inputTokens: 600, outputTokens: 100 },
      }),
      `${name}-2.json`,
      `${name}-3.json`,
    ];
    const runs = ["none-1.json", "none-2.json", "none-3.json"];
    assert.equal(space.record("102.1", runs, failed("a"), "2026-10-07").status, 0);
    assert.equal(space.record("103.1", runs, failed("b"), "2026-10-07").status, 0);
    assert.equal(space.active().model, judge.model);
    assert.equal(space.rejected().some((item) => item.model === judge.model && item.role === ROLE), false);
    const charged = space.log()[0]!.neuronsCharged as number;
    assert.ok(charged > 0 && charged < 480, `charged ${charged}`);

    assert.equal(space.record("104.1", runs, failed("c"), "2026-10-08").status, 0);
    const rejection = space.rejected().at(-1)!;
    assert.equal(rejection.model, judge.model);
    assert.equal(rejection.reason, "no-valid-output");
    assert.deepEqual(rejection.runIds, ["102.1", "103.1", "104.1"]);
    assert.notEqual(space.active().model, judge.model);
    assert.equal(space.run("check").status, 0);
  } finally {
    rmSync(space.dir, { recursive: true, force: true });
  }
});

test("gateway faults and interrupted repeats are charged in full but never reject the model", () => {
  const space = workspace();
  try {
    space.run("plan", "--today", "2026-10-07");
    const judge = space.active();
    const runs = ["none-1.json", "none-2.json", "none-3.json"];
    for (const [index, today] of ["2026-10-07", "2026-10-07", "2026-10-08", "2026-10-09"].entries()) {
      const attempts = [
        space.attempt(`gw-${index}-1.json`, {
          status: "failed",
          failure: { kind: "gateway", code: "http-401-unauthorized", targetId: "cal-adv-clean-school", detail: "" },
          requestsSent: 1,
          usage: { responses: 0, responsesWithUsage: 0, inputTokens: 0, outputTokens: 0 },
        }),
        `gw-${index}-2.json`,
        `gw-${index}-3.json`,
      ];
      const result = space.record(`${200 + index}.1`, runs, attempts, today);
      assert.equal(result.status, 0, result.output);
      assert.match(result.output, /failed \(gateway: http-401-unauthorized\)/);
    }
    assert.equal(space.active().model, judge.model);

    const interrupted = space.record(
      "300.1",
      runs,
      [space.attempt("cut-1.json", { status: "started" }), "cut-2.json", "cut-3.json"],
      "2026-10-10",
    );
    assert.equal(interrupted.status, 0, interrupted.output);
    const last = space.log().at(-1)!;
    assert.equal(last.neuronsCharged, 480);
    assert.deepEqual(last.failure, { kind: "gateway", code: "interrupted", detail: "The repeat stopped without a record." });
    assert.equal(space.active().model, judge.model);
  } finally {
    rmSync(space.dir, { recursive: true, force: true });
  }
});

test("record refuses a candidate the planner did not activate, and check catches a hand-edited judge", () => {
  const space = workspace();
  try {
    space.run("plan", "--today", "2026-10-07");
    const presetsFile = path.join(space.dir, SEMANTIC, "keyless-provider-presets.json");
    const presets = JSON.parse(readFileSync(presetsFile, "utf8"));
    presets.roles[ROLE] = { ...presets.candidates[ROLE][3], status: "calibrating", rationale: "hand-picked" };
    writeFileSync(presetsFile, JSON.stringify(presets, null, 2));

    const refused = space.record("400.1", space.campaign("x", "perfect"), space.complete("x"));
    assert.equal(refused.status, 1);
    assert.match(refused.output, /is not the candidate awaiting calibration/);
    const check = space.run("check");
    assert.equal(check.status, 1);
    assert.match(check.output, /adversarial: active judge is not the one the pre-registered order selects/);
  } finally {
    rmSync(space.dir, { recursive: true, force: true });
  }
});

test("a reservation charges the campaign before inference and the record replaces it", () => {
  const space = workspace();
  try {
    space.run("plan", "--today", "2026-10-07");
    assert.equal(space.run("reserve", "--run-id", "500.1", "--neurons", "1440", "--today", "2026-10-07").status, 0);
    assert.equal(space.run("reserve", "--run-id", "500.1", "--neurons", "1440", "--today", "2026-10-07").status, 1);
    assert.deepEqual(
      space.log().map((entry) => [entry.kind, entry.runId, entry.neuronsCharged]),
      [["reservation", "500.1", 1440]],
    );
    // A reserved day leaves no room for a second campaign that would pass the ceiling.
    const full = space.run("reserve", "--run-id", "501.1", "--neurons", "7000", "--today", "2026-10-07");
    assert.equal(full.status, 0);
    const next = space.run("plan", "--today", "2026-10-07");
    assert.match(next.output, /Next: nothing \(daily-ceiling\)/);

    const result = space.record("500.1", space.campaign("good", "perfect"), space.complete("good"));
    assert.equal(result.status, 0, result.output);
    assert.deepEqual(
      space.log().map((entry) => [entry.kind, entry.runId]),
      [["reservation", "501.1"], ["calibration", "500.1"]],
    );
    assert.equal(space.run("check").status, 0);
  } finally {
    rmSync(space.dir, { recursive: true, force: true });
  }
});
