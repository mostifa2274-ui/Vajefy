import type { Copy } from "./i18n";
import { lexQuestion } from "./quiz";
import { shuffle } from "./text";
import type { Lang, LevelId, LexWord, Mcq } from "./types";

/** Levels sampled by the optional check, in order. */
export const PLACEMENT_LEVELS: LevelId[] = ["A1", "A2", "B1", "B2", "C1"];
export const PER_LEVEL = 3;

export type PlacementItem = { level: LevelId; question: Mcq };
export type PlacementResult = { level: LevelId; correct: boolean };

/** A few meaning questions per level. Guessing is discouraged with «I don't know». */
export function placementItems(words: Record<LevelId, LexWord[]>, copy: Copy, lang: Lang): PlacementItem[] {
  return PLACEMENT_LEVELS.flatMap((level) => {
    const pool = words[level] ?? [];
    const items: PlacementItem[] = [];
    for (const word of shuffle(pool)) {
      if (items.length >= PER_LEVEL) break;
      const question = lexQuestion(word, pool, "to-fa", copy, lang);
      if (question?.kind === "mcq") items.push({ level, question });
    }
    return items;
  });
}

/**
 * Start at the first level the learner does not yet know: a level counts as
 * known when at least two of its three words were answered correctly and every
 * easier level was known too.
 */
export function placementLevel(results: PlacementResult[]): LevelId {
  for (const level of PLACEMENT_LEVELS) {
    const own = results.filter((result) => result.level === level);
    const correct = own.filter((result) => result.correct).length;
    if (!own.length || correct < Math.min(2, own.length)) return level;
  }
  return PLACEMENT_LEVELS[PLACEMENT_LEVELS.length - 1]!;
}
