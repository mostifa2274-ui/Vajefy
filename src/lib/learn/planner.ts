export type DailyPlanInput = {
  due: number;
  introducedToday: number;
  newPerDay: number;
  sessionSize: number;
  minutes: number;
};

export type DailyPlan = {
  due: number;
  reviewTake: number;
  remainingNewAllowance: number;
  newLimit: number;
  estimatedMinutes: number;
};

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

  const reviewTake = Math.min(due, sessionSize);
  const remainingNewAllowance = Math.max(0, newPerDay - introducedToday);
  const sessionRoom = Math.max(0, sessionSize - reviewTake);
  const timeBase = minutes <= 5 ? 2 : minutes >= 15 ? 5 : 3;

  let backlogCap = timeBase;
  if (sessionSize === 0 || due >= sessionSize) backlogCap = 0;
  else if (due >= Math.ceil(sessionSize / 2)) backlogCap = Math.max(1, Math.floor(timeBase / 2));

  const newLimit = Math.min(remainingNewAllowance, sessionRoom, backlogCap);
  // Planning estimate only: reviews are short recall events; guided new targets
  // include teaching, retrieval, feedback and an applied use.
  const estimatedMinutes =
    reviewTake === 0 && newLimit === 0
      ? 0
      : Math.max(1, Math.ceil((reviewTake * 8 + newLimit * 90) / 60));

  return { due, reviewTake, remainingNewAllowance, newLimit, estimatedMinutes };
}
