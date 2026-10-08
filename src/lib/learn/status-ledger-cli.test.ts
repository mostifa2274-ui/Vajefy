import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { LEDGER_END, LEDGER_START } from "./status-ledger";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "plan-status.ts");
const REGISTER = path.join(ROOT, "scripts", "ts-test-register.mjs");

const UNVERIFIED = {
  schemaVersion: 1,
  sources: [
    {
      id: "workbook",
      name: "Workbook",
      version: "1",
      source: "attachments/workbook.xlsx",
      license: "UNVERIFIED",
      redistribution: "unverified",
      derivatives: "unverified",
      attribution: "unknown",
      status: "unverified",
      evidence: [],
    },
  ],
};

type Fixture = {
  gate?: string;
  calibration?: string;
  blockers?: { id: string; status: string }[];
  provenance?: unknown;
  qualifiedRoles?: string[];
};

function run(fixture: Fixture = {}, ...args: string[]) {
  const dir = mkdtempSync(path.join(tmpdir(), "vajefy-status-"));
  try {
    mkdirSync(path.join(dir, "docs"));
    mkdirSync(path.join(dir, "content", "assurance", "semantic", "calibration"), {
      recursive: true,
    });
    const required = Array.from(
      { length: 12 },
      (_, index) =>
        `| F${String(index + 1).padStart(2, "0")} | Task | NOT_STARTED | — | — | — | scope | — |`,
    );
    const gate = fixture.gate ?? "BLOCKED";
    const calibration = fixture.calibration ?? "IN_PROGRESS";
    const calibrationCommits =
      calibration === "IN_PROGRESS" ? "— | —" : "`a2d5b50` | `6e6a44b`";
    writeFileSync(
      path.join(dir, "docs", "A1_PLAN_STATUS.md"),
      [
        LEDGER_START,
        "| ID | Task | State | First commit | Completion commit | Evidence | Release impact | Notes |",
        "|---|---|---|---|---|---|---|---|",
        ...required,
        `| GATE0-RIGHTS | Rights | ${gate} | — | — | \`docs/A1_PLAN_STATUS.md\` | release-gate | Rights unverified. |`,
        `| P2-CALIBRATION | Calibration | ${calibration} | ${calibrationCommits} | \`docs/missing.md\` | release-gate | Roles left. |`,
        LEDGER_END,
      ].join("\n"),
    );
    // Gate 0 now requires explicit item and media lineage in every workspace.
    mkdirSync(path.join(dir, "content", "pilot", "entries"), { recursive: true });
    mkdirSync(path.join(dir, "content", "curriculum"), { recursive: true });
    mkdirSync(path.join(dir, "public", "data"), { recursive: true });
    writeFileSync(
      path.join(dir, "content", "pilot", "entries", "fixture.json"),
      JSON.stringify([{ id: "lex:A1:cat", headword: "cat", senses: [] }]),
    );
    writeFileSync(path.join(dir, "content", "pilot", "scenes.json"), "[]");
    writeFileSync(path.join(dir, "content", "pilot", "contrasts.json"), "[]");
    writeFileSync(
      path.join(dir, "content", "curriculum", "A1.json"),
      JSON.stringify({ units: [{ entries: [{ id: "lex:A1:cat" }] }] }),
    );
    writeFileSync(
      path.join(dir, "content", "assurance", "rights-lineage.json"),
      JSON.stringify({
        schemaVersion: 1,
        scope: "repository-distributed-a1",
        sourceAssignments: {
          entries: { "lex:A1:cat": "workbook" },
          publicData: {},
          curatedContent: {},
          mediaGroups: { "public/audio": ["workbook"], "public/site-art": ["workbook"] },
        },
        clearedEvidence: { entries: {}, publicData: {}, curatedContent: {}, mediaGroups: {} },
      }),
    );
    writeFileSync(
      path.join(dir, "content", "assurance", "provenance.json"),
      JSON.stringify(fixture.provenance ?? UNVERIFIED),
    );
    writeFileSync(
      path.join(dir, "content", "assurance", "progress.json"),
      JSON.stringify({ blockers: fixture.blockers ?? [] }),
    );
    writeFileSync(
      path.join(dir, "content", "assurance", "semantic", "calibration", "qualified.json"),
      JSON.stringify({
        roles: Object.fromEntries(
          (fixture.qualifiedRoles ?? []).map((role) => [role, { status: "QUALIFIED" }]),
        ),
      }),
    );
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--no-warnings", "--import", REGISTER, SCRIPT, "--check", ...args],
      { cwd: dir, encoding: "utf8", env: { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(dir) } },
    );
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("missing evidence paths fail the check, and existing ones pass", () => {
  const { status, output } = run();
  assert.equal(status, 1);
  assert.match(output, /P2-CALIBRATION: evidence path does not exist: docs\/missing.md/);
  assert.doesNotMatch(output, /GATE0-RIGHTS: evidence path/);
});

test("Gate 0 must be BLOCKED while provenance has blockers", () => {
  const { output } = run({ gate: "IN_PROGRESS" });
  assert.match(output, /GATE0-RIGHTS: provenance has \d+ blocker\(s\), so the state must be BLOCKED, not IN_PROGRESS/);
});

test("a source licence alone cannot clear Gate 0 without exact item and media evidence", () => {
  const cleared = {
    schemaVersion: 1,
    sources: [
      {
        ...UNVERIFIED.sources[0],
        license: "CC-BY-4.0",
        redistribution: "allowed",
        derivatives: "allowed",
        attribution: "required",
        status: "cleared",
        evidence: ["https://creativecommons.org/licenses/by/4.0/"],
      },
    ],
  };
  const { output } = run({ provenance: cleared, gate: "IN_PROGRESS" });
  assert.match(output, /GATE0-RIGHTS: provenance has \d+ blocker\(s\), so the state must be BLOCKED, not IN_PROGRESS/);
  assert.doesNotMatch(output, /provenance has no blockers/);
});

test("every BLOCKED blocker in the progress record needs a BLOCKED ledger row", () => {
  const { output } = run({
    blockers: [
      { id: "gate0-rights", status: "BLOCKED" },
      { id: "voice-licence", status: "BLOCKED" },
    ],
  });
  assert.match(output, /VOICE-LICENCE: content\/assurance\/progress.json lists blocker voice-licence/);
  assert.doesNotMatch(output, /GATE0-RIGHTS: content\/assurance\/progress.json/);
});

test("calibration cannot be claimed complete until all four roles qualify", () => {
  const partial = run({ calibration: "MACHINE_PASS", qualifiedRoles: ["english"] });
  assert.match(partial.output, /P2-CALIBRATION: MACHINE_PASS needs all 4 judge roles qualified; 1 are/);
  const full = run({
    calibration: "MACHINE_PASS",
    qualifiedRoles: ["english", "persian", "pedagogical", "adversarial"],
  });
  assert.doesNotMatch(full.output, /judge roles qualified/);
});

test("--require-history fails where commits cannot be verified", () => {
  const { output } = run({}, "--require-history");
  assert.match(output, /git history is shallow or unavailable/);
});
