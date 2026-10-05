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
const UNIT_THREE = ["lex:A1:unit-three-a", "lex:A1:unit-three-b"];
const UNIT_FOUR = ["lex:A1:unit-four-a", "lex:A1:unit-four-b"];
const UNIT_FIVE = ["lex:A1:unit-five-a", "lex:A1:unit-five-b"];
const UNIT_SIX = ["lex:A1:unit-six-a", "lex:A1:unit-six-b"];
const UNIT_SEVEN = ["lex:A1:unit-seven-a", "lex:A1:unit-seven-b"];
const UNIT_EIGHT = ["lex:A1:unit-eight-a", "lex:A1:unit-eight-b"];
const UNIT_NINE = ["lex:A1:unit-nine-a", "lex:A1:unit-nine-b"];
const UNIT_TEN = ["lex:A1:unit-ten-a", "lex:A1:unit-ten-b"];
const UNIT_ELEVEN = ["lex:A1:unit-eleven-a", "lex:A1:unit-eleven-b"];
const UNIT_TWELVE = ["lex:A1:unit-twelve-a", "lex:A1:unit-twelve-b"];
const A2_VISITOR = "lex:A2:visitor";

type Options = {
  unitTwoIds?: string[];
  unitThreeIds?: string[];
  unitFourIds?: string[];
  unitFiveIds?: string[];
  unitSixIds?: string[];
  unitSevenIds?: string[];
  unitEightIds?: string[];
  unitNineIds?: string[];
  unitTenIds?: string[];
  unitElevenIds?: string[];
  unitTwelveIds?: string[];
  prerequisites?: Record<string, string[]>;
  assignedMinimum?: number;
  targetEntries?: Record<string, number>;
  status?: Record<string, "calibration" | "planned" | "active" | "complete">;
  coverageEntry?: boolean;
  extraLevelEntry?: boolean;
};

