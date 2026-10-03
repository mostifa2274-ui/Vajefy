import assert from "node:assert/strict";
import test from "node:test";
import { makeBackup } from "./backup";
import { PROGRESS_VERSION, type SavedProgress } from "./progress";
import { inspectStoredProgress, recoverProgress, savedCopyFileName } from "./recovery";
import type { CardProg, ReviewEvent } from "./types";

const AT = 1_799_740_800_000;
const good: CardProg = { ease: 2.5, interval: 3, due: AT + 3 * 86_400_000, reps: 2, lapses: 0, state: "review", step: 0, last: AT };
const event: ReviewEvent = { id: "lex:A1:about", at: AT, grade: "good", algorithm: "legacy", elapsedDays: 1, scheduledDays: 3 };

const saved: SavedProgress = JSON.parse(makeBackup({
  cards: { "lex:A1:about": good },
  logs: [{ date: "2026-10-01", reviews: 2, correct: 2, practice: 1, practiceCorrect: 1, introduced: 1 }],
  lifetime: { reviews: 9, correct: 8, practice: 1, practiceCorrect: 1 },
  streak: 3,
  lastStudyDate: "2026-10-01",
  xp: 90,
  lang: "en",
  focus: "A2",
  sessionSize: 30,
  newPerDay: 5,
  voice: true,
  accent: "en-US",
  bookmarks: ["lex:A1:about"],
  dailyGoal: 40,
  requestRetention: 0.9,
  reviewHistory: [event],
  practiceSkills: { "lex:A1:about": { spelling: { attempts: 1, correct: 1, lastAt: AT, lastGrade: "good" } } },
  onboarded: true,
  goal: "study",
  minutes: 5,
})).progress;

const stored = (state: unknown, version: number = PROGRESS_VERSION) => JSON.stringify({ state, version });

test("an absent save is empty and a valid save loads exactly", () => {
  assert.deepEqual(inspectStoredProgress(null), { kind: "empty" });
  assert.deepEqual(inspectStoredProgress(stored(saved)), { kind: "ok", progress: saved });
});

test("older saves are migrated and verified before use", () => {
  const { lifetime: _lifetime, accent: _accent, requestRetention: _r, reviewHistory: _h, practiceSkills: _p, ...v0 } = saved;
  const result = inspectStoredProgress(stored(v0, 0));
  assert.equal(result.kind, "ok");
  if (result.kind !== "ok") return;
  assert.deepEqual(result.progress.cards, saved.cards);
  assert.deepEqual(result.progress.lifetime, { reviews: 2, correct: 2, practice: 0, practiceCorrect: 0 });
  assert.deepEqual(result.progress.reviewHistory, []);
  assert.equal(result.progress.accent, "en-GB");
});

test("unreadable, foreign or invalid saves are held byte for byte", () => {
  const cases = [
    '{"state":{"cards":{"lex:A1:about":{"ease":2.5',
    JSON.stringify({ cards: {} }),
    stored({ ...saved, logs: "oops" }),
    stored({ ...saved, cards: { "lex:A1:about": { ...good, state: "mastered" } } }),
    stored(saved, -1),
    "[]",
  ];
  for (const raw of cases) assert.deepEqual(inspectStoredProgress(raw), { kind: "damaged", raw });
});

test("a newer version is held as future even when its shape is unknown", () => {
  const raw = stored({ cards: "a newer card format", futureField: true }, PROGRESS_VERSION + 1);
  assert.deepEqual(inspectStoredProgress(raw), { kind: "future", raw, version: PROGRESS_VERSION + 1 });
});

test("recovery keeps every valid record and reports what it could not keep", () => {
  const raw = stored({
    ...saved,
    cards: { "lex:A1:about": good, "lex:A1:above": { ...good, state: "mastered" }, "lex:A1:act": { ...good, ease: "high" } },
    reviewHistory: [event, { ...event, grade: "perfect" }],
    logs: [saved.logs[0], { date: "yesterday" }],
    bookmarks: ["lex:A1:about", 42],
    dailyGoal: 5000,
    practiceSkills: {
      "lex:A1:about": {
        spelling: { attempts: 1, correct: 1, lastAt: AT, lastGrade: "good" },
        listening: { attempts: 1, correct: 7, lastAt: AT, lastGrade: "good" },
      },
    },
  });
  assert.equal(inspectStoredProgress(raw).kind, "damaged");
  const recovery = recoverProgress(raw);
  assert.ok(recovery);
  assert.deepEqual(recovery.report, {
    words: { kept: 1, total: 3 },
    reviews: { kept: 1, total: 2 },
    reset: ["logs", "bookmarks", "practiceSkills", "dailyGoal"],
  });
  assert.deepEqual(recovery.progress, { ...saved, dailyGoal: 20 });
  // What recovery produces is itself a valid current save.
  assert.deepEqual(inspectStoredProgress(stored(recovery.progress)), { kind: "ok", progress: recovery.progress });
});

test("recovery of a structurally broken save falls back to defaults without inventing learning", () => {
  const recovery = recoverProgress(stored({ cards: "oops", reviewHistory: 7, lang: "en", onboarded: "yes" }, 3));
  assert.ok(recovery);
  assert.deepEqual(recovery.progress.cards, {});
  assert.deepEqual(recovery.progress.reviewHistory, []);
  assert.equal(recovery.progress.lang, "en");
  assert.equal(recovery.progress.onboarded, false);
  assert.deepEqual(recovery.progress.lifetime, { reviews: 0, correct: 0, practice: 0, practiceCorrect: 0 });
  assert.deepEqual(recovery.report.words, { kept: 0, total: 0 });
  assert.ok(recovery.report.reset.includes("cards"));
  assert.ok(recovery.report.reset.includes("reviewHistory"));
});

test("a learner whose cards survived is still treated as onboarded", () => {
  const recovery = recoverProgress(stored({ ...saved, onboarded: null }));
  assert.equal(recovery?.progress.onboarded, true);
  assert.ok(recovery?.report.reset.includes("onboarded"));
});

test("recovery of a newer save keeps only what this version understands", () => {
  const recovery = recoverProgress(stored({ ...saved, futureField: { keep: true } }, PROGRESS_VERSION + 3));
  assert.ok(recovery);
  assert.deepEqual(recovery.progress, saved);
  assert.deepEqual(recovery.report.reset, []);
});

test("nothing is recovered from unreadable text", () => {
  assert.equal(recoverProgress("{\"state\":"), null);
  assert.equal(recoverProgress("[]"), null);
  assert.equal(recoverProgress(JSON.stringify({ version: 4 })), null);
});

test("the saved copy is named apart from backups", () => {
  assert.equal(savedCopyFileName(new Date("2026-10-02T09:00:00Z")), "vajefy-saved-copy-2026-10-02.json");
});
