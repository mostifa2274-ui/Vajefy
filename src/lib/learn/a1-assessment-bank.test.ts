import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "a1-assessment-bank.ts");
const REGISTER = path.join(ROOT, "scripts", "ts-test-register.mjs");

const A = "lex:A1:a";
const B = "lex:A1:b";
const C = "lex:A1:c";

function writeJson(root: string, relative: string, value: unknown): void {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function check(id: string, type: "choice" | "cloze" | "produce") {
  if (type === "choice") {
    return {
      id,
      type,
      prompt: "Choose.",
      options: [
        { text: "a", ok: true, why: "درست" },
        { text: "b", ok: false, why: "نادرست" },
      ],
    };
  }
  if (type === "cloze") {
    return {
      id,
      type,
      text: "I ___ here.",
      answer: "am",
      accept: [],
      fa: "من اینجا هستم.",
      why: "نمونه",
    };
  }
  return {
    id,
    type,
    prompt: "نمونه را بنویس.",
    frame: "I ___ here.",
    answer: "am",
    accept: [],
    why: "نمونه",
  };
}

function entry(
  id: string,
  version: string,
  heldOutType: "choice" | "cloze" | "produce",
  checks = 3,
) {
  const authored = [
    check(`${id}:teach-1`, "choice"),
    check(`${id}:teach-2`, "cloze"),
    check(`${id}:held-out`, heldOutType),
  ].slice(0, checks);
  return {
    id,
    headword: id.slice("lex:A1:".length),
    version,
    order: 1,
    released: false,
    review: null,
    goals: ["general"],
    senses: [
      {
        id,
        pos: "noun",
        gloss: "نمونه",
        meaning: "معنی نمونه",
        grammar: [{ pattern: "sample", note: "نمونه" }],
        examples: [
          { en: "Example one.", fa: "نمونه یک." },
          { en: "Example two.", fa: "نمونه دو." },
        ],
        collocations: ["sample phrase"],
        mistake: { wrong: "wrong", right: "right", why: "نمونه" },
        pronunciation: { gb: "/a/", us: "/a/" },
        check: authored,
      },
    ],
  };
}

type FixtureOptions = {
  shortEntry?: string;
  planIds?: string[];
};

function fixture(options: FixtureOptions = {}): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "vajefy-a1-assessment-bank-"));
  writeJson(root, "content/compiled/enhanced.json", {
    version: "compiled-v1",
    entries: [
      entry(A, "version-a", "produce", options.shortEntry === A ? 2 : 3),
      entry(B, "version-b", "cloze", options.shortEntry === B ? 2 : 3),
      entry(C, "version-c", "choice", options.shortEntry === C ? 2 : 3),
    ],
    contrasts: [],
    scenes: [],
    audio: {},
    audioPack: {},
  });
  writeJson(root, "content/curriculum/A1.json", {
    level: "A1",
    calibrationSlice: { unit: "01-introductions", entries: [A, B] },
    units: [
      {
        id: "01-introductions",
        titleEn: "Introductions",
        titleFa: "معرفی",
        entries: [{ id: A }, { id: B }],
      },
      {
        id: "02-family-home",
        titleEn: "Family and home",
        titleFa: "خانواده و خانه",
        entries: [{ id: C }],
      },
    ],
  });
  writeJson(root, "content/pilot-a1.json", {
    entries: [{ id: C }, { id: A }],
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

test("calibration bank reserves the final authored item and binds it to the content version", () => {
  const root = fixture();
  try {
    const result = run(root, ["--scope", "calibration", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    const bank = JSON.parse(result.stdout) as {
      scope: string;
      summary: {
        entries: number;
        senses: number;
        readySenses: number;
        missingSenses: number;
        choice: number;
        cloze: number;
        produce: number;
      };
      rows: {
        entryId: string;
        entryVersion: string;
        senseId: string;
        assessmentToken: string | null;
        teachingCheckIds: string[];
        heldOut: { id: string; type: string } | null;
      }[];
    };

    assert.equal(bank.scope, "calibration");
    assert.deepEqual(bank.summary, {
      entries: 2,
      senses: 2,
      readySenses: 2,
      missingSenses: 0,
      choice: 0,
      cloze: 1,
      produce: 1,
    });

    const a = bank.rows.find((row) => row.entryId === A)!;
    assert.equal(a.entryVersion, "version-a");
    assert.equal(a.senseId, A);
    assert.equal(a.heldOut?.id, `${A}:held-out`);
    assert.equal(a.heldOut?.type, "produce");
    assert.equal(
      a.assessmentToken,
      `${A}@version-a/${A}/${A}:held-out`,
    );
    assert.deepEqual(a.teachingCheckIds, [
      `${A}:teach-1`,
      `${A}:teach-2`,
    ]);
    assert.ok(!a.teachingCheckIds.includes(a.heldOut!.id));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("pilot and unit banks follow their declared selection order", () => {
  const root = fixture();
  try {
    const pilot = run(root, ["--scope", "pilot", "--json"]);
    assert.equal(pilot.status, 0, pilot.stderr);
    const pilotBank = JSON.parse(pilot.stdout) as {
      rows: { entryId: string }[];
    };
    assert.deepEqual(
      pilotBank.rows.map((row) => row.entryId),
      [C, A],
    );

    const unit = run(root, ["--unit", "02-family-home", "--json"]);
    assert.equal(unit.status, 0, unit.stderr);
    const unitBank = JSON.parse(unit.stdout) as {
      scope: string;
      rows: { entryId: string; curriculumUnit: string | null }[];
    };
    assert.equal(unitBank.scope, "unit:02-family-home");
    assert.deepEqual(
      unitBank.rows.map((row) => [row.entryId, row.curriculumUnit]),
      [[C, "02-family-home"]],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("all-a1 bank uses curriculum order while requiring exact plan membership", () => {
  const root = fixture({ planIds: [C, B, A] });
  try {
    const result = run(root, ["--scope", "all-a1", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    const bank = JSON.parse(result.stdout) as {
      rows: { entryId: string }[];
      summary: { entries: number };
    };
    assert.equal(bank.summary.entries, 3);
    assert.deepEqual(
      bank.rows.map((row) => row.entryId),
      [A, B, C],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("check mode fails when a selected sense loses its third authored check", () => {
  const root = fixture({ shortEntry: B });
  try {
    const result = run(root, ["--scope", "calibration", "--check"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /assessment bank incomplete: 1\/2 selected sense/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("all-a1 bank rejects curriculum and plan membership drift", () => {
  const root = fixture({ planIds: [A, B] });
  try {
    const result = run(root, ["--scope", "all-a1", "--check"]);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /all-a1 assessment bank must exactly match the A1 plan/,
    );
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

test("invalid scope and unknown unit are rejected", () => {
  const root = fixture();
  try {
    const scope = run(root, ["--scope", "later"]);
    assert.notEqual(scope.status, 0);
    assert.match(
      scope.stderr,
      /--scope must be one of calibration, pilot, all-a1/,
    );

    const unit = run(root, ["--unit", "99-missing"]);
    assert.notEqual(unit.status, 0);
    assert.match(unit.stderr, /unknown curriculum unit 99-missing/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
