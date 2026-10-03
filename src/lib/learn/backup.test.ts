import assert from "node:assert/strict";
import test from "node:test";
import { backupFileName, makeBackup, parseBackup } from "./backup";
import { PROGRESS_VERSION, type SavedProgress } from "./progress";

function restored(text: string): SavedProgress | undefined {
  const result = parseBackup(text);
  return result.ok ? result.progress : undefined;
}

const saved: SavedProgress = {
  cards: {
    "lex:A1:about": {
      ease: 2.5,
      interval: 3,
      due: 1_800_000_000_000,
      reps: 2,
      lapses: 0,
      state: "review",
      step: 0,
      last: 1_799_740_800_000,
      fsrs: {
        model: "fsrs6",
        stability: 4.2,
        difficulty: 5.1,
        scheduledDays: 3,
        learningSteps: 0,
        state: "review",
        lastReview: 1_799_740_800_000,
      },
    },
  },
  logs: [{ date: "2026-10-01", reviews: 12, correct: 10, practice: 7, practiceCorrect: 6, introduced: 4 }],
  lifetime: { reviews: 40, correct: 33, practice: 19, practiceCorrect: 16 },
  streak: 4,
  lastStudyDate: "2026-10-01",
  xp: 420,
  lang: "fa",
  focus: "A2",
  sessionSize: 20,
  newPerDay: 10,
  voice: true,
  accent: "en-GB",
  bookmarks: ["lex:A1:about"],
  dailyGoal: 20,
  requestRetention: 0.9,
  reviewHistory: [
    {
      id: "lex:A1:about",
      at: 1_799_740_800_000,
      grade: "good",
      algorithm: "fsrs6",
      targetRetention: 0.9,
      elapsedDays: 3,
      scheduledDays: 3,
      stability: 4.2,
      difficulty: 5.1,
    },
  ],
  practiceSkills: {
    "lex:A1:about": {
      spelling: { attempts: 3, correct: 2, lastAt: 1_799_740_800_000, lastGrade: "good" },
      listening: { attempts: 1, correct: 0, lastAt: 1_799_740_700_000, lastGrade: "again" },
    },
  },
  onboarded: true,
  goal: "work",
  minutes: 15,
};

test("an export file reads back to the same progress", () => {
  assert.deepEqual(parseBackup(makeBackup(saved)), { ok: true, progress: saved });
});

test("a raw v0 localStorage entry imports and is migrated", () => {
  const {
    lifetime: _lifetime,
    accent: _accent,
    requestRetention: _requestRetention,
    reviewHistory: _reviewHistory,
    practiceSkills: _practiceSkills,
    ...v0
  } = saved;
  const legacyLogs = v0.logs.map(({ practice: _practice, practiceCorrect: _practiceCorrect, ...row }) => row);
  const parsed = restored(JSON.stringify({ state: { ...v0, logs: legacyLogs }, version: 0 }));
  assert.deepEqual(parsed?.lifetime, { reviews: 12, correct: 10, practice: 0, practiceCorrect: 0 });
  assert.deepEqual(parsed?.cards, saved.cards);
  assert.equal(parsed?.requestRetention, 0.9);
  assert.deepEqual(parsed?.reviewHistory, []);
  assert.deepEqual(parsed?.practiceSkills, {});
});

test("malformed or foreign files are rejected as invalid", () => {
  const invalid = { ok: false, reason: "invalid" };
  assert.deepEqual(parseBackup("not json"), invalid);
  assert.deepEqual(parseBackup(JSON.stringify({ kind: "something-else", progress: saved })), invalid);
  const broken = JSON.parse(makeBackup(saved));
  broken.progress.cards["lex:A1:about"].state = "unknown";
  assert.deepEqual(parseBackup(JSON.stringify(broken)), invalid);
});

test("files from a newer version are rejected with their version, not misread", () => {
  const future = JSON.parse(makeBackup(saved));
  future.version = PROGRESS_VERSION + 1;
  future.progress.newerField = { kept: true };
  const expected = { ok: false, reason: "future", version: PROGRESS_VERSION + 1 };
  assert.deepEqual(parseBackup(JSON.stringify(future)), expected);
  // A newer save may not match today's shape at all; it is still "future".
  future.progress.cards = "a newer card format";
  assert.deepEqual(parseBackup(JSON.stringify(future)), expected);
  const dump = { state: future.progress, version: PROGRESS_VERSION + 1 };
  assert.deepEqual(parseBackup(JSON.stringify(dump)), expected);
});

test("backup files are named by date", () => {
  assert.equal(backupFileName(new Date("2026-10-02T09:00:00Z")), "vajefy-progress-2026-10-02.json");
});

test("impossible or unbounded skill evidence is rejected during restore", () => {
  const invalid = JSON.parse(makeBackup(saved));
  invalid.progress.practiceSkills["lex:A1:about"].spelling.correct = 99;
  assert.equal(parseBackup(JSON.stringify(invalid)).ok, false);
  invalid.progress.practiceSkills["lex:A1:about"].spelling.correct = 2;
  invalid.progress.practiceSkills["lex:A1:about"].listening.lastGrade = "invented";
  assert.equal(parseBackup(JSON.stringify(invalid)).ok, false);
  invalid.progress.practiceSkills = Object.fromEntries(Array.from({ length: 6001 }, (_, i) => [`lex:A1:${i}`, {}]));
  assert.equal(parseBackup(JSON.stringify(invalid)).ok, false);
});

test("v3 backups retain their exact due dates and gain no invented skill evidence", () => {
  const previous = JSON.parse(makeBackup(saved));
  previous.version = 3;
  delete previous.progress.practiceSkills;
  const progress = restored(JSON.stringify(previous));
  assert.deepEqual(progress?.cards, saved.cards);
  assert.deepEqual(progress?.reviewHistory, saved.reviewHistory);
  assert.deepEqual(progress?.practiceSkills, {});
});
