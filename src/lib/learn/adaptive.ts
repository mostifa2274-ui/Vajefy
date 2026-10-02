import { lexQuestion } from "./quiz";
import { retrievability } from "./srs";
import { latestPractice, PRACTICE_SKILLS } from "./practice";
import type { Copy } from "./i18n";
import type { CardProg, Lang, LexWord, PracticeEvidence, PracticeSkill, Question } from "./types";

const HOUR = 3_600_000;
/**
 * Protect the next scheduled retrieval from being spoiled by optional practice.
 * Smart Practice never selects cards due now or within the next six hours.
 */
export const SMART_PRACTICE_GUARD_MS = 6 * HOUR;
/** Avoid repeating the same optional prompts immediately after a session. */
export const SMART_PRACTICE_COOLDOWN_MS = 30 * 60_000;

export type SmartPracticeOptions = {
  evidence?: PracticeEvidence;
  allowListening?: boolean;
};

export type SmartPracticeCandidate = {
  id: string;
  score: number;
  retrievability: number;
  difficulty: number;
  lapses: number;
};

type SmartLexMode = "spell" | "listen" | "cloze" | "to-en";

const MODE_CYCLE: readonly SmartLexMode[] = [
  "spell",
  "listen",
  "cloze",
  "spell",
  "to-en",
];

const SKILL_MODE: Record<PracticeSkill, SmartLexMode> = {
  meaning: "to-en",
  spelling: "spell",
  listening: "listen",
  context: "cloze",
};

function skillWeakness(skills: PracticeEvidence[string] = {}, skill: PracticeSkill): number {
  const observed = skills[skill];
  if (!observed?.attempts) return 0;
  const missRate = clamp(1 - observed.correct / observed.attempts, 0, 1);
  return missRate * 40 + (observed.lastGrade === "again" ? 60 : observed.lastGrade === "hard" ? 20 : 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function effectiveDifficulty(card: CardProg): number {
  // FSRS difficulty is already normalized to roughly 1..10. Older cards retain
  // only SM-2 ease, so map lower ease to higher difficulty for ranking until
  // their next real review bridges them into native FSRS.
  return card.fsrs?.difficulty ?? clamp(11 - card.ease * 2, 1, 10);
}

/**
 * Score a scheduled card for optional, non-scheduling practice.
 *
 * We deliberately exclude learning/relearning cards and cards close to due:
 * those belong in Review, where the answer can update the FSRS memory state.
 * Among safe candidates, lower current retrievability dominates, then repeated
 * lapses and learned difficulty provide stable tie-breaking.
 */
export function smartPracticeCandidate(
  id: string,
  card: CardProg,
  now: number,
  requestRetention: number,
  skills: PracticeEvidence[string] = {},
): SmartPracticeCandidate | null {
  if (card.state !== "review") return null;
  if (card.fsrs && card.fsrs.state !== "review") return null;
  if (card.due <= now + SMART_PRACTICE_GUARD_MS) return null;
  const recent = latestPractice(skills);
  if (recent > 0 && now - recent < SMART_PRACTICE_COOLDOWN_MS) return null;

  const recall = retrievability(card, now, requestRetention);
  if (recall == null || !Number.isFinite(recall)) return null;

  const difficulty = effectiveDifficulty(card);
  const score =
    (1 - clamp(recall, 0, 1)) * 100 +
    Math.min(card.lapses, 10) * 8 +
    difficulty +
    Math.max(...PRACTICE_SKILLS.map((skill) => skillWeakness(skills, skill))) * 0.5;

  return {
    id,
    score,
    retrievability: recall,
    difficulty,
    lapses: card.lapses,
  };
}

export function rankSmartPractice(
  cards: Record<string, CardProg>,
  now: number,
  requestRetention: number,
  evidence: PracticeEvidence = {},
): SmartPracticeCandidate[] {
  return Object.entries(cards)
    .flatMap(([id, card]) => {
      const candidate = smartPracticeCandidate(id, card, now, requestRetention, evidence[id]);
      return candidate ? [candidate] : [];
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.retrievability - b.retrievability ||
        b.lapses - a.lapses ||
        b.difficulty - a.difficulty ||
        a.id.localeCompare(b.id),
    );
}

function modeAt(index: number, skills: PracticeEvidence[string] = {}, allowListening = true): SmartLexMode {
  const weak = PRACTICE_SKILLS
    .filter((skill) => allowListening || skill !== "listening")
    .map((skill) => ({ mode: SKILL_MODE[skill], score: skillWeakness(skills, skill) }))
    .sort((a, b) => b.score - a.score)[0];
  if (weak && weak.score > 0) return weak.mode;
  const cycle = allowListening ? MODE_CYCLE : MODE_CYCLE.filter((mode) => mode !== "listen");
  return cycle[index % cycle.length] ?? "spell";
}

/**
 * Build an interleaved active-recall set from words already on the learner's
 * schedule. Successful optional practice never moves the FSRS due date; a miss
 * still escalates the item to due-now through the existing practice policy.
 */
export function smartPracticeQuestions(
  words: LexWord[],
  cards: Record<string, CardProg>,
  count: number,
  copy: Copy,
  lang: Lang,
  now = Date.now(),
  requestRetention = 0.9,
  options: SmartPracticeOptions = {},
): Question[] {
  const byId = new Map(words.map((word) => [word.id, word]));
  const ranked = rankSmartPractice(cards, now, requestRetention, options.evidence);
  const questions: Question[] = [];
  const limit = Number.isFinite(count) ? clamp(Math.floor(count), 0, 20) : 0;

  for (const candidate of ranked) {
    if (questions.length >= limit) break;
    const word = byId.get(candidate.id);
    if (!word) continue;

    const preferred = modeAt(questions.length, options.evidence?.[candidate.id], options.allowListening);
    const question =
      lexQuestion(word, words, preferred, copy, lang) ??
      // Spelling is generative and does not require distractors, so it is a
      // robust fallback for words whose example cannot make a cloze question.
      lexQuestion(word, words, "spell", copy, lang);

    if (question) questions.push(question);
  }

  return questions;
}
