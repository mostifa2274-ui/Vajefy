import type { CardProg, Grade } from "./types";

const DAY = 86400000;
const MIN_EASE = 1.3;

export function freshCard(now: number): CardProg {
  return {
    ease: 2.5,
    interval: 0,
    due: now,
    reps: 0,
    lapses: 0,
    state: "learning",
    step: 0,
  };
}

export function knownCard(now: number): CardProg {
  return {
    ease: 2.6,
    interval: 21,
    due: now + 21 * DAY,
    reps: 3,
    lapses: 0,
    state: "review",
    step: 0,
    last: now,
  };
}

export function isMastered(card: CardProg): boolean {
  return card.state === "review" && card.interval >= 21;
}

/** When the card was last graded; older saves only imply it from due − interval. */
function lastGraded(card: CardProg): number {
  return card.last ?? card.due - card.interval * DAY;
}

export function schedule(card: CardProg, grade: Grade, now: number): CardProg {
  const next: CardProg = { ...card, last: now };

  if (grade === "again") {
    next.ease = Math.max(MIN_EASE, next.ease - 0.2);
    next.lapses += 1;
    next.reps = 0;
    next.state = "learning";
    next.step = 0;
    next.interval = 0;
    next.due = now + 60_000;
    return next;
  }

  if (grade === "hard") next.ease = Math.max(MIN_EASE, next.ease - 0.05);
  if (grade === "easy") next.ease = next.ease + 0.15;

  if (next.state === "learning") {
    if (grade === "easy") {
      next.state = "review";
      next.step = 0;
      next.interval = 4;
      next.reps = 1;
      next.due = now + 4 * DAY;
      return next;
    }
    if (grade === "hard") {
      next.due = now + 8 * 60_000;
      return next;
    }
    if (next.step <= 0) {
      next.step = 1;
      next.due = now + 10 * 60_000;
      return next;
    }
    next.state = "review";
    next.step = 0;
    next.interval = 1;
    next.reps = 1;
    next.due = now + DAY;
    return next;
  }

  // Grow from the time that actually passed, not the time that was scheduled:
  // answering minutes after the last grade must not multiply the whole interval.
  // A pass never shortens the interval, so an early review is simply neutral.
  const current = card.interval || 1;
  const elapsed = Math.max(0, (now - lastGraded(card)) / DAY);
  const base = Math.min(current, elapsed);
  const factor = grade === "hard" ? 1.2 : grade === "good" ? next.ease : next.ease * 1.3;
  const interval = Math.max(current, Math.round(base * factor));
  next.interval = interval;
  next.reps += 1;
  next.due = now + interval * DAY;
  return next;
}
