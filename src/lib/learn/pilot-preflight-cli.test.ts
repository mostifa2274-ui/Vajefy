import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { createPilotRoster } from "./pilot-roster";
import { versionOf } from "../../../scripts/catalogue.ts";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "pilot-preflight.ts");
const REGISTER = path.join(ROOT, "scripts", "ts-test-register.mjs");
const CONTENT_VERSION = "content-v1";

function writeJson(root: string, relative: string, value: unknown): void {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(options: { approved?: boolean; released?: boolean } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "vajefy-pilot-preflight-"));
  writeJson(root, "public/data/meta.json", { levels: [] });

  const selection = {
    version: 1,
    level: "A1",
    entries: Array.from({ length: 150 }, (_, index) => ({
      id: `lex:A1:fixture-${String(index + 1).padStart(3, "0")}`,
      group: index < 75 ? "function" : "everyday",
    })),
  };
  const provenance = {
    version: 1,
    level: "A1",
    entries: 150,
    fingerprint: versionOf({
      version: selection.version,
      level: selection.level,
      entries: selection.entries.map(({ id, group }) => ({ id, group })),
    }),
  };

  const entries = selection.entries.map((selected, index) => {
    const version = `entry-v${index + 1}`;
    return {
      id: selected.id,
      version,
      released: options.released ?? false,
      review: options.approved
        ? {
            version,
            bilingual: "approved",
            pronunciation: "approved",
            reviewer: "Human Reviewer",
            date: "2026-10-05",
          }
        : null,
      senses: [
        {
          id: selected.id,
          examples: [
            { en: "Example one.", fa: "نمونهٔ یک." },
            { en: "Example two.", fa: "نمونهٔ دو." },
          ],
          check: [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
        },
      ],
    };
  });
  const audio = Object.fromEntries(
    entries.map((entry, index) => [
      entry.id,
      {
        gb: {
          word: `gb-${index}.mp3`,
          examples: [`gb-${index}-1.mp3`, `gb-${index}-2.mp3`],
        },
        us: {
          word: `us-${index}.mp3`,
          examples: [`us-${index}-1.mp3`, `us-${index}-2.mp3`],
        },
      },
    ]),
  );

  writeJson(root, "content/pilot-a1.json", selection);
  writeJson(root, "content/compiled/enhanced.json", {
    version: CONTENT_VERSION,
    pilotSelection: provenance,
    entries,
    contrasts: [],
    scenes: [],
    audio,
    audioPack: {
      gb: { files: [], bytes: 0 },
      us: { files: [], bytes: 0 },
    },
  });

  return root;
}

function run(root: string, args: string[]) {
  return spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--no-warnings",
      "--import",
      REGISTER,
      SCRIPT,
      ...args,
    ],
    { cwd: root, encoding: "utf8" },
  );
}

test("preflight CLI lets a machine-ready draft cohort enter usability testing", () => {
  const root = fixture();
  try {
    const result = run(root, ["--phase", "usability", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout) as {
      ready: boolean;
      summary: { selectedEntries: number; fullyApprovedEntries: number };
    };
    assert.equal(report.ready, true);
    assert.equal(report.summary.selectedEntries, 150);
    assert.equal(report.summary.fullyApprovedEntries, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("preflight CLI blocks learning enrollment before human review and release", () => {
  const root = fixture();
  try {
    const result = run(root, ["--phase", "learning", "--json"]);
    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout) as {
      ready: boolean;
      blockers: string[];
    };
    assert.equal(report.ready, false);
    assert.ok(report.blockers.includes("bilingual-review:150"));
    assert.ok(report.blockers.includes("pronunciation-review:150"));
    assert.ok(report.blockers.includes("released-pilot-content:0/150"));
    assert.ok(report.blockers.includes("pilot-roster-missing"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("preflight CLI accepts a reviewed release with a valid 20-person released roster", () => {
  const root = fixture({ approved: true, released: true });
  const seed = "private-cli-preflight-seed";
  const roster = createPilotRoster({
    participants: Array.from(
      { length: 20 },
      (_, index) => `P-${String(index + 1).padStart(3, "0")}`,
    ),
    seed,
    contentVersion: CONTENT_VERSION,
    enhancedChannel: "released",
    dailyMinutes: 15,
  });
  writeJson(root, "pilot-roster.json", roster);

  try {
    const result = run(root, [
      "--phase",
      "learning",
      "--roster",
      "pilot-roster.json",
      "--seed",
      seed,
      "--json",
    ]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout) as {
      ready: boolean;
      summary: { rosterParticipants: number };
    };
    assert.equal(report.ready, true);
    assert.equal(report.summary.rosterParticipants, 20);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("preflight CLI rejects a malformed pilot selection before evaluation", () => {
  const root = fixture();
  try {
    const selection = JSON.parse(
      require("node:fs").readFileSync(
        path.join(root, "content/pilot-a1.json"),
        "utf8",
      ),
    ) as { entries: unknown[] };
    selection.entries.pop();
    writeJson(root, "content/pilot-a1.json", selection);

    const result = run(root, ["--phase", "usability"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must contain exactly 150 entries/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