function writeJson(root: string, relative: string, value: unknown): void {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(options: Options = {}): string {
  const root = mkdtempSync(path.join(tmpdir(), "vajefy-a1-curriculum-"));
  const unitTwoIds = options.unitTwoIds ?? UNIT_TWO;
  const unitThreeIds = options.unitThreeIds ?? [];
  const unitFourIds = options.unitFourIds ?? [];
  const unitFiveIds = options.unitFiveIds ?? [];
  const unitSixIds = options.unitSixIds ?? [];
  const unitSevenIds = options.unitSevenIds ?? [];
  const unitEightIds = options.unitEightIds ?? [];
  const unitNineIds = options.unitNineIds ?? [];
  const unitTenIds = options.unitTenIds ?? [];
  const unitElevenIds = options.unitElevenIds ?? [];
  const unitTwelveIds = options.unitTwelveIds ?? [];
  const plannedIds = [...CALIBRATION, ...UNIT_TWO, ...UNIT_THREE, ...UNIT_FOUR, ...UNIT_FIVE, ...UNIT_SIX, ...UNIT_SEVEN, ...UNIT_EIGHT, ...UNIT_NINE, ...UNIT_TEN, ...UNIT_ELEVEN, ...UNIT_TWELVE];

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
        status: options.status?.["01-calibration"] ?? "calibration",
        objectiveEn: "Calibrate the sequence.",
        objectiveFa: "توالی را کالیبره کن.",
        targetEntries: options.targetEntries?.["01-calibration"] ?? 20,
        entries: CALIBRATION.map((id) => ({ id, prerequisites: [] })),
      },
      {
        id: "02-family-home",
        titleEn: "Family and home",
        titleFa: "خانواده و خانه",
        status: options.status?.["02-family-home"] ?? "planned",
        objectiveEn: "Continue the curriculum.",
        objectiveFa: "برنامهٔ درسی را ادامه بده.",
        targetEntries: options.targetEntries?.["02-family-home"] ?? 2,
        entries: unitTwoIds.map((id) => ({
          id,
          prerequisites: options.prerequisites?.[id] ?? [],
        })),
      },
      {
        id: "03-daily-routine",
        titleEn: "Daily routine and time",
        titleFa: "برنامهٔ روزانه و زمان",
        status: options.status?.["03-daily-routine"] ?? "planned",
        objectiveEn: "Add a third ordered curriculum unit.",
        objectiveFa: "سومین واحد مرتب برنامهٔ درسی را اضافه کن.",
        targetEntries: options.targetEntries?.["03-daily-routine"] ?? 2,
        entries: unitThreeIds.map((id) => ({
          id,
          prerequisites: options.prerequisites?.[id] ?? [],
        })),
      },
      {
        id: "04-food-drink",
        titleEn: "Food and drink",
        titleFa: "غذا و نوشیدنی",
        status: options.status?.["04-food-drink"] ?? "planned",
        objectiveEn: "Add a fourth ordered curriculum unit.",
        objectiveFa: "چهارمین واحد مرتب برنامهٔ درسی را اضافه کن.",
        targetEntries: options.targetEntries?.["04-food-drink"] ?? 2,
        entries: unitFourIds.map((id) => ({
          id,
          prerequisites: options.prerequisites?.[id] ?? [],
        })),
      },
      {
        id: "05-shopping-money",
        titleEn: "Shopping and money",
        titleFa: "خرید و پول",
        status: options.status?.["05-shopping-money"] ?? "planned",
        objectiveEn: "Add a fifth ordered curriculum unit.",
        objectiveFa: "پنجمین واحد مرتب برنامهٔ درسی را اضافه کن.",
        targetEntries: options.targetEntries?.["05-shopping-money"] ?? 2,
        entries: unitFiveIds.map((id) => ({
          id,
          prerequisites: options.prerequisites?.[id] ?? [],
        })),
      },
      {
        id: "06-places-directions",
        titleEn: "Places and directions",
        titleFa: "مکان‌ها و مسیرها",
        status: options.status?.["06-places-directions"] ?? "planned",
        objectiveEn: "Add a sixth ordered curriculum unit.",
        objectiveFa: "ششمین واحد مرتب برنامهٔ درسی را اضافه کن.",
        targetEntries: options.targetEntries?.["06-places-directions"] ?? 2,
        entries: unitSixIds.map((id) => ({
          id,
          prerequisites: options.prerequisites?.[id] ?? [],
        })),
      },
      {
        id: "07-travel-transport",
        titleEn: "Travel and transport",
        titleFa: "سفر و حمل‌ونقل",
        status: options.status?.["07-travel-transport"] ?? "planned",
        objectiveEn: "Add a seventh ordered curriculum unit.",
        objectiveFa: "هفتمین واحد مرتب برنامهٔ درسی را اضافه کن.",
        targetEntries: options.targetEntries?.["07-travel-transport"] ?? 2,
        entries: unitSevenIds.map((id) => ({
          id,
          prerequisites: options.prerequisites?.[id] ?? [],
        })),
      },
      {
        id: "08-work-study",
        titleEn: "Work and study",
        titleFa: "کار و تحصیل",
        status: options.status?.["08-work-study"] ?? "planned",
        objectiveEn: "Add an eighth ordered curriculum unit.",
        objectiveFa: "هشتمین واحد مرتب برنامهٔ درسی را اضافه کن.",
        targetEntries: options.targetEntries?.["08-work-study"] ?? 2,
        entries: unitEightIds.map((id) => ({
          id,
          prerequisites: options.prerequisites?.[id] ?? [],
        })),
      },
      {
        id: "09-leisure-people",
        titleEn: "Leisure and people",
        titleFa: "اوقات فراغت و آدم‌ها",
        status: options.status?.["09-leisure-people"] ?? "planned",
        objectiveEn: "Add a ninth ordered curriculum unit.",
        objectiveFa: "نهمین واحد مرتب برنامهٔ درسی را اضافه کن.",
        targetEntries: options.targetEntries?.["09-leisure-people"] ?? 2,
        entries: unitNineIds.map((id) => ({
          id,
          prerequisites: options.prerequisites?.[id] ?? [],
        })),
      },
      {
        id: "10-weather-clothes",
        titleEn: "Weather and clothes",
        titleFa: "هوا و لباس",
        status: options.status?.["10-weather-clothes"] ?? "planned",
        objectiveEn: "Add a tenth ordered curriculum unit.",
        objectiveFa: "دهمین واحد مرتب برنامهٔ درسی را اضافه کن.",
        targetEntries: options.targetEntries?.["10-weather-clothes"] ?? 2,
        entries: unitTenIds.map((id) => ({
          id,
          prerequisites: options.prerequisites?.[id] ?? [],
        })),
      },
      {
        id: "11-health-feelings",
        titleEn: "Health and feelings",
        titleFa: "سلامت و احساسات",
        status: options.status?.["11-health-feelings"] ?? "planned",
        objectiveEn: "Add an eleventh ordered curriculum unit.",
        objectiveFa: "یازدهمین واحد مرتب برنامهٔ درسی را اضافه کن.",
        targetEntries: options.targetEntries?.["11-health-feelings"] ?? 2,
        entries: unitElevenIds.map((id) => ({
          id,
          prerequisites: options.prerequisites?.[id] ?? [],
        })),
      },
      {
        id: "12-help-everyday-problems",
        titleEn: "Help and everyday problems",
        titleFa: "کمک و مشکل‌های روزمره",
        status: options.status?.["12-help-everyday-problems"] ?? "planned",
        objectiveEn: "Add a twelfth ordered curriculum unit.",
        objectiveFa: "دوازدهمین واحد مرتب برنامهٔ درسی را اضافه کن.",
        targetEntries: options.targetEntries?.["12-help-everyday-problems"] ?? 2,
        entries: unitTwelveIds.map((id) => ({
          id,
          prerequisites: options.prerequisites?.[id] ?? [],
        })),
      },
    ],
    calibrationSlice: { unit: "01-calibration", entries: CALIBRATION },
  });

  const entries = [
    ...CALIBRATION.map((id) => ({
      id,
      headword: id.slice("lex:A1:".length),
      version: "fixture-v1",
      released: false,
      review: null,
      senses: [
        {
          id,
          examples: [],
          check: [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
        },
      ],
    })),
    ...(options.coverageEntry
      ? [
          {
            id: UNIT_TWO[0],
            headword: "unit two a",
            version: "fixture-v1",
            released: false,
            review: null,
            senses: [
              {
                id: UNIT_TWO[0],
                pos: "verb",
                gloss: "نمونه",
                grammar: [{ pattern: "I ___ at seven.", note: "الگوی نمونه" }],
                examples: [
                  { en: "Example one.", fa: "نمونهٔ یک." },
                  { en: "Example two.", fa: "نمونهٔ دو." },
                ],
                check: [
                  { id: "teach-choice", type: "choice" },
                  { id: "teach-cloze", type: "cloze" },
                  { id: "held-out", type: "produce" },
                ],
              },
            ],
          },
        ]
      : []),
    ...(options.extraLevelEntry
      ? [
          {
            id: A2_VISITOR,
            headword: "visitor",
            version: "fixture-v1",
            released: false,
            review: null,
            senses: [
              {
                id: A2_VISITOR,
                pos: "noun",
                gloss: "مهمان",
                grammar: [
                  { pattern: "a visitor", note: "الگوی سطح بالاتر" },
                ],
                examples: [],
                check: [
                  { id: "a2-choice", type: "choice" },
                  { id: "a2-cloze", type: "cloze" },
                  { id: "a2-produce", type: "produce" },
                ],
              },
            ],
          },
        ]
      : []),
  ];
  const audio = Object.fromEntries(
    entries.map((entry) => [
      entry.id,
      {
        gb: {
          word: "gb.mp3",
          examples: entry.id === UNIT_TWO[0] ? ["gb-1.mp3", "gb-2.mp3"] : [],
        },
        us: {
          word: "us.mp3",
          examples: entry.id === UNIT_TWO[0] ? ["us-1.mp3", null] : [],
        },
      },
    ]),
  );
  writeJson(root, "content/compiled/enhanced.json", {
    version: "fixture-v1",
    entries,
    audio,
    scenes: options.coverageEntry
      ? [
          {
            id: "scene:later",
            targets: [UNIT_TWO[0], UNIT_THREE[0]],
          },
        ]
      : [],
    contrasts: options.coverageEntry
      ? [
          {
            id: "contrast:later",
            entries: [UNIT_TWO[0], UNIT_THREE[0]],
          },
        ]
      : [],
  });
  if (options.coverageEntry) {
    writeJson(root, "content/pilot/audio-report.json", {
      flagged: [{ sense: UNIT_TWO[0] }],
    });
  }

  return root;
}

