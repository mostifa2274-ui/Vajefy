import assert from "node:assert/strict";
import test from "node:test";
import { measures } from "./measures";
import type { CardProg, ReviewEvent } from "./types";

const card = {} as CardProg;
const review = (id: string, elapsedDays: number, grade: ReviewEvent["grade"] = "good"): ReviewEvent => ({
  id, at: 0, grade, algorithm: "fsrs6", elapsedDays, scheduledDays: 1,
});
const observed = (attempts: number, correct: number) => ({ attempts, correct, lastAt: 1, lastGrade: "good" as const });

test("introduced, remembered after a delay and used are counted per target", () => {
  const result = measures({
    cards: { a: card, b: card, c: card },
    reviewHistory: [review("a", 0), review("a", 2), review("b", 3, "again"), review("c", 0.2)],
    practiceSkills: { a: { context: observed(2, 1) }, b: { meaning: observed(3, 3) }, c: { spelling: observed(1, 1) } },
  });
  assert.equal(result.introduced, 3);
  assert.equal(result.remembered, 1, "only a correct recall a day or more later counts");
  assert.equal(result.used, 2, "context or spelling in a sentence");
});

test("a skill is judged only with enough evidence", () => {
  const few = measures({ cards: {}, reviewHistory: [], practiceSkills: { a: { listening: observed(2, 0) } } });
  assert.equal(few.weakest, null);
  const many = measures({
    cards: {},
    reviewHistory: [],
    practiceSkills: { a: { listening: observed(6, 2), meaning: observed(6, 5) } },
  });
  assert.equal(many.weakest, "listening");
  assert.equal(many.skills.find((item) => item.skill === "meaning")?.accuracy, 5 / 6);
});
