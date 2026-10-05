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
import { test } from "node:test";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "a1-qualification.ts");
const REGISTER = path.join(ROOT, "scripts", "ts-test-register.mjs");

const A = "lex:A1:a";
const B = "lex:A1:b";
const C = "lex:A1:c";

function writeJson(root: string, relative: string, value: unknown): void {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function entry(
  id: string,
  version: string,
  checks: number,
  released = false,
): Record<string, unknown> {
  return {
    id,
    headword: id.slice("lex:A1:".length),
    version,
    released,
    review: null,
    senses: [
      {
        id,
        examples: [{ en: "Example.", fa: "نمونه." }],
        check: Array.from({ length: checks }, (_, index) => ({
          id: `check-${index + 1}`,
        })),
      },
    ],
  };
}

type FixtureOptions = {
  approveB?: boolean;
  staleB?: boolean;
  unit2Ready?: boolean;
  releaseUnit1?: boolean;
};

function fixture(options: FixtureOptions = {}): string {
  const root = mkdtempSync(path.join(tmpdir(), "vajefy-a1-qualification-"));
  writeJson(root, "content/compiled/enhanced.json", {
    version: "compiled-v1",
    entries: [
      entry(A, "version-a", 3, options.releaseUnit1 ?? false),
      entry(B, "version-b", 3, options.releaseUnit1 ?? false),
      entry(C, "version-c", options.unit2Ready ? 3 : 2, false),
    ],
    contrasts: [],
    scenes: [],
    audio: {
      [A]: {
        gb: { word: "a-gb.mp3", examples: ["a-gb-ex.mp3"] },
        us: { word: "a-us.mp3", examples: ["a-us-ex.mp3"] },
      },
      [B]: {
        gb: { word: "b-gb.mp3", examples: ["b-gb-ex.mp3"] },
        us: { word: "b-us.mp3", examples: ["b-us-ex.mp3"] },
      },
      [C]: options.unit2Ready
        ? {
            gb: { word: "c-gb.mp3", examples: ["c-gb-ex.mp3"] },
            us: { word: "c-us.mp3", examples: ["c-us-ex.mp3"] },
          }
        : {
            gb: { word: "c-gb.mp3", examples: ["c-gb-ex.mp3"] },
          },
    },
    audioPack: {
      gb: { files: [], bytes: 0 },
      us: { files: [], bytes: 0 },
    },
  });

  writeJson(root, "content/curriculum/A1.json", {
    level: "A1",
    units: [
      {
        id: "01-introductions",
        titleEn: "Introductions",
        titleFa: "معرفی",
        status: "calibration",
        targetEntries: 2,
        entries: [{ id: A }, { id: B }],
      },
      {
        id: "02-family-home",
        titleEn: "Family and home",
        titleFa: "خانواده و خانه",
        status: "planned",
        targetEntries: 1,
        entries: [{ id: C }],
      },
    ],
  });

  const ledger: Record<string, unknown> = {
    [A]: {
      version: "version-a",
      bilingual: "approved",
      pronunciation: "approved",
      reviewer: "Reviewer A",
      date: "2026-10-05",
    },
    [C]: {
      version: "older-version-c",
      bilingual: "approved",
      pronunciation: "approved",
      reviewer: "Reviewer C",
      date: "2026-10-01",
    },
  };
  if (options.approveB) {
    ledger[B] = {
      version: options.staleB ? "older-version-b" : "version-b",
      bilingual: "approved",
      pronunciation: "approved",
      reviewer: "Reviewer B",
      date: "2026-10-05",
    };
  }
  writeJson(root, "content/pilot/review.json", ledger);

  writeJson(root, "content/pilot/audio-report.json", {
    flagged: [
      {
        sense: B,
        accent: "gb",
        kind: "word",
        text: "b",
        file: "b-gb.mp3",
        issues: ["listener check"],
      },
    ],
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

test("qualification separates machine readiness from explicit human approval", () => {
  const root = fixture();
  try {
    const result = run(root, ["--json"]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout) as {
      summary: {
        units: number;
        machineReadyUnits: number;
        releaseQualifiedUnits: number;
        fullyApprovedEntries: number;
      };
      units: {
        id: string;
        machineReadyForReview: boolean;
        releaseQualified: boolean;
        blockers: string[];
        nextActions: string[];
        evidence: {
          review: {
            ledgerMissing: number;
            ledgerCurrent: number;
            ledgerStale: number;
            fullyApproved: number;
          };
          audio: { flaggedClips: number };
        };
      }[];
    };

    assert.equal(report.summary.units, 2);
    assert.equal(report.summary.machineReadyUnits, 1);
    assert.equal(report.summary.releaseQualifiedUnits, 0);
    assert.equal(report.summary.fullyApprovedEntries, 1);

    const first = report.units.find((unit) => unit.id === "01-introductions")!;
    assert.equal(first.machineReadyForReview, true);
    assert.equal(first.releaseQualified, false);
    assert.equal(first.evidence.review.ledgerCurrent, 1);
    assert.equal(first.evidence.review.ledgerMissing, 1);
    assert.equal(first.evidence.review.fullyApproved, 1);
    assert.equal(first.evidence.audio.flaggedClips, 1);
    assert.ok(first.blockers.includes("bilingual-review:1"));
    assert.ok(first.blockers.includes("pronunciation-review:1"));
    assert.ok(first.nextActions.includes("listen-flagged-audio"));

    const second = report.units.find((unit) => unit.id === "02-family-home")!;
    assert.equal(second.machineReadyForReview, false);
    assert.equal(second.evidence.review.ledgerStale, 1);
    assert.ok(second.blockers.includes("held-out-assessment:1"));
    assert.ok(second.blockers.includes("audio-assets:1"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("machine-ready gate does not require human approvals", () => {
  const root = fixture();
  try {
    const result = run(root, [
      "--unit",
      "01-introductions",
      "--require-ready",
    ]);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("release-qualified gate requires current version-matched approvals", () => {
  const missing = fixture();
  try {
    const result = run(missing, [
      "--unit",
      "01-introductions",
      "--require-qualified",
    ]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /not release-qualified/);
  } finally {
    rmSync(missing, { recursive: true, force: true });
  }

  const stale = fixture({ approveB: true, staleB: true });
  try {
    const result = run(stale, [
      "--unit",
      "01-introductions",
      "--require-qualified",
    ]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /bilingual-review:1/);
    assert.match(result.stderr, /pronunciation-review:1/);
  } finally {
    rmSync(stale, { recursive: true, force: true });
  }

  const current = fixture({ approveB: true });
  try {
    const result = run(current, [
      "--unit",
      "01-introductions",
      "--require-qualified",
    ]);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(current, { recursive: true, force: true });
  }
});

test("qualified but unreleased unit tells editors to rebuild released content", () => {
  const root = fixture({ approveB: true });
  try {
    const result = run(root, [
      "--unit",
      "01-introductions",
      "--json",
    ]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout) as {
      units: {
        releaseQualified: boolean;
        fullyReleased: boolean;
        nextActions: string[];
      }[];
    };
    assert.equal(report.units[0].releaseQualified, true);
    assert.equal(report.units[0].fullyReleased, false);
    assert.ok(report.units[0].nextActions.includes("rebuild-released-content"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("qualification check validates evidence reporting without requiring approvals", () => {
  const root = fixture();
  try {
    const result = run(root, ["--check"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout,
      /A1 qualification report OK: 3 entries across 2 unit\(s\); 1 machine-ready, 0 release-qualified, 0 fully released/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("unknown qualification unit is rejected", () => {
  const root = fixture();
  try {
    const result = run(root, ["--unit", "99-missing"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown curriculum unit 99-missing/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
