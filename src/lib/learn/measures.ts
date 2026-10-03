import { PRACTICE_SKILLS } from "./practice";
import type { SavedProgress } from "./progress";
import type { PracticeSkill } from "./types";

/** Minimum answers before a skill's accuracy is shown: one or two answers say little. */
export const MIN_SKILL_EVIDENCE = 5;
const DAY_IN_DAYS = 1;

export type SkillSummary = { skill: PracticeSkill; attempts: number; correct: number; accuracy: number | null };

export type Measures = {
  /** Learning targets met: in the schedule, whether or not reviewed yet. */
  introduced: number;
  /** Targets correctly recalled in Review at least a day after the previous exposure. */
  remembered: number;
  /** Targets answered correctly in a sentence or written in context. */
  used: number;
  skills: SkillSummary[];
  /** The weakest skill with enough evidence, if any. */
  weakest: PracticeSkill | null;
};

/**
 * The supporting measures from docs/LEARNING_MEASURES.md, computed from the
 * learner's own records. Practice evidence collected before skills were
 * recorded is unknown and is not counted either way.
 */
export function measures(progress: Pick<SavedProgress, "cards" | "reviewHistory" | "practiceSkills">): Measures {
  const remembered = new Set(
    progress.reviewHistory.filter((event) => event.grade !== "again" && event.elapsedDays >= DAY_IN_DAYS).map((event) => event.id),
  );
  const used = new Set(
    Object.entries(progress.practiceSkills)
      .filter(([, skills]) => (skills.context?.correct ?? 0) > 0 || (skills.spelling?.correct ?? 0) > 0)
      .map(([id]) => id),
  );
  const skills = PRACTICE_SKILLS.map((skill) => {
    let attempts = 0;
    let correct = 0;
    for (const record of Object.values(progress.practiceSkills)) {
      attempts += record[skill]?.attempts ?? 0;
      correct += record[skill]?.correct ?? 0;
    }
    return { skill, attempts, correct, accuracy: attempts >= MIN_SKILL_EVIDENCE ? correct / attempts : null };
  });
  const weakest = [...skills].filter((item) => item.accuracy !== null).sort((a, b) => a.accuracy! - b.accuracy!)[0]?.skill ?? null;
  return { introduced: Object.keys(progress.cards).length, remembered: remembered.size, used: used.size, skills, weakest };
}
