import assert from "node:assert/strict";
import test from "node:test";
import { smartPracticeCandidate, smartPracticeQuestions, SMART_PRACTICE_GUARD_MS } from "./adaptive";
import { useCopy } from "./i18n";
import { freshCard, schedule } from "./srs";
import type { CardProg, LexWord } from "./types";

const T0 = Date.UTC(2026, 9, 2, 9);
const MIN = 60_000;

function reviewCard(offsetMinutes = 0): CardProg {
  let card = freshCard(T0 + offsetMinutes * MIN);
  card = schedule(card, "good", T0 + offsetMinutes * MIN);
  card = schedule(card, "good", card.due);
  assert.equal(card.state, "review");
  return card;
}

function word(index: number): LexWord {
  const names = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot"];
  const w = names[index] ?? `word${index}`;
  return {
    id: `lex:A1:${w}`,
    w,
    pr: w,
    ipa: `/${w}/`,
    pos: "noun",
    fa: `معنی ${index}`,
    ex: `This sentence uses ${w} clearly.`,
    tr: `این جمله ${w} را به‌کار می‌برد.`,
  };
}

test("smart practice protects due and soon-due cards for scheduled Review", () => {
  const card = reviewCard();
  const dueNow = { ...card, due: T0 };
  const dueSoon = { ...card, due: T0 + SMART_PRACTICE_GUARD_MS - 1 };
  const safe = { ...card, due: T0 + SMART_PRACTICE_GUARD_MS + MIN };

  assert.equal(smartPracticeCandidate("now", dueNow, T0, 0.9), null);
  assert.equal(smartPracticeCandidate("soon", dueSoon, T0, 0.9), null);
  assert.ok(smartPracticeCandidate("safe", safe, T0, 0.9));
});

test("repeated lapses increase optional-practice priority without moving the schedule", () => {
  const base = reviewCard();
  const clean = smartPracticeCandidate("clean", { ...base, lapses: 0 }, T0, 0.9);
  const fragile = smartPracticeCandidate("fragile", { ...base, lapses: 4 }, T0, 0.9);
  assert.ok(clean);
  assert.ok(fragile);
  assert.ok(fragile.score > clean.score);
  assert.equal(base.due, reviewCard().due);
});

test("smart practice interleaves active-recall formats across unique scheduled words", () => {
  const words = Array.from({ length: 6 }, (_, index) => word(index));
  const cards: Record<string, CardProg> = {};
  for (let index = 0; index < 6; index++) {
    const card = reviewCard(index);
    cards[words[index]!.id] = { ...card, lapses: 6 - index };
  }

  const questions = smartPracticeQuestions(words, cards, 5, useCopy("en"), "en", T0, 0.9);
  assert.equal(questions.length, 5);
  assert.equal(new Set(questions.map((question) => question.id)).size, 5);

  assert.equal(questions[0]?.kind, "type");
  assert.equal(questions[1]?.kind, "mcq");
  assert.ok(questions[1]?.kind === "mcq" && Boolean(questions[1].speak));
  assert.equal(questions[2]?.kind, "mcq");
  assert.ok(questions[2]?.kind === "mcq" && questions[2].prompt.includes("______"));
  assert.equal(questions[3]?.kind, "type");
  assert.equal(questions[4]?.kind, "mcq");
});

test("learning cards are never pulled into optional smart practice", () => {
  const card = freshCard(T0);
  assert.equal(card.state, "learning");
  assert.equal(smartPracticeCandidate("new", card, T0, 0.9), null);
});
