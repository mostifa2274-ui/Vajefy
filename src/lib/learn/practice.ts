import type { Grade, PracticeEvidence, PracticeSkill } from "./types";

export const MAX_PRACTICE_WORDS = 6_000;
export const PRACTICE_SKILLS: readonly PracticeSkill[] = ["meaning", "spelling", "listening", "context"];

/** Keep only the most recently practised vocabulary if the bounded map fills. */
export function boundPracticeEvidence(evidence: PracticeEvidence): PracticeEvidence {
  const entries = Object.entries(evidence);
  if (entries.length <= MAX_PRACTICE_WORDS) return evidence;
  return Object.fromEntries(
    entries
      .sort((a, b) => latestPractice(b[1]) - latestPractice(a[1]) || a[0].localeCompare(b[0]))
      .slice(0, MAX_PRACTICE_WORDS),
  );
}

export function latestPractice(skills: PracticeEvidence[string] = {}): number {
  return Math.max(0, ...PRACTICE_SKILLS.map((skill) => skills[skill]?.lastAt ?? 0));
}

export function recordPracticeSkill(
  evidence: PracticeEvidence,
  id: string,
  skill: PracticeSkill | undefined,
  grade: Grade,
  at: number,
): PracticeEvidence {
  // Reference drills and unlabelled historical attempts are not vocabulary
  // skill evidence. Never manufacture skill history from aggregate totals.
  if (!skill || !id.startsWith("lex:")) return evidence;
  const previous = evidence[id]?.[skill];
  return boundPracticeEvidence({
    ...evidence,
    [id]: {
      ...evidence[id],
      [skill]: {
        attempts: (previous?.attempts ?? 0) + 1,
        correct: (previous?.correct ?? 0) + (grade === "again" ? 0 : 1),
        lastAt: at,
        lastGrade: grade,
      },
    },
  });
}
