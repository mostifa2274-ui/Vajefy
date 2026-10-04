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
const HEADWORDS = [
  "alpha",
  "beta",
  "gamma",
  "delta",
  "epsilon",
  "zeta",
  "eta",
  "theta",
  "iota",
  "kappa",
  "lambda",
  "mu",
  "nu",
  "xi",
  "omicron",
  "pi",
  "rho",
  "sigma",
  "tau",
  "upsilon",
];

type FixtureOptions = {
  packetIds?: string[];
  curriculumIds?: string[];
  curriculumUnitIds?: string[];
  curriculumPrerequisites?: Record<string, string[]>;
  checks?: number;
  exampleText?: Record<string, string>;
  extraEntries?: { id: string; headword: string }[];
  languageExceptions?: Record<string, { token: string; reason: string }[]>;
  headwordOverrides?: Record<string, string>;
  checkText?: Record<string, string>;
  checkSupport?: Record<string, { en: string; fa: string }[]>;
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
  const curriculumUnitIds = options.curriculumUnitIds ?? curriculumIds;
  const allIds = [
    ...new Set([...packetIds, ...curriculumIds, ...curriculumUnitIds]),
  ];
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
          ...(options.languageExceptions?.[id]
            ? { languageExceptions: options.languageExceptions[id] }
            : {}),
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
        entries: curriculumUnitIds.map((id) => ({
          id,
          prerequisites: options.curriculumPrerequisites?.[id] ?? [],
        })),
      },
    ],
    calibrationSlice: { unit: "01-test", entries: curriculumIds },
  });

  const fixtureHeadword = (id: string): string => {
    const override = options.headwordOverrides?.[id];
    if (override) return override;
    const index = IDS.indexOf(id);
    return index >= 0 ? HEADWORDS[index] : id.slice("lex:A1:".length);
  };
  const entries = [
    ...allIds.map((id) => {
      const senseId = `${id}#1`;
      const example = options.exampleText?.[id];
      return {
        id,
        headword: fixtureHeadword(id),
        level: "A1",
        version: "fixture-v1",
        released: false,
        senses: [
          {
            id: senseId,
            pos: "noun",
            gloss: "آزمون",
            examples: example ? [{ en: example, fa: "آزمون" }] : [],
            check: Array.from({ length: checkCount }, (_, index) => ({
              id: `${senseId}:check-${index + 1}`,
              type: "cloze",
              text: options.checkText?.[id] ?? "___",
              answer: "alpha",
              accept: [],
              fa: "آزمون",
              why: "آزمون",
              support: options.checkSupport?.[id],
            })),
          },
        ],
      };
    }),
    ...(options.extraEntries ?? []).map((extra) => ({
      id: extra.id,
      headword: extra.headword,
      level: "A1",
      version: "fixture-v1",
      released: false,
      senses: [
        {
          id: `${extra.id}#1`,
          pos: "noun",
          gloss: "آزمون",
          examples: [],
          check: [],
        },
      ],
    })),
  ];
  writeJson(root, "content/compiled/enhanced.json", {
    version: "fixture-v1",
    entries,
    audio: Object.fromEntries(
      entries.map((entry) => [
        entry.senses[0].id,
        {
          gb: {
            word: "gb.mp3",
            examples: entry.senses[0].examples.map(() => "gb-example.mp3"),
          },
          us: {
            word: "us.mp3",
            examples: entry.senses[0].examples.map(() => "us-example.mp3"),
          },
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

test("the reviewer packet cannot reorder the canonical curriculum slice", () => {
  const reordered = [...IDS];
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  const root = makeFixture({ packetIds: reordered });
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

test("the canonical slice must agree with its curriculum unit", () => {
  const reordered = [...IDS];
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  const root = makeFixture({ curriculumUnitIds: reordered });
  try {
    const result = runCalibration(root);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /curriculum calibration slice order must exactly match its unit entries/,
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

for (const scenario of [
  {
    name: "a self prerequisite",
    prerequisites: { [IDS[1]]: [IDS[1]] },
    error: /must be introduced earlier/,
  },
  {
    name: "a forward prerequisite",
    prerequisites: { [IDS[1]]: [IDS[2]] },
    error: /must be introduced earlier/,
  },
  {
    name: "a prerequisite outside the slice",
    prerequisites: { [IDS[1]]: ["lex:A1:outside"] },
    error: /is outside the 20-entry slice/,
  },
]) {
  test(`the canonical curriculum rejects ${scenario.name}`, () => {
    const root = makeFixture({
      curriculumPrerequisites: scenario.prerequisites,
    });
    try {
      const result = runCalibration(root);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, scenario.error);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

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


test("the learner-language audit distinguishes future, outside-slice, proper-name and external dependencies", () => {
  const root = makeFixture({
    exampleText: {
      [IDS[0]]: "beta outside Zara mystery.",
    },
    extraEntries: [{ id: "lex:A1:outside", headword: "outside" }],
  });
  try {
    const result = runCalibration(root, "--json");
    assert.equal(result.status, 0, result.stderr);
    const packet = JSON.parse(result.stdout) as {
      entries: {
        id: string;
        language: {
          dependencies: {
            token: string;
            status: string;
            entryId?: string;
          }[];
          unresolved: number;
        };
      }[];
    };
    const language = packet.entries[0].language;
    assert.equal(language.unresolved, 4);
    assert.deepEqual(
      language.dependencies.map((item) => [
        item.token,
        item.status,
        item.entryId ?? null,
      ]),
      [
        ["mystery", "external", null],
        ["outside", "outside-slice", "lex:A1:outside"],
        ["Zara".toLowerCase(), "proper-name-candidate", null],
        ["beta", "future", IDS[1]],
      ].sort((a, b) => `${a[1]}:${a[0]}`.localeCompare(`${b[1]}:${b[0]}`)),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("strict language mode fails while learner-language dependencies are unresolved", () => {
  const root = makeFixture({
    exampleText: { [IDS[0]]: "mystery" },
  });
  try {
    const result = runCalibration(root, "--strict-language");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /language gate failed: 1 unresolved/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a documented language exception needs a rationale and can satisfy the strict gate", () => {
  const root = makeFixture({
    exampleText: { [IDS[0]]: "mystery" },
    languageExceptions: {
      [IDS[0]]: [
        {
          token: "mystery",
          reason: "Fixture-only unavoidable external token.",
        },
      ],
    },
  });
  try {
    const result = runCalibration(root, "--strict-language");
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("stale language exceptions are rejected instead of silently accumulating", () => {
  const root = makeFixture({
    languageExceptions: {
      [IDS[0]]: [{ token: "ghost", reason: "Should be used." }],
    },
  });
  try {
    const result = runCalibration(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /language exception ghost is stale/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("comma-separated headword variants resolve as real A1 aliases", () => {
  const root = makeFixture({
    headwordOverrides: { [IDS[0]]: "a, an" },
    exampleText: { [IDS[1]]: "an" },
  });
  try {
    const result = runCalibration(root, "--json");
    assert.equal(result.status, 0, result.stderr);
    const packet = JSON.parse(result.stdout) as {
      entries: { id: string; language: { unresolved: number } }[];
    };
    assert.equal(packet.entries[1].language.unresolved, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("sense labels containing slash characters do not hide the base headword", () => {
  const root = makeFixture({
    headwordOverrides: { [IDS[0]]: "like (find sb/sth pleasant)" },
    exampleText: { [IDS[1]]: "like" },
  });
  try {
    const result = runCalibration(root, "--json");
    assert.equal(result.status, 0, result.stderr);
    const packet = JSON.parse(result.stdout) as {
      entries: { id: string; language: { unresolved: number } }[];
    };
    assert.equal(packet.entries[1].language.unresolved, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("strict task language ignores prose-only debt but fails on authored-check debt", () => {
  const proseRoot = makeFixture({
    exampleText: { [IDS[0]]: "mystery" },
  });
  try {
    const proseResult = runCalibration(proseRoot, "--strict-tasks");
    assert.equal(proseResult.status, 0, proseResult.stderr);
  } finally {
    rmSync(proseRoot, { recursive: true, force: true });
  }

  const taskRoot = makeFixture({
    checkText: { [IDS[0]]: "mystery ___" },
  });
  try {
    const taskResult = runCalibration(taskRoot, "--strict-tasks");
    assert.notEqual(taskResult.status, 0);
    assert.match(taskResult.stderr, /task-language gate failed: 1 unresolved/);
  } finally {
    rmSync(taskRoot, { recursive: true, force: true });
  }
});


test("learner-visible support resolves authored-task debt without creating an exception", () => {
  const root = makeFixture({
    checkText: { [IDS[0]]: "mystery ___" },
    checkSupport: {
      [IDS[0]]: [{ en: "mystery", fa: "واژهٔ کمکی آزمایشی" }],
    },
  });
  try {
    const strict = runCalibration(root, "--strict-tasks");
    assert.equal(strict.status, 0, strict.stderr);

    const json = runCalibration(root, "--json");
    assert.equal(json.status, 0, json.stderr);
    const packet = JSON.parse(json.stdout) as {
      summary: {
        taskLanguageUnresolved: number;
        taskLanguageScaffolded: number;
        languageExceptions: number;
      };
    };
    assert.equal(packet.summary.taskLanguageUnresolved, 0);
    assert.equal(packet.summary.taskLanguageScaffolded, 1);
    assert.equal(packet.summary.languageExceptions, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("stale task support is rejected instead of hiding unrelated vocabulary", () => {
  const root = makeFixture({
    checkText: { [IDS[0]]: "mystery ___" },
    checkSupport: {
      [IDS[0]]: [{ en: "ghost", fa: "واژهٔ ناموجود" }],
    },
  });
  try {
    const result = runCalibration(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /task support "ghost" is stale/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("task support cannot expose the current target", () => {
  const root = makeFixture({
    checkText: { [IDS[0]]: "alpha ___" },
    checkSupport: {
      [IDS[0]]: [{ en: "alpha", fa: "نباید پاسخ را لو بدهد" }],
    },
  });
  try {
    const result = runCalibration(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /exposes the current target/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
