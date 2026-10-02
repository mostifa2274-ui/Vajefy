import assert from "node:assert/strict";
import test from "node:test";
import { backupFileName, makeBackup, parseBackup } from "./backup";
import { PROGRESS_VERSION, type SavedProgress } from "./store";

const saved: SavedProgress = {
  cards: {
    "lex:A1:about": { ease: 2.5, interval: 3, due: 1_800_000_000_000, reps: 2, lapses: 0, state: "review", step: 0, last: 1_799_740_800_000 },
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
  onboarded: true,
};

test("an export file reads back to the same progress", () => {
  assert.deepEqual(parseBackup(makeBackup(saved)), saved);
});

test("a raw v0 localStorage entry imports and is migrated", () => {
  const { lifetime: _lifetime, ...v0 } = saved;
  const parsed = parseBackup(JSON.stringify({ state: v0, version: 0 }));
  assert.deepEqual(parsed?.lifetime, { reviews: 12, correct: 10, practice: 7, practiceCorrect: 6 });
  assert.deepEqual(parsed?.cards, saved.cards);
});

test("malformed, foreign or future files are rejected", () => {
  assert.equal(parseBackup("not json"), null);
  assert.equal(parseBackup(JSON.stringify({ kind: "something-else", progress: saved })), null);
  const broken = JSON.parse(makeBackup(saved));
  broken.progress.cards["lex:A1:about"].state = "unknown";
  assert.equal(parseBackup(JSON.stringify(broken)), null);
  const future = JSON.parse(makeBackup(saved));
  future.version = PROGRESS_VERSION + 1;
  assert.equal(parseBackup(JSON.stringify(future)), null);
});

test("backup files are named by date", () => {
  assert.equal(backupFileName(new Date("2026-10-02T09:00:00Z")), "roshana-progress-2026-10-02.json");
});
