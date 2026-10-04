import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const REPOSITORY_ROOT = process.cwd();
const CALIBRATION_SCRIPT = path.join(
  REPOSITORY_ROOT,
  "scripts",
  "a1-calibration.ts",
);
const TYPESCRIPT_REGISTER = path.join(
  REPOSITORY_ROOT,
  "scripts",
  "ts-test-register.mjs",
);
const IDS = Array.from(
  { length: 20 },
  (_, index) => `lex:A1:word-${index + 1}`,
);

type FixtureOptions = {
  packetIds?: string[];
  curriculumIds?: string[];
  curriculumPrerequisites?: Record<string, string[]>;
  checks?: number;
};

function writeJson(root: string, relative: string, value: unknown): void {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function makeFixture(options: FixtureOptions = {}): string {
  const root = mkdtempSync(path.join(tmpdir(), "vajefy-a1-calibration-"));
  const packetIds = options.packetIds ?? IDS;
  const curriculumIds = options.curriculumIds ?? IDS;
  const allIds = [...new Set([...packetIds, ...curriculumIds])];
  const checkCount = options.checks ?? 3;

  writeJson(root, "content/calibration/a1-20.json", {
    version: 1,
    title: "Test calibration",
    description: "Fixture",
    units: [
      {
        id: "test-unit",
        title: "Test unit",
        goal: "Test the contract.",
        patterns: ["test"],
        recycles: [],
        entries: packetIds.map((id) => ({
          id,
          objective: `Teach ${id}.`,
          prerequisites: [],
        })),
      },
    ],
  });
  writeJson(root, "content/curriculum/A1.json", {
    version: 1,
    level: "A1",
    units: [
      {
        id: "01-test",
        titleEn: "Test",
        titleFa: "آزمون",
        status: "calibration",
        objectiveEn: "Test",
        objectiveFa: "آزمون",
        entries: curriculumIds.map((id) => ({
          id,
          prerequisites: options.curriculumPrerequisites?.[id] ?? [],
        })),
      },
    ],
    calibrationSlice: { unit: "01-test", entries: curriculumIds },
  });

  const entries = allIds.map((id) => {
    const senseId = `${id}#1`;
    return {
      id,
      headword: id.slice("lex:A1:".length),
      level: "A1",
      version: "fixture-v1",
      released: false,
      senses: [
        {
          id: senseId,
          pos: "noun",
          gloss: "آزمون",
          examples: [],
          check: Array.from({ length: checkCount }, (_, index) => ({
            id: `${senseId}:check-${index + 1}`,
            type: "choice",
          })),
        },
      ],
    };
  });
  writeJson(root, "content/compiled/enhanced.json", {
    version: "fixture-v1",
    entries,
    audio: Object.fromEntries(
      entries.map((entry) => [
        entry.senses[0].id,
        {
          gb: { word: "gb.mp3", examples: [] },
          us: { word: "us.mp3", examples: [] },
        },
      ]),
    ),
    contrasts: [],
    scenes: [],
  });

  return root;
}

function runCalibration(root: string, mode = "--check") {
  return spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--no-warnings",
      "--import",
      TYPESCRIPT_REGISTER,
      CALIBRATION_SCRIPT,
      mode,
    ],
    { cwd: root, encoding: "utf8" },
  );
}

test("the reviewer packet must use the canonical curriculum calibration slice", () => {
  const root = makeFixture({
    packetIds: [...IDS.slice(0, -1), "lex:A1:other"],
  });
  try {
    const result = runCalibration(root);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /must exactly match the curriculum calibration slice/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("every calibration sense keeps two lesson checks before its held-out assessment", () => {
  const root = makeFixture({ checks: 2 });
  try {
    const result = runCalibration(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /needs at least 3 checks/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the reviewer packet gets prerequisites from the canonical curriculum", () => {
  const root = makeFixture({ curriculumPrerequisites: { [IDS[1]]: [IDS[0]] } });
  try {
    const result = runCalibration(root, "--json");
    assert.equal(result.status, 0, result.stderr);
    const packet = JSON.parse(result.stdout) as {
      entries: { id: string; prerequisites: string[] }[];
    };
    assert.deepEqual(packet.entries[1].prerequisites, [IDS[0]]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an aligned three-check calibration packet passes the structural gate", () => {
  const root = makeFixture();
  try {
    const result = runCalibration(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /A1 calibration OK: 20 entries, 20 senses/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
