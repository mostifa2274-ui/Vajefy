import type { CardProg, ReviewEvent } from "./types";

export type LearnerState = "new" | "learning" | "ready" | "due" | "retained";

export const RETAINED_DELAY_DAYS = 1;

/**
 * Latest scheduled-review retention evidence per target.
 *
 * Retained is prospective evidence, not a permanent badge: a later failed
 * scheduled review clears it until a later delayed success demonstrates
 * retention again.
 */
export function retainedEvidence(history: readonly ReviewEvent[]): Map<string, boolean> {
  const latest = new Map<string, ReviewEvent>();
  for (const event of history) {
    const known = latest.get(event.id);
    if (!known || event.at >= known.at) latest.set(event.id, event);
  }
  return new Map(
    [...latest].map(([id, event]) => [
      id,
      event.grade !== "again" && event.elapsedDays >= RETAINED_DELAY_DAYS,
    ]),
  );
}

/**
 * Formal learner-facing state for one target.
 *
 * Priority is intentional:
 * - no card => New;
 * - currently due => Due, even if it was retained before;
 * - current-session strong evidence => Ready for now;
 * - latest delayed scheduled success => Retained;
 * - otherwise => Learning.
 *
 * "Ready for now" is supplied only by the current lesson; it is never inferred
 * from response speed or silently persisted as mastery.
 */
export function learnerState(
  card: CardProg | undefined,
  options: { now: number; ready?: boolean; retained?: boolean },
): LearnerState {
  if (!card) return "new";
  if (card.due <= options.now) return "due";
  if (options.ready) return "ready";
  if (options.retained) return "retained";
  return "learning";
}

export type LearnerStateCounts = Record<Exclude<LearnerState, "new" | "ready">, number>;

/** Snapshot counts for introduced targets. New and Ready require catalogue/session context. */
export function learnerStateCounts(
  cards: Record<string, CardProg | undefined>,
  history: readonly ReviewEvent[],
  now: number,
): LearnerStateCounts {
  const retained = retainedEvidence(history);
  const counts: LearnerStateCounts = { learning: 0, due: 0, retained: 0 };
  for (const [id, card] of Object.entries(cards)) {
    const state = learnerState(card, { now, retained: retained.get(id) ?? false });
    if (state === "learning" || state === "due" || state === "retained") counts[state] += 1;
  }
  return counts;
}