function run(root: string, args = ["--check"]) {
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

test("the JSON matrix links each sense to evidence without inventing approval", () => {
  const root = fixture({
    unitThreeIds: UNIT_THREE,
    coverageEntry: true,
  });
  try {
    const result = run(root, ["--json"]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    const row = report.senseCoverage.find(
      (item: { senseId: string }) => item.senseId === UNIT_TWO[0],
    );

    assert.deepEqual(row.introduction, {
      unit: "02-family-home",
      unitOrder: 2,
      entryOrder: 1,
      curriculumOrder: 21,
    });
    assert.deepEqual(row.learningDependencies, {
      prerequisiteEntries: [],
      authoredGrammarPatterns: ["I ___ at seven."],
    });
    assert.deepEqual(row.listening, {
      gb: { word: true, exampleClips: 2, examples: 2, complete: true },
      us: { word: true, exampleClips: 1, examples: 2, complete: false },
      complete: false,
      flaggedForHumanListening: true,
    });
    assert.deepEqual(row.contextualPractice, {
      lessonChecks: [
        { id: "teach-choice", type: "choice" },
        { id: "teach-cloze", type: "cloze" },
      ],
      productiveLessonCheck: true,
      scenes: ["scene:later"],
      contrasts: ["contrast:later"],
    });
    assert.deepEqual(row.laterRecyclingCandidates, {
      basis: "later-introduced-co-target",
      scenes: ["scene:later"],
      contrasts: ["contrast:later"],
    });
    assert.deepEqual(row.assessment, {
      reservedCheck: { id: "held-out", type: "produce" },
      authoredChecks: 3,
      lessonOpportunities: 2,
      heldOutReady: true,
    });
    assert.deepEqual(row.content, {
      version: "fixture-v1",
      released: false,
      review: null,
    });
    assert.deepEqual(row.gaps, [
      "incomplete-us-audio",
      "audio-awaiting-human-listening",
      "human-review-unrecorded",
    ]);
    assert.equal(report.summary.senses.total, 21);
    assert.equal(report.summary.senses.introducedWithContextualPractice, 1);
    assert.equal(
      report.summary.senses.introducedWithLaterRecyclingCandidate,
      1,
    );
    assert.equal(report.evidenceBoundary.humanApprovalInferred, false);
    assert.equal(report.evidenceBoundary.resourceTimingInferred, false);
    assert.equal(report.evidenceBoundary.senseIntroductionBasis, "entry");
    assert.equal(report.evidenceBoundary.reviewScope, "entry");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an unassigned co-target is not a later recycling candidate", () => {
  const root = fixture({ coverageEntry: true });
  try {
    const result = run(root, ["--json"]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    const row = report.senseCoverage.find(
      (item: { senseId: string }) => item.senseId === UNIT_TWO[0],
    );

    assert.deepEqual(row.contextualPractice.scenes, ["scene:later"]);
    assert.deepEqual(row.contextualPractice.contrasts, ["contrast:later"]);
    assert.deepEqual(row.laterRecyclingCandidates, {
      basis: "later-introduced-co-target",
      scenes: [],
      contrasts: [],
    });
    assert.ok(row.gaps.includes("no-later-recycling-candidate"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the A1 JSON matrix excludes enhanced senses from other levels", () => {
  const root = fixture({ extraLevelEntry: true });
  try {
    const result = run(root, ["--json"]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);

    assert.equal(report.summary.senses.total, CALIBRATION.length);
    assert.equal(
      report.senseCoverage.some(
        (item: { entryId: string }) => item.entryId === A2_VISITOR,
      ),
      false,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

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
    assert.match(result.stdout, /22\/42 entries assigned \(coverage ratchet 22\)/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a third A1 unit may depend on earlier units and earlier entries in itself", () => {
  const root = fixture({
    unitThreeIds: UNIT_THREE,
    assignedMinimum: 24,
    prerequisites: {
      [UNIT_THREE[0]]: [CALIBRATION[0], UNIT_TWO[0]],
      [UNIT_THREE[1]]: [UNIT_THREE[0], CALIBRATION[1]],
    },
  });
  try {
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout,
      /24\/42 entries assigned \(coverage ratchet 24\)/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a third-unit prerequisite cannot point forward inside that unit", () => {
  const root = fixture({
    unitThreeIds: UNIT_THREE,
    prerequisites: {
      [UNIT_THREE[0]]: [UNIT_THREE[1]],
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

test("a fourth A1 unit may depend on earlier units and earlier entries in itself", () => {
  const root = fixture({
    unitThreeIds: UNIT_THREE,
    unitFourIds: UNIT_FOUR,
    assignedMinimum: 26,
    prerequisites: {
      [UNIT_FOUR[0]]: [CALIBRATION[0], UNIT_THREE[0]],
      [UNIT_FOUR[1]]: [UNIT_FOUR[0], UNIT_TWO[0]],
    },
  });
  try {
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout,
      /26\/42 entries assigned \(coverage ratchet 26\)/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a fourth-unit prerequisite cannot point forward inside that unit", () => {
  const root = fixture({
    unitThreeIds: UNIT_THREE,
    unitFourIds: UNIT_FOUR,
    prerequisites: {
      [UNIT_FOUR[0]]: [UNIT_FOUR[1]],
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

test("a fifth A1 unit may depend on earlier units and earlier entries in itself", () => {
  const root = fixture({
    unitThreeIds: UNIT_THREE,
    unitFourIds: UNIT_FOUR,
    unitFiveIds: UNIT_FIVE,
    assignedMinimum: 28,
    prerequisites: {
      [UNIT_FIVE[0]]: [CALIBRATION[0], UNIT_FOUR[0]],
      [UNIT_FIVE[1]]: [UNIT_FIVE[0], UNIT_THREE[0]],
    },
  });
  try {
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout,
      /28\/42 entries assigned \(coverage ratchet 28\)/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a fifth-unit prerequisite cannot point forward inside that unit", () => {
  const root = fixture({
    unitThreeIds: UNIT_THREE,
    unitFourIds: UNIT_FOUR,
    unitFiveIds: UNIT_FIVE,
    prerequisites: {
      [UNIT_FIVE[0]]: [UNIT_FIVE[1]],
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

test("a sixth A1 unit may depend on earlier units and earlier entries in itself", () => {
  const root = fixture({
    unitThreeIds: UNIT_THREE,
    unitFourIds: UNIT_FOUR,
    unitFiveIds: UNIT_FIVE,
    unitSixIds: UNIT_SIX,
    assignedMinimum: 30,
    prerequisites: {
      [UNIT_SIX[0]]: [CALIBRATION[0], UNIT_FIVE[0]],
      [UNIT_SIX[1]]: [UNIT_SIX[0], UNIT_FOUR[0]],
    },
  });
  try {
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout,
      /30\/42 entries assigned \(coverage ratchet 30\)/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a sixth-unit prerequisite cannot point forward inside that unit", () => {
  const root = fixture({
    unitThreeIds: UNIT_THREE,
    unitFourIds: UNIT_FOUR,
    unitFiveIds: UNIT_FIVE,
    unitSixIds: UNIT_SIX,
    prerequisites: {
      [UNIT_SIX[0]]: [UNIT_SIX[1]],
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

test("a seventh A1 unit may depend on earlier units and earlier entries in itself", () => {
  const root = fixture({
    unitThreeIds: UNIT_THREE,
    unitFourIds: UNIT_FOUR,
    unitFiveIds: UNIT_FIVE,
    unitSixIds: UNIT_SIX,
    unitSevenIds: UNIT_SEVEN,
    assignedMinimum: 32,
    prerequisites: {
      [UNIT_SEVEN[0]]: [CALIBRATION[0], UNIT_SIX[0]],
      [UNIT_SEVEN[1]]: [UNIT_SEVEN[0], UNIT_FIVE[0]],
    },
  });
  try {
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout,
      /32\/42 entries assigned \(coverage ratchet 32\)/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a seventh-unit prerequisite cannot point forward inside that unit", () => {
  const root = fixture({
    unitThreeIds: UNIT_THREE,
    unitFourIds: UNIT_FOUR,
    unitFiveIds: UNIT_FIVE,
    unitSixIds: UNIT_SIX,
    unitSevenIds: UNIT_SEVEN,
    prerequisites: {
      [UNIT_SEVEN[0]]: [UNIT_SEVEN[1]],
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

test("an eighth A1 unit may depend on earlier units and earlier entries in itself", () => {
  const root = fixture({
    unitThreeIds: UNIT_THREE,
    unitFourIds: UNIT_FOUR,
    unitFiveIds: UNIT_FIVE,
    unitSixIds: UNIT_SIX,
    unitSevenIds: UNIT_SEVEN,
    unitEightIds: UNIT_EIGHT,
    assignedMinimum: 34,
    prerequisites: {
      [UNIT_EIGHT[0]]: [CALIBRATION[0], UNIT_SEVEN[0]],
      [UNIT_EIGHT[1]]: [UNIT_EIGHT[0], UNIT_FIVE[0]],
    },
  });
  try {
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout,
      /34\/42 entries assigned \(coverage ratchet 34\)/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an eighth-unit prerequisite cannot point forward inside that unit", () => {
  const root = fixture({
    unitThreeIds: UNIT_THREE,
    unitFourIds: UNIT_FOUR,
    unitFiveIds: UNIT_FIVE,
    unitSixIds: UNIT_SIX,
    unitSevenIds: UNIT_SEVEN,
    unitEightIds: UNIT_EIGHT,
    prerequisites: {
      [UNIT_EIGHT[0]]: [UNIT_EIGHT[1]],
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

test("a ninth A1 unit may depend on earlier units and earlier entries in itself", () => {
  const root = fixture({
    unitThreeIds: UNIT_THREE,
    unitFourIds: UNIT_FOUR,
    unitFiveIds: UNIT_FIVE,
    unitSixIds: UNIT_SIX,
    unitSevenIds: UNIT_SEVEN,
    unitEightIds: UNIT_EIGHT,
    unitNineIds: UNIT_NINE,
    assignedMinimum: 36,
    prerequisites: {
      [UNIT_NINE[0]]: [CALIBRATION[0], UNIT_EIGHT[0]],
      [UNIT_NINE[1]]: [UNIT_NINE[0], UNIT_FIVE[0]],
    },
  });
  try {
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout,
      /36\/42 entries assigned \(coverage ratchet 36\)/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a ninth-unit prerequisite cannot point forward inside that unit", () => {
  const root = fixture({
    unitThreeIds: UNIT_THREE,
    unitFourIds: UNIT_FOUR,
    unitFiveIds: UNIT_FIVE,
    unitSixIds: UNIT_SIX,
    unitSevenIds: UNIT_SEVEN,
    unitEightIds: UNIT_EIGHT,
    unitNineIds: UNIT_NINE,
    prerequisites: {
      [UNIT_NINE[0]]: [UNIT_NINE[1]],
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

test("a tenth A1 unit may depend on earlier units and earlier entries in itself", () => {
  const root = fixture({
    unitThreeIds: UNIT_THREE,
    unitFourIds: UNIT_FOUR,
    unitFiveIds: UNIT_FIVE,
    unitSixIds: UNIT_SIX,
    unitSevenIds: UNIT_SEVEN,
    unitEightIds: UNIT_EIGHT,
    unitNineIds: UNIT_NINE,
    unitTenIds: UNIT_TEN,
    assignedMinimum: 38,
    prerequisites: {
      [UNIT_TEN[0]]: [CALIBRATION[0], UNIT_NINE[0]],
      [UNIT_TEN[1]]: [UNIT_TEN[0], UNIT_FIVE[0]],
    },
  });
  try {
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout,
      /38\/42 entries assigned \(coverage ratchet 38\)/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a tenth-unit prerequisite cannot point forward inside that unit", () => {
  const root = fixture({
    unitThreeIds: UNIT_THREE,
    unitFourIds: UNIT_FOUR,
    unitFiveIds: UNIT_FIVE,
    unitSixIds: UNIT_SIX,
    unitSevenIds: UNIT_SEVEN,
    unitEightIds: UNIT_EIGHT,
    unitNineIds: UNIT_NINE,
    unitTenIds: UNIT_TEN,
    prerequisites: {
      [UNIT_TEN[0]]: [UNIT_TEN[1]],
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

test("an eleventh A1 unit may depend on earlier units and earlier entries in itself", () => {
  const root = fixture({
    unitThreeIds: UNIT_THREE,
    unitFourIds: UNIT_FOUR,
    unitFiveIds: UNIT_FIVE,
    unitSixIds: UNIT_SIX,
    unitSevenIds: UNIT_SEVEN,
    unitEightIds: UNIT_EIGHT,
    unitNineIds: UNIT_NINE,
    unitTenIds: UNIT_TEN,
    unitElevenIds: UNIT_ELEVEN,
    assignedMinimum: 40,
    prerequisites: {
      [UNIT_ELEVEN[0]]: [CALIBRATION[0], UNIT_TEN[0]],
      [UNIT_ELEVEN[1]]: [UNIT_ELEVEN[0], UNIT_FIVE[0]],
    },
  });
  try {
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout,
      /40\/42 entries assigned \(coverage ratchet 40\)/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an eleventh-unit prerequisite cannot point forward inside that unit", () => {
  const root = fixture({
    unitThreeIds: UNIT_THREE,
    unitFourIds: UNIT_FOUR,
    unitFiveIds: UNIT_FIVE,
    unitSixIds: UNIT_SIX,
    unitSevenIds: UNIT_SEVEN,
    unitEightIds: UNIT_EIGHT,
    unitNineIds: UNIT_NINE,
    unitTenIds: UNIT_TEN,
    unitElevenIds: UNIT_ELEVEN,
    prerequisites: {
      [UNIT_ELEVEN[0]]: [UNIT_ELEVEN[1]],
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

test("a twelfth A1 unit may depend on earlier units and earlier entries in itself", () => {
  const root = fixture({
    unitThreeIds: UNIT_THREE,
    unitFourIds: UNIT_FOUR,
    unitFiveIds: UNIT_FIVE,
    unitSixIds: UNIT_SIX,
    unitSevenIds: UNIT_SEVEN,
    unitEightIds: UNIT_EIGHT,
    unitNineIds: UNIT_NINE,
    unitTenIds: UNIT_TEN,
    unitElevenIds: UNIT_ELEVEN,
    unitTwelveIds: UNIT_TWELVE,
    assignedMinimum: 42,
    prerequisites: {
      [UNIT_TWELVE[0]]: [CALIBRATION[0], UNIT_ELEVEN[0]],
      [UNIT_TWELVE[1]]: [UNIT_TWELVE[0], UNIT_FIVE[0]],
    },
  });
  try {
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout,
      /42\/42 entries assigned \(coverage ratchet 42\)/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a twelfth-unit prerequisite cannot point forward inside that unit", () => {
  const root = fixture({
    unitThreeIds: UNIT_THREE,
    unitFourIds: UNIT_FOUR,
    unitFiveIds: UNIT_FIVE,
    unitSixIds: UNIT_SIX,
    unitSevenIds: UNIT_SEVEN,
    unitEightIds: UNIT_EIGHT,
    unitNineIds: UNIT_NINE,
    unitTenIds: UNIT_TEN,
    unitElevenIds: UNIT_ELEVEN,
    unitTwelveIds: UNIT_TWELVE,
    prerequisites: {
      [UNIT_TWELVE[0]]: [UNIT_TWELVE[1]],
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

test("unit targets must sum to the canonical A1 plan size", () => {
  const root = fixture({
    targetEntries: { "12-help-everyday-problems": 3 },
  });
  try {
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /unit targetEntries must sum to the canonical plan size 42, found 43/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a unit cannot contain more entries than its final target", () => {
  const root = fixture({
    targetEntries: { "02-family-home": 1, "12-help-everyday-problems": 3 },
  });
  try {
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /02-family-home: has 2 entries but targetEntries is 1/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a complete unit must actually fill its final target", () => {
  const root = fixture({
    unitThreeIds: [UNIT_THREE[0]],
    status: { "03-daily-routine": "complete" },
  });
  try {
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /03-daily-routine: status complete requires exactly 2 entries, found 1/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the fixed calibration unit target must remain exactly 20", () => {
  const root = fixture({
    targetEntries: { "01-calibration": 21, "12-help-everyday-problems": 1 },
  });
  try {
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /calibration unit targetEntries must equal the fixed slice length 20, found 21/,
    );
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
