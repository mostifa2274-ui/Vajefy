/**
 * Plain facts about learning targets: their ids, goals and introduction
 * order. Screens use these at startup, so they live apart from the content
 * schemas in content.ts, which only the authoring scripts need.
 */

export const GOALS = ["everyday", "work", "study", "general"] as const;
export type Goal = (typeof GOALS)[number];

/**
 * The order in which to introduce targets: curriculum order, with targets that
 * serve the learner's goal brought forward. A further sense of a word waits
 * until the first sense has been met.
 */
export function orderForGoal<T>(targets: T[], goal: Goal | undefined, describe: (target: T) => { goals: readonly Goal[]; sense: number }): T[] {
  return targets
    .map((target, position) => {
      const { goals, sense } = describe(target);
      const serves = !goal || goal === "general" || goals.includes(goal);
      return { target, rank: position + (sense > 0 ? 1000 : 0) + (serves ? 0 : 400) };
    })
    .sort((a, b) => a.rank - b.rank)
    .map((item) => item.target);
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
