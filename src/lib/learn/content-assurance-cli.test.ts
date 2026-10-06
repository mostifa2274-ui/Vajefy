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
    headword: "cat",
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

test("tasks may only use vocabulary the learner has met, glossed support or documented exceptions", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "vajefy-frontier-"));
  try {
    mkdirSync(path.join(dir, "content", "pilot", "entries"), { recursive: true });
    mkdirSync(path.join(dir, "content", "curriculum"), { recursive: true });
    const word = (id: string, headword: string, check: unknown[], extraSenses = 0) => ({
      id: `lex:A1:${id}`,
      headword,
      senses: Array.from({ length: 1 + extraSenses }, (_, index) => ({
        ...entry(3).senses[0],
        id: `lex:A1:${id}#${index + 1}`,
        check: index === 0 ? check : [{ type: "cloze", id: "c9", text: "I ___ a dog.", answer: "see", fa: "می‌بینم", why: "چون" }],
      })),
    });
    const cloze = (id: string, text: string, support?: { en: string; fa: string }[]) => ({
      type: "cloze",
      id,
      text,
      answer: "x",
      fa: "ترجمه",
      why: "چون",
      ...(support ? { support } : {}),
    });
    writeFileSync(
      path.join(dir, "content", "pilot", "entries", "a.json"),
      JSON.stringify([
        word("i", "I", []),
        word("see", "see", [
          cloze("c1", "I ___ the dog."),
          cloze("c2", "I ___ the dog.", [{ en: "dog", fa: "سگ" }]),
          cloze("c3", "A: I ___ it. B: Me too. I saw Tehran."),
          {
            type: "choice",
            id: "c4",
            prompt: "Choose:",
            options: [
              { text: "I see", ok: true, why: "درست" },
              { text: "I seed", ok: false, why: "غلط" },
              { text: "I dog", ok: false, why: "غلط" },
            ],
          },
        ], 1),
        word("the", "the", []),
        word("dog", "dog", []),
      ]),
    );
    writeFileSync(
      path.join(dir, "content", "curriculum", "A1.json"),
      JSON.stringify({
        units: [
          { id: "u1", entries: [{ id: "lex:A1:i" }, { id: "lex:A1:see" }, { id: "lex:A1:the" }] },
          { id: "u2", entries: [{ id: "lex:A1:dog" }] },
        ],
      }),
    );
    writeFileSync(
      path.join(dir, "content", "pilot", "scenes.json"),
      JSON.stringify([
        {
          id: "scene:park",
          targets: ["lex:A1:i", "lex:A1:see#1"],
          lines: [{ speaker: "Mina", en: "I see.", fa: "می‌بینم." }],
          check: [cloze("s1", "Mina can ___ the dog.")],
        },
      ]),
    );
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--no-warnings", "--import", REGISTER, SCRIPT, "--json"],
      { cwd: dir, encoding: "utf8" },
    );
    const report = JSON.parse(result.stdout) as { details: { code: string; where: string; message: string }[] };
    // A scene's tasks may use its speakers' names and anything up to its latest target.
    assert.deepEqual(
      report.details
        .filter((item) => item.code === "FRONTIER_SCENE_VOCABULARY")
        .map((item) => `${item.where} ${item.message.split(";")[0]}`),
      [
        'scene:park.check[0] "can" is not an A1 word',
        'scene:park.check[0] "the" is taught later (lex:A1:the)',
        'scene:park.check[0] "dog" is taught later (lex:A1:dog)',
      ],
    );
    const frontier = report.details
      .filter((item) => item.code === "FRONTIER_TASK_VOCABULARY")
      .map((item) => `${item.where} ${item.message.split(";")[0]}`);
    assert.deepEqual(frontier, [
      // "the" comes after "see" in the curriculum, and "dog" a unit later.
      'lex:A1:see#1.check[0] "the" is taught later (lex:A1:the)',
      'lex:A1:see#1.check[0] "dog" is taught later (lex:A1:dog)',
      // Glossed in support: only "the" remains.
      'lex:A1:see#1.check[1] "the" is taught later (lex:A1:the)',
      // Speaker labels are not words; unknown words and a name are.
      'lex:A1:see#1.check[2] "it" is not an A1 word',
      'lex:A1:see#1.check[2] "me" is not an A1 word',
      'lex:A1:see#1.check[2] "too" is not an A1 word',
      'lex:A1:see#1.check[2] "saw" is not an A1 word',
      'lex:A1:see#1.check[2] "tehran" is not an A1 word',
      // A misspelt distractor is not vocabulary; a later real word is.
      'lex:A1:see#1.check[3] "choose" is not an A1 word',
      'lex:A1:see#1.check[3] "dog" is taught later (lex:A1:dog)',
      // The second sense comes a unit later: all of unit 1 is known, "dog" is not.
      'lex:A1:see#2.check[0] "dog" is taught later (lex:A1:dog)',
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
