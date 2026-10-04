import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PRACTICE_POLICY, skillWeakness, smartPracticeCandidate, smartPracticeQuestions, SMART_PRACTICE_COOLDOWN_MS, SMART_PRACTICE_GUARD_MS } from "./adaptive";
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

test("a listening weakness selects listening while unavailable audio falls back to recall", () => {
  const words = Array.from({ length: 6 }, (_, index) => word(index));
  const id = words[0]!.id;
  const cards = { [id]: reviewCard() };
  const evidence = { [id]: { listening: { attempts: 3, correct: 1, lastAt: T0 - 60 * MIN, lastGrade: "again" as const } } };
  const withAudio = smartPracticeQuestions(words, cards, 1, useCopy("en"), "en", T0, 0.9, { evidence });
  assert.equal(withAudio[0]?.practiceSkill, "listening");
  const silent = smartPracticeQuestions(words, cards, 1, useCopy("en"), "en", T0, 0.9, { evidence, allowListening: false });
  assert.equal(silent[0]?.practiceSkill, "spelling");
  assert.deepEqual(cards[id], reviewCard());
});

test("additional senses keep their own meaning and controlled listening clip", () => {
  const words = Array.from({ length: 6 }, (_, index) => word(index));
  const id = `${words[0]!.id}#second`;
  const exact: LexWord = {
    ...words[0]!,
    id,
    fa: "معنی دوم دقیق",
    ex: "This sentence uses alpha in its second sense.",
    tr: "این جمله معنی دوم alpha را به‌کار می‌برد.",
  };
  const cards = { [id]: reviewCard() };
  const evidence = {
    [id]: { listening: { attempts: 3, correct: 1, lastAt: T0 - 60 * MIN, lastGrade: "again" as const } },
  };
  const questions = smartPracticeQuestions(words, cards, 1, useCopy("fa"), "fa", T0, 0.9, {
    evidence,
    allowListening: false,
    targets: { [id]: { word: exact, clip: "/audio/exact-sense.mp3" } },
  });

  assert.equal(questions.length, 1);
  const question = questions[0]!;
  assert.equal(question.id, id);
  assert.equal(question.practiceSkill, "listening");
  assert.ok(question.kind === "mcq");
  assert.equal(question.clip, "/audio/exact-sense.mp3");
  assert.equal(question.options.find((option) => option.key === id)?.text, exact.fa);
});

test("a clip on another target does not enable silent listening", () => {
  const words = Array.from({ length: 6 }, (_, index) => word(index));
  const silentId = words[0]!.id;
  const clippedId = words[1]!.id;
  const cards = { [silentId]: reviewCard(), [clippedId]: reviewCard(1) };
  const evidence = {
    [silentId]: { listening: { attempts: 3, correct: 1, lastAt: T0 - 60 * MIN, lastGrade: "again" as const } },
  };
  const questions = smartPracticeQuestions(words, cards, 1, useCopy("en"), "en", T0, 0.9, {
    evidence,
    allowListening: false,
    targets: { [clippedId]: { word: words[1]!, clip: "/audio/other.mp3" } },
  });
  assert.equal(questions[0]?.id, silentId);
  assert.notEqual(questions[0]?.practiceSkill, "listening");
});

test("recent optional practice rests a word until the cooldown expires", () => {
  const skills = { spelling: { attempts: 1, correct: 1, lastAt: T0, lastGrade: "good" as const } };
  const card = reviewCard();
  assert.equal(smartPracticeCandidate("resting", card, T0 + SMART_PRACTICE_COOLDOWN_MS - 1, 0.9, skills), null);
  assert.ok(smartPracticeCandidate("rested", card, T0 + SMART_PRACTICE_COOLDOWN_MS, 0.9, skills));
});

test("native relearning state cannot be selected even with an inconsistent legacy field", () => {
  const card = reviewCard();
  assert.ok(card.fsrs);
  const relearning: CardProg = { ...card, fsrs: { ...card.fsrs, state: "relearning" } };
  assert.equal(smartPracticeCandidate("relearning", relearning, T0, 0.9), null);
});

test("incompatible context uses spelling and a tiny pool cannot block a safe session", () => {
  const target = { ...word(0), ex: "No matching headword in this sentence." };
  const evidence = { [target.id]: { context: { attempts: 2, correct: 0, lastAt: T0 - 60 * MIN, lastGrade: "again" as const } } };
  const cards = { [target.id]: reviewCard(), "lex:A1:removed": reviewCard() };
  const questions = smartPracticeQuestions([target], cards, 10, useCopy("fa"), "fa", T0, 0.9, { evidence });
  assert.equal(questions.length, 1);
  assert.equal(questions[0]?.kind, "type");
  assert.equal(questions[0]?.practiceSkill, "spelling");
  assert.equal(questions[0]?.id, target.id);
  assert.deepEqual(smartPracticeQuestions([target], cards, NaN, useCopy("fa"), "fa", T0), []);
});

test("a single miss gets prompt support that fades, and later success reduces it", () => {
  const DAY = 24 * 60 * MIN;
  const missed = { spelling: { attempts: 1, correct: 0, lastAt: T0, lastGrade: "again" as const } };
  const fresh = skillWeakness(missed, "spelling", T0);
  const week = skillWeakness(missed, "spelling", T0 + 7 * DAY);
  assert.ok(fresh > week && week > 0, "the latest miss fades over the half-life");
  assert.ok(Math.abs(week - (fresh - 30)) < 1e-9, "after one half-life the miss weighs half as much");
  const recovered = { spelling: { attempts: 2, correct: 1, lastAt: T0 + MIN, lastGrade: "good" as const } };
  assert.ok(skillWeakness(recovered, "spelling", T0 + MIN) < week, "a later success outweighs a week of fading");
  assert.equal(skillWeakness({}, "spelling", T0), 0, "no evidence is not weakness");
});

test("more evidence of the same miss rate counts for more than one answer", () => {
  const one = { context: { attempts: 1, correct: 0, lastAt: T0 - 60 * 24 * 60 * MIN, lastGrade: "good" as const } };
  const many = { context: { attempts: 6, correct: 0, lastAt: T0 - 60 * 24 * 60 * MIN, lastGrade: "good" as const } };
  assert.ok(skillWeakness(many, "context", T0) > skillWeakness(one, "context", T0));
});

test("the policy's guard and cooldown are configuration, not constants", () => {
  const card = { ...reviewCard(), due: T0 + 3 * 60 * MIN };
  assert.equal(smartPracticeCandidate("near", card, T0, 0.9), null, "the default six-hour guard protects it");
  const relaxed = { ...DEFAULT_PRACTICE_POLICY, guardMs: 60 * MIN };
  assert.ok(smartPracticeCandidate("near", card, T0, 0.9, {}, relaxed), "a shorter guard admits it");
});
