/**
 * Plain facts about learning targets: their ids, goals and introduction
 * order. Screens use these at startup, so they live apart from the content
 * schemas in content.ts, which only the authoring scripts need.
 */

export const GOALS = ["everyday", "work", "study", "general"] as const;
export type Goal = (typeof GOALS)[number];

/**
 * The order in which to introduce targets, given in course order.
 *
 * Words mapped to a curriculum unit (content/curriculum/) follow the
 * curriculum for every goal: unit by unit, each word after the words its
 * lessons rely on. Goals never reorder them, because the curriculum's
 * prerequisites and its language audit hold only for that sequence. A further
 * sense of a word comes one unit after the word's first sense, so two meanings
 * are never taught side by side; delaying a target never breaks a prerequisite.
 *
 * Words outside a curriculum come after, with targets that serve the learner's
 * goal brought forward and further senses after first meetings.
 */
export function orderForGoal<T>(
  targets: T[],
  goal: Goal | undefined,
  describe: (target: T) => { goals: readonly Goal[]; sense: number; unit?: number | null },
): T[] {
  return targets
    .map((target, position) => {
      const { goals, sense, unit } = describe(target);
      if (unit !== undefined && unit !== null) return { target, band: sense > 0 ? unit + 1.5 : unit, rank: position };
      const serves = !goal || goal === "general" || goals.includes(goal);
      return { target, band: Number.MAX_SAFE_INTEGER, rank: position + (sense > 0 ? 1000 : 0) + (serves ? 0 : 400) };
    })
    .sort((a, b) => a.band - b.band || a.rank - b.rank)
    .map((item) => item.target);
}

/**
 * Whether a target may be introduced now: a further sense only once the
 * word's first sense has been met, never in the same lesson.
 */
export function readyToIntroduce(id: string, met: (id: string) => boolean): boolean {
  return !isSenseId(id) || met(entryIdOf(id));
}

/**
 * Introduction order per goal, compiled to `public/data/enhanced-order.json`,
 * with the sense ids whose entries are released.
 */
export type PilotOrder = { version: string; order: Record<Goal, string[]>; released: string[] };

/**
 * The headword as learners see and hear it. The dataset numbers homographs
 * and qualifies senses (last¹ (final), lie² (tell a lie), bank (money)); an
 * enhanced entry teaches one word, so both are dropped.
 */
export function headwordOf(dataset: string): string {
  return dataset
    .replace(/\s*\([^)]*\)\s*$/u, "")
    .replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]+$/u, "")
    .trim();
}

export function isSenseId(id: string) {
  return id.includes("#");
}

/** The entry a learning target belongs to. */
export function entryIdOf(id: string) {
  const hash = id.indexOf("#");
  return hash < 0 ? id : id.slice(0, hash);
}
