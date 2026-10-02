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
  };
}

export function isMastered(card: CardProg): boolean {
  return card.state === "review" && card.interval >= 21;
}

export function schedule(card: CardProg, grade: Grade, now: number): CardProg {
  const next: CardProg = { ...card };

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

  const base = next.interval || 1;
  let interval = base;
  if (grade === "hard") interval = Math.max(1, Math.round(base * 1.2));
  else if (grade === "good") interval = Math.max(1, Math.round(base * next.ease));
  else interval = Math.max(1, Math.round(base * next.ease * 1.3));
  next.interval = interval;
  next.reps += 1;
  next.due = now + interval * DAY;
  return next;
}

export function shouldRequeue(card: CardProg, now: number): boolean {
  return card.state === "learning" && card.due - now <= 15 * 60_000;
}
