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
const SCRIPT = path.join(ROOT, "scripts", "review-queue.ts");
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
        pos: "noun",
        gloss: "نمونه",
        meaning: "معنی دقیق نمونه برای بازبینی انسانی.",
        grammar: [
          {
            pattern: "a sample `pattern`",
            note: "الگوی نمونه برای بازبینی.",
          },
        ],
        examples: [{ en: "Example.", fa: "نمونه." }],
        collocations: ["sample phrase"],
        collocationFa: { "sample phrase": "عبارت نمونه" },
        usage: "کاربرد نمونه.",
        mistake: {
          wrong: "Wrong example.",
          wrongFa: "نمونهٔ نادرست.",
          right: "Right example.",
          rightFa: "نمونهٔ درست.",
          why: "دلیل اصلاح نمونه.",
        },
        pronunciation: {
          gb: "/sɑːmpl/",
          us: "/sæmpl/",
          note: "یادداشت تلفظ.",
        },
        check: [
          {
            type: "cloze",
            id: "teach-1",
            text: "This is a ___ sentence.",
            answer: "sample",
            accept: [],
            fa: "این یک جملهٔ نمونه است.",
            why: "تمرین آموزشی.",
          },
          {
            type: "choice",
            id: "teach-2",
            prompt: "Choose the sample.",
            options: [
              { text: "sample", ok: true, why: "پاسخ درست." },
              { text: "other", ok: false, why: "پاسخ نادرست." },
            ],
          },
          {
            type: "produce",
            id: "held-out",
            prompt: "یک نمونه بنویس.",
            frame: "Write a ___.",
            answer: "sample",
            accept: [],
            why: "نامزد مستقل ارزیابی تأخیری.",
            support: [{ en: "write", fa: "نوشتن" }],
          },
        ],
      },
    ],
  };
}

