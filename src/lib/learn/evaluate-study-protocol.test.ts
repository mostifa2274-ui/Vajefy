import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "evaluate-schedulers.ts");
const REGISTER = path.join(ROOT, "scripts", "ts-test-register.mjs");

function exportFile(
  root: string,
  name: string,
  overrides: Record<string, unknown> = {},
): string {
  const file = path.join(root, `${name}.json`);
  const data = {
    kind: "vajefy-study",
    version: 2,
    participant: name,
    exportedAt: "2026-10-05T12:00:00.000Z",
    includesWriting: false,
    app: {
      contentVersion: "content-v1",
      channel: "draft",
      build: "abcdef123456",
    },
    protocol: {
      assessment: {
        id: "held-out-last-authored-v1",
        minimumDelayDays: 30,
        bankContentVersion: "content-v1",
      },
    },
    profile: { minutes: 15 },
    events: [],
    sessions: [],
    ...overrides,
  };
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  return file;
}

function run(files: string[], extraArgs: string[] = []) {
  return spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--no-warnings",
      "--import",
      REGISTER,
      SCRIPT,
      ...extraArgs,
      ...files,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
}

test("the evaluator refuses mixed content/assessment-bank versions before pooling", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "vajefy-eval-protocol-"));
  try {
    const first = exportFile(root, "P-001");
    const second = exportFile(root, "P-002", {
      app: {
        contentVersion: "content-v2",
        channel: "none",
        build: "fedcba654321",
      },
      protocol: {
        assessment: {
          id: "held-out-last-authored-v1",
          minimumDelayDays: 30,
          bankContentVersion: "content-v2",
        },
      },
    });
    const result = run([first, second]);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /multiple export\/content\/assessment protocols/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the evaluator refuses duplicate participant codes", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "vajefy-eval-protocol-"));
  try {
    const first = exportFile(root, "first", { participant: "P-001" });
    const second = exportFile(root, "second", { participant: "P-001" });
    const result = run([first, second]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /duplicate participant P-001/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the evaluator refuses v2 use evidence without the exact held-out prompt id", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "vajefy-eval-protocol-"));
  try {
    const file = exportFile(root, "P-001", {
      events: [
        {
          id: "a1",
          type: "assessment",
          at: 1,
          item: "lex:A1:word",
          context: {
            session: "s1",
            contentVersion: "entry-v1",
            promptId: "generated:form",
          },
          assessment: {
            part: "use",
            correct: true,
            delayDays: 30,
          },
        },
      ],
    });
    const result = run([file]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /use evidence must name the exact held-out/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("the evaluator refuses an export that contradicts the frozen pilot roster", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "vajefy-eval-roster-"));
  try {
    const rosterFile = path.join(root, "roster.json");
    writeFileSync(
      rosterFile,
      JSON.stringify(
        {
          kind: "vajefy-pilot-roster",
          version: 2,
          seedFingerprint: "a".repeat(64),
          protocol: {
            studyExportVersion: 2,
            contentVersion: "content-v1",
            enhancedChannel: "draft",
            comparisonChannel: "none",
            dailyMinutes: 15,
            study: { units: ["01-introductions"], entries: 240, newWordsPerDay: 8 },
            assessment: {
              id: "held-out-last-authored-v1",
              minimumDelayDays: 30,
              bankContentVersion: "content-v1",
            },
          },
          assignments: [
            { participant: "P-001", arm: "enhanced", channel: "draft" },
            { participant: "P-002", arm: "comparison", channel: "none" },
          ],
        },
        null,
        2,
      ) + "\n",
    );
    const file = exportFile(root, "P-001", {
      app: {
        contentVersion: "content-v1",
        channel: "none",
        build: "abcdef123456",
      },
      profile: { minutes: 30 },
    });
    const result = run([file], ["--roster", rosterFile]);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /assigned to enhanced\/draft but exported channel none/,
    );
    assert.match(result.stderr, /daily minutes 30 do not match roster 15/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
