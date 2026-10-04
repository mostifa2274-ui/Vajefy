import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "curriculum-a1.ts");
const REGISTER = path.join(ROOT, "scripts", "ts-test-register.mjs");
const CALIBRATION = Array.from(
  { length: 20 },
  (_, index) => `lex:A1:cal-${index + 1}`,
);
const UNIT_TWO = ["lex:A1:unit-two-a", "lex:A1:unit-two-b"];

type Options = {
  unitTwoIds?: string[];
  prerequisites?: Record<string, string[]>;
  assignedMinimum?: number;
};

function writeJson(root: string, relative: string, value: unknown): void {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(options: Options = {}): string {
  const root = mkdtempSync(path.join(tmpdir(), "vajefy-a1-curriculum-"));
  const unitTwoIds = options.unitTwoIds ?? UNIT_TWO;
  const plannedIds = [...CALIBRATION, ...UNIT_TWO];

  writeJson(root, "content/plans/A1.json", {
    level: "A1",
    batches: [
      {
        id: "pilot",
        entries: plannedIds.map((id) => ({
          id,
          headword: id.slice("lex:A1:".length),
        })),
      },
    ],
  });

  writeJson(root, "content/curriculum/A1.json", {
    version: 1,
    level: "A1",
    assignedMinimum: options.assignedMinimum ?? 0,
    units: [
      {
        id: "01-calibration",
        titleEn: "Calibration",
        titleFa: "کالیبراسیون",
        status: "calibration",
        objectiveEn: "Calibrate the sequence.",
        objectiveFa: "توالی را کالیبره کن.",
        entries: CALIBRATION.map((id) => ({ id, prerequisites: [] })),
      },
      {
        id: "02-family-home",
        titleEn: "Family and home",
        titleFa: "خانواده و خانه",
        status: "planned",
        objectiveEn: "Continue the curriculum.",
        objectiveFa: "برنامهٔ درسی را ادامه بده.",
        entries: unitTwoIds.map((id) => ({
          id,
          prerequisites: options.prerequisites?.[id] ?? [],
        })),
      },
    ],
    calibrationSlice: { unit: "01-calibration", entries: CALIBRATION },
  });

  const entries = CALIBRATION.map((id) => ({
    id,
    headword: id.slice("lex:A1:".length),
    version: "fixture-v1",
    released: false,
    senses: [
      {
        id,
        examples: [],
        check: [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
      },
    ],
  }));
  writeJson(root, "content/compiled/enhanced.json", {
    version: "fixture-v1",
    entries,
    audio: Object.fromEntries(
      entries.map((entry) => [
        entry.id,
        {
          gb: { word: "gb.mp3", examples: [] },
          us: { word: "us.mp3", examples: [] },
        },
      ]),
    ),
  });

  return root;
}

function run(root: string) {
  return spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--no-warnings",
      "--import",
      REGISTER,
      SCRIPT,
      "--check",
    ],
    { cwd: root, encoding: "utf8" },
  );
}

test("a later A1 unit may depend on entries from an earlier unit", () => {
  const root = fixture({
    assignedMinimum: 22,
    prerequisites: {
      [UNIT_TWO[0]]: [CALIBRATION[0]],
      [UNIT_TWO[1]]: [UNIT_TWO[0], CALIBRATION[1]],
    },
  });
  try {
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /22\/22 entries assigned \(coverage ratchet 22\)/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a prerequisite must still appear earlier in the full curriculum", () => {
  const root = fixture({
    prerequisites: {
      [UNIT_TWO[0]]: [UNIT_TWO[1]],
    },
  });
  try {
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must appear earlier in the curriculum/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the assigned-entry coverage ratchet cannot silently shrink", () => {
  const root = fixture({
    unitTwoIds: [UNIT_TWO[0]],
    assignedMinimum: 22,
  });
  try {
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /requires at least 22 assigned entries, found 21/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