function fixture(
  options: { withLedger?: boolean; planIds?: string[] } = {},
): string {
  const root = mkdtempSync(path.join(tmpdir(), "vajefy-review-queue-"));
  writeJson(root, "content/compiled/enhanced.json", {
    version: "compiled-v1",
    entries: [entry(A, "version-a"), entry(B, "version-b"), entry(C, "version-c")],
    contrasts: [],
    scenes: [],
    audio: {
      [A]: {
        gb: { word: "a-gb.mp3", examples: ["a-gb-ex.mp3"] },
        us: { word: "a-us.mp3", examples: ["a-us-ex.mp3"] },
      },
      [B]: {
        gb: { word: "b-gb.mp3", examples: ["b-gb-ex.mp3"] },
      },
      [C]: {
        gb: { word: "c-gb.mp3", examples: ["c-gb-ex.mp3"] },
        us: { word: "c-us.mp3", examples: ["c-us-ex.mp3"] },
      },
    },
    audioPack: { gb: { files: [], bytes: 0 }, us: { files: [], bytes: 0 } },
  });
  writeJson(root, "content/curriculum/A1.json", {
    level: "A1",
    units: [
      {
        id: "01-introductions",
        entries: [{ id: A }, { id: B }],
      },
      {
        id: "02-family-home",
        entries: [{ id: C }],
      },
    ],
    calibrationSlice: { unit: "01-introductions", entries: [A, B] },
  });
  writeJson(root, "content/pilot-a1.json", {
    entries: [{ id: C }, { id: A }, { id: B }],
  });
  writeJson(root, "content/plans/A1.json", {
    level: "A1",
    batches: [
      {
        id: "pilot",
        entries: (options.planIds ?? [A, B, C]).map((id) => ({ id })),
      },
    ],
  });
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
  if (options.withLedger !== false) {
    writeJson(root, "content/pilot/review.json", {
      [A]: {
        version: "version-a",
        bilingual: "approved",
        pronunciation: "pending",
        reviewer: "Reviewer A",
        date: "2026-10-05",
      },
      [B]: {
        version: "older-version-b",
        bilingual: "approved",
        pronunciation: "approved",
        reviewer: "Reviewer B",
        date: "2026-10-01",
      },
    });
  }
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

test("calibration queue distinguishes current, stale, audio and flag evidence", () => {
  const root = fixture();
  try {
    const result = run(root, ["--scope", "calibration", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    const queue = JSON.parse(result.stdout) as {
      summary: {
        entries: number;
        ledgerCurrent: number;
        ledgerStale: number;
        ledgerMissing: number;
        bilingualApproved: number;
        pronunciationApproved: number;
        audioComplete: number;
        flaggedEntries: number;
        flaggedClips: number;
      };
      entries: {
        id: string;
        approvalToken: string;
        ledgerState: string;
        bilingual: string;
        pronunciation: string;
        audio: { complete: boolean; missingClips: number };
        flags: unknown[];
        nextActions: string[];
        staleReview: { version: string } | null;
      }[];
    };

    assert.deepEqual(queue.summary, {
      entries: 2,
      released: 0,
      ledgerMissing: 0,
      ledgerCurrent: 1,
      ledgerStale: 1,
      bilingualApproved: 1,
      pronunciationApproved: 0,
      fullyApproved: 0,
      audioComplete: 1,
      flaggedEntries: 1,
      flaggedClips: 1,
    });

    const current = queue.entries.find((row) => row.id === A)!;
    assert.equal(current.approvalToken, `${A}@version-a`);
    assert.equal(current.ledgerState, "current");
    assert.equal(current.bilingual, "approved");
    assert.equal(current.pronunciation, "pending");
    assert.equal(current.audio.complete, true);
    assert.ok(current.nextActions.includes("pronunciation-review"));

    const stale = queue.entries.find((row) => row.id === B)!;
    assert.equal(stale.ledgerState, "stale");
    assert.equal(stale.bilingual, "pending");
    assert.equal(stale.pronunciation, "pending");
    assert.equal(stale.staleReview?.version, "older-version-b");
    assert.equal(stale.audio.complete, false);
    assert.equal(stale.audio.missingClips, 2);
    assert.equal(stale.flags.length, 1);
    assert.ok(stale.nextActions.includes("re-review-current-version"));
    assert.ok(stale.nextActions.includes("restore-current-audio"));
    assert.ok(stale.nextActions.includes("listen-flagged-audio"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("pilot queue follows the pilot selection order and treats no ledger as missing", () => {
  const root = fixture({ withLedger: false });
  try {
    const result = run(root, ["--scope", "pilot", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    const queue = JSON.parse(result.stdout) as {
      summary: { entries: number; ledgerMissing: number };
      entries: { id: string; order: number; ledgerState: string }[];
    };
    assert.equal(queue.summary.entries, 3);
    assert.equal(queue.summary.ledgerMissing, 3);
    assert.deepEqual(
      queue.entries.map((row) => [row.order, row.id, row.ledgerState]),
      [
        [1, C, "missing"],
        [2, A, "missing"],
        [3, B, "missing"],
      ],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("all-a1 queue follows curriculum order rather than catalogue batch order", () => {
  const root = fixture({ withLedger: false, planIds: [C, B, A] });
  try {
    const result = run(root, ["--scope", "all-a1", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    const queue = JSON.parse(result.stdout) as {
      scope: string;
      summary: { entries: number };
      entries: { id: string; order: number; curriculumUnit: string | null }[];
    };

    assert.equal(queue.scope, "all-a1");
    assert.equal(queue.summary.entries, 3);
    assert.deepEqual(
      queue.entries.map((row) => [row.order, row.id, row.curriculumUnit]),
      [
        [1, A, "01-introductions"],
        [2, B, "01-introductions"],
        [3, C, "02-family-home"],
      ],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("unit queue selects one curriculum unit in curriculum order", () => {
  const root = fixture({ withLedger: false });
  try {
    const result = run(root, ["--unit", "02-family-home", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    const queue = JSON.parse(result.stdout) as {
      scope: string;
      summary: { entries: number; ledgerMissing: number };
      entries: { id: string; order: number; curriculumUnit: string | null }[];
    };

    assert.equal(queue.scope, "unit:02-family-home");
    assert.equal(queue.summary.entries, 1);
    assert.equal(queue.summary.ledgerMissing, 1);
    assert.deepEqual(
      queue.entries.map((row) => [row.order, row.id, row.curriculumUnit]),
      [[1, C, "02-family-home"]],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("review packet is self-contained, version-bound and respects limit", () => {
  const root = fixture();
  try {
    const result = run(root, [
      "--unit",
      "01-introductions",
      "--packet",
      "--limit",
      "1",
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /# A1 human review packet/);
    assert.match(result.stdout, /Scope: \*\*unit:01-introductions\*\*/);
    assert.match(result.stdout, /Showing: \*\*1\*\* of \*\*2\*\*/);
    assert.match(result.stdout, /lex:A1:a@version-a/);
    assert.match(result.stdout, /\*\*Meaning:\*\* معنی دقیق نمونه/);
    assert.match(result.stdout, /sample \\`pattern\\`/);
    assert.match(result.stdout, /a-gb\.mp3/);
    assert.match(result.stdout, /a-us\.mp3/);
    assert.match(result.stdout, /\*\*Reserved held-out candidate\*\*/);
    assert.match(result.stdout, /held-out/);
    assert.match(result.stdout, /Learner-visible task support/);
    assert.match(
      result.stdout,
      /npm run content:approve -- --entry lex:A1:a@version-a --bilingual approved/,
    );
    assert.doesNotMatch(result.stdout, /lex:A1:b@version-b/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("review queue rejects conflicting output modes", () => {
  const root = fixture();
  try {
    const result = run(root, ["--packet", "--json"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /choose only one output mode: --json, --packet|choose only one output mode: --packet, --json/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("unknown unit is rejected", () => {
  const root = fixture();
  try {
    const result = run(root, ["--unit", "99-missing"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown curriculum unit 99-missing/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("unit selection cannot be combined with a named scope", () => {
  const root = fixture();
  try {
    const result = run(root, [
      "--unit",
      "02-family-home",
      "--scope",
      "all-a1",
    ]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--unit cannot be combined with --scope/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("check mode validates the selected queue without requiring approvals", () => {
  const root = fixture({ withLedger: false });
  try {
    const result = run(root, ["--scope", "calibration", "--check"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout,
      /Review queue OK: calibration 2 entries; 1 full audio; 0 current, 0 stale and 2 missing review record/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("invalid scope is rejected", () => {
  const root = fixture();
  try {
    const result = run(root, ["--scope", "later"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--scope must be one of calibration, pilot, all-a1/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
