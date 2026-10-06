import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "content-assurance.ts");
const REGISTER = path.join(ROOT, "scripts", "ts-test-register.mjs");

/** One A1 sense whose only findings are a short example list and missing mistake translations. */
function entry(examples: number) {
  return {
    id: "lex:A1:cat",
    senses: [
      {
        id: "lex:A1:cat#1",
        pos: "noun",
        gloss: "گربه",
        meaning: "یک حیوان خانگی",
        grammar: [],
        examples: Array.from({ length: examples }, (_, index) => ({
          en: `I see cat number ${index + 1}.`,
          fa: `من گربه شماره ${index + 1} را می‌بینم.`,
        })),
        mistake: { wrong: "a cats", right: "a cat", why: "بعد از a اسم مفرد می‌آید." },
        check: [],
      },
    ],
  };
}

function workspace(examples: number, maximumByCode: Record<string, number>) {
  const dir = mkdtempSync(path.join(tmpdir(), "vajefy-assurance-"));
  mkdirSync(path.join(dir, "content", "pilot", "entries"), { recursive: true });
  mkdirSync(path.join(dir, "content", "assurance"), { recursive: true });
  writeFileSync(
    path.join(dir, "content", "pilot", "entries", "a.json"),
    JSON.stringify([entry(examples)]),
  );
  writeFileSync(
    path.join(dir, "content", "assurance", "deterministic-baseline.json"),
    JSON.stringify({
      schemaVersion: 1,
      recordedAgainst: "test",
      evidence: "test",
      maximumByCode,
    }),
  );
  return dir;
}

function run(dir: string, flag: string) {
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--no-warnings", "--import", REGISTER, SCRIPT, flag],
    { cwd: dir, encoding: "utf8", env: { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(dir) } },
  );
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

function baseline(dir: string): Record<string, number> {
  return JSON.parse(
    readFileSync(path.join(dir, "content", "assurance", "deterministic-baseline.json"), "utf8"),
  ).maximumByCode;
}

const CURRENT = {
  EXAMPLE_COUNT: 1,
  MISTAKE_RIGHT_FA_MISSING: 1,
  MISTAKE_WRONG_FA_MISSING: 1,
};

test("the ratchet passes when every code is at its recorded maximum", () => {
  const dir = workspace(2, CURRENT);
  try {
    const { status, output } = run(dir, "--ratchet");
    assert.equal(status, 0, output);
    assert.match(output, /every finding code is at its recorded maximum/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a finding code missing from the baseline is bounded at zero", () => {
  const dir = workspace(2, { EXAMPLE_COUNT: 1, MISTAKE_WRONG_FA_MISSING: 1 });
  try {
    const { status, output } = run(dir, "--ratchet");
    assert.equal(status, 1);
    assert.match(output, /MISTAKE_RIGHT_FA_MISSING: 1 > 0/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a fixed defect must be recorded so the gain cannot be lost", () => {
  const dir = workspace(3, CURRENT);
  try {
    const { status, output } = run(dir, "--ratchet");
    assert.equal(status, 1);
    assert.match(output, /EXAMPLE_COUNT: 0 < 1/);
    assert.match(output, /npm run assurance:content:baseline/);

    const update = run(dir, "--update-baseline");
    assert.equal(update.status, 0, update.output);
    assert.match(update.output, /EXAMPLE_COUNT 1 -> 0/);
    assert.equal(baseline(dir).EXAMPLE_COUNT, 0);
    assert.equal(run(dir, "--ratchet").status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("updating the baseline refuses to raise a maximum", () => {
  const dir = workspace(2, { ...CURRENT, EXAMPLE_COUNT: 0 });
  try {
    const { status, output } = run(dir, "--update-baseline");
    assert.equal(status, 1);
    assert.match(output, /EXAMPLE_COUNT: 1 > 0/);
    assert.match(output, /only shrinks/);
    assert.equal(baseline(dir).EXAMPLE_COUNT, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("malformed Unicode, direction controls and Persian in English fields are reported", () => {
  const dir = workspace(3, {});
  try {
    const file = path.join(dir, "content", "pilot", "entries", "a.json");
    const [cat] = JSON.parse(readFileSync(file, "utf8"));
    const sense = cat.senses[0];
    sense.gloss = "‫گربه‬";
    sense.meaning = "یک حیوان� خانگی";
    sense.examples[0].en = "I see a cat (گربه).";
    sense.mistake.wrong = "a cats";
    sense.collocations = ["café cat"];
    writeFileSync(file, JSON.stringify([cat]));
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--no-warnings", "--import", REGISTER, SCRIPT, "--json"],
      { cwd: dir, encoding: "utf8" },
    );
    const report = JSON.parse(result.stdout) as {
      byCode: Record<string, number>;
      details: { code: string; where: string }[];
    };
    assert.equal(report.byCode.BIDI_CONTROL, 1);
    assert.equal(report.byCode.MALFORMED_UNICODE, 1);
    assert.equal(report.byCode.UNICODE_NOT_NFC, 1);
    assert.deepEqual(
      report.details.filter((item) => item.code === "PERSIAN_IN_ENGLISH").map((item) => item.where),
      ["lex:A1:cat#1.examples[0].en"],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
