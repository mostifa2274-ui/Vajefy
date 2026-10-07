import { DEFAULT_SECONDS_PER_NEW } from "./lesson-time";

export type DailyPlanInput = {
  due: number;
  introducedToday: number;
  newPerDay: number;
  sessionSize: number;
  minutes: number;
  /**
   * Robust measured active seconds per new target. Omit until enough completed
   * timed lessons exist; the planner then uses the preregistered fallback.
   */
  secondsPerNew?: number;
};

export type DailyPlan = {
  due: number;
  reviewTake: number;
  remainingNewAllowance: number;
  newLimit: number;
  estimatedMinutes: number;
};

/**
 * The settings that fit the learner's daily time: new words and session
 * length grow with the minutes available, and Review still comes first each
 * day. The learning study sizes its word set by this allowance.
 */
export function planFor(minutes: number) {
  if (minutes <= 5) return { newPerDay: 3, sessionSize: 10, dailyGoal: 10 };
  if (minutes >= 15) return { newPerDay: 8, sessionSize: 30, dailyGoal: 30 };
  return { newPerDay: 5, sessionSize: 20, dailyGoal: 20 };
}

function whole(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/**
 * One decision for Today, Learn and Review.
 *
 * Reviews consume the current session first. New introductions are capped by
 * the learner's daily allowance, the remaining session room and a small
 * time-based lesson budget. A heavy review backlog reduces or removes new
 * material instead of letting another route silently exceed the plan.
 */
export function dailyPlan(input: DailyPlanInput): DailyPlan {
  const due = whole(input.due);
  const introducedToday = whole(input.introducedToday);
  const newPerDay = whole(input.newPerDay);
  const sessionSize = whole(input.sessionSize);
  const minutes = whole(input.minutes);
  const secondsPerNew =
    Number.isFinite(input.secondsPerNew) && (input.secondsPerNew ?? 0) > 0
      ? Math.max(30, Math.min(300, input.secondsPerNew!))
      : DEFAULT_SECONDS_PER_NEW;

  const reviewTake = Math.min(due, sessionSize);
  const remainingNewAllowance = Math.max(0, newPerDay - introducedToday);
  const sessionRoom = Math.max(0, sessionSize - reviewTake);
  const timeBase = minutes <= 5 ? 2 : minutes >= 15 ? 5 : 3;

  let backlogCap = timeBase;
  if (sessionSize === 0 || due >= sessionSize) backlogCap = 0;
  else if (due >= Math.ceil(sessionSize / 2)) backlogCap = Math.max(1, Math.floor(timeBase / 2));

  const newLimit = Math.min(remainingNewAllowance, sessionRoom, backlogCap);
  // Planning estimate only: reviews are short recall events. New-target time
  // comes from the learner's completed active-visible lesson distribution once
  // there is enough evidence, otherwise from the frozen 90-second fallback.
  // It affects only the displayed duration estimate, never which checks a
  // learner must pass or how many new targets backlog policy permits.
  const estimatedMinutes =
    reviewTake === 0 && newLimit === 0
      ? 0
      : Math.max(1, Math.ceil((reviewTake * 8 + newLimit * secondsPerNew) / 60));

  return { due, reviewTake, remainingNewAllowance, newLimit, estimatedMinutes };
}
