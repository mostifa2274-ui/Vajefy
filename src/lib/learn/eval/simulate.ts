import { default_w } from "ts-fsrs";
import { DAY_MS, fsrs6, type Rating } from "./models";
import type { Learner, ReviewLog } from "./evaluate";

/**
 * Synthetic learners, for checking the evaluation itself: each one forgets
 * according to a known "true" FSRS-6 model, while reviews are scheduled by the
 * app's default FSRS-6, as they would be in real use. A sound evaluation must
 * find that a model fitted to the learner predicts better than the defaults
 * when the two differ.
 */

export function seeded(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

export type SimulationOptions = {
  id: string;
  /** The learner's true weights; defaults to FSRS-6's. */
  trueWeights?: readonly number[];
  days?: number;
  newPerDay?: number;
  seed?: number;
};

export function simulateLearner(options: SimulationOptions): Learner {
  const random = seeded(options.seed ?? 1);
  const truth = fsrs6(options.trueWeights ?? default_w);
  const scheduler = fsrs6(default_w);
  const start = Date.UTC(2026, 0, 1, 9);
  const days = options.days ?? 90;
  const perDay = options.newPerDay ?? 10;
  type Card = { id: string; due: number; last: number; truthState: ReturnType<typeof truth.init>; schedulerState: ReturnType<typeof scheduler.init> };
  const cards: Card[] = [];
  const reviews: ReviewLog[] = [];
  const rate = (recalled: boolean): Rating => (!recalled ? 1 : random() < 0.1 ? 2 : random() < 0.1 ? 4 : 3);

  for (let day = 0; day < days; day++) {
    const today = start + day * DAY_MS;
    for (const card of cards.filter((item) => item.due <= today)) {
      const at = today + Math.floor(random() * 8 * 3_600_000);
      const elapsed = truth.elapsedOf(card.last, at);
      const recalled = random() < truth.predict(card.truthState, elapsed);
      const rating = rate(recalled);
      reviews.push({ card: card.id, at, rating });
      card.truthState = truth.update(card.truthState, elapsed, rating);
      card.schedulerState = scheduler.update(card.schedulerState, elapsed, rating);
      card.last = at;
      card.due = today + Math.max(1, Math.round(scheduler.interval(card.schedulerState, 0.9))) * DAY_MS;
    }
    for (let n = 0; n < perDay; n++) {
      const at = today + n * 60_000;
      const rating: Rating = random() < 0.7 ? 3 : 1;
      const card: Card = { id: `${options.id}:${day}:${n}`, due: 0, last: at, truthState: truth.init(rating), schedulerState: scheduler.init(rating) };
      reviews.push({ card: card.id, at, rating });
      card.due = today + Math.max(1, Math.round(scheduler.interval(card.schedulerState, 0.9))) * DAY_MS;
      cards.push(card);
    }
  }
  return { id: options.id, reviews };
}

/** True weights for a learner who forgets much faster than FSRS-6 assumes. */
export function fasterForgetting(): number[] {
  const weights = [...default_w];
  for (let i = 0; i < 4; i++) weights[i] = weights[i]! * 0.25;
  return weights;
}
