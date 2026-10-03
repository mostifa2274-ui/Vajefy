import { clipParameters, default_w, fsrs, type FSRS } from "ts-fsrs";
import { FSRS7Algorithm, FSRS7_DEFAULT_WEIGHTS, FSRS7_MODEL_BOUNDS } from "ts-fsrs-next/models/fsrs-7";

/**
 * Memory models compared by the evaluation (docs/EVALUATION.md). Each replays
 * a card's reviews and predicts the probability of recall at the next one.
 * None of this runs in the app: shadow schedulers are replayed from recorded
 * review logs, which gives exactly what recording them live would have.
 */

export type Rating = 1 | 2 | 3 | 4;
export const DAY_MS = 86_400_000;

export interface MemoryModel<State> {
  name: string;
  /** State after a card's first review. */
  init(rating: Rating): State;
  /** Probability of recall after `elapsed` (see `elapsedOf`). */
  predict(state: State, elapsed: number): number;
  update(state: State, elapsed: number, rating: Rating): State;
  /** Days until recall probability falls to `retention`. */
  interval(state: State, retention: number): number;
  /** How the model measures time between reviews. */
  elapsedOf(previous: number, at: number): number;
}

/** FSRS-6 counts whole calendar days, as the app's scheduler does. */
export function calendarDays(previous: number, at: number): number {
  return Math.max(0, Math.floor(at / DAY_MS) - Math.floor(previous / DAY_MS));
}

type FSRS6State = { stability: number; difficulty: number };

/** FSRS-6 with the given 21 weights: the defaults are the app's active scheduler. */
export function fsrs6(weights: readonly number[] = default_w, name = "FSRS-6"): MemoryModel<FSRS6State> {
  const make = (retention: number): FSRS => fsrs({ w: [...weights], request_retention: retention, enable_fuzz: false, enable_short_term: true });
  const base = make(0.9);
  const byRetention = new Map<number, FSRS>([[0.9, base]]);
  return {
    name,
    init: (rating) => base.next_state(null, 0, rating),
    predict: (state, elapsed) => base.forgetting_curve(elapsed, state.stability),
    update: (state, elapsed, rating) => base.next_state(state, elapsed, rating),
    interval: (state, retention) => {
      let scheduler = byRetention.get(retention);
      if (!scheduler) byRetention.set(retention, (scheduler = make(retention)));
      return scheduler.next_interval(state.stability, 0);
    },
    elapsedOf: calendarDays,
  };
}

/** Keep FSRS-6 weights inside the library's allowed ranges. */
export function clipFsrs6(weights: number[]): number[] {
  return clipParameters(weights, 1, true);
}

type FSRS7State = { stability: number; stabilityFast: number; difficulty: number };

/**
 * FSRS-7 (ts-fsrs 6.0 beta, a port of fsrs-rs), with fractional days. It is a
 * shadow model only: nothing in the app schedules with it.
 */
export function fsrs7(weights: readonly number[] = FSRS7_DEFAULT_WEIGHTS, name = "FSRS-7"): MemoryModel<FSRS7State> {
  const algorithm = new FSRS7Algorithm(weights, FSRS7_MODEL_BOUNDS);
  return {
    name,
    init: (rating) => algorithm.next_state(null, 0, rating),
    predict: (state, elapsed) => algorithm.curve(elapsed, state).retrievability,
    update: (state, elapsed, rating) => algorithm.next_state(state, elapsed, rating, algorithm.curve(elapsed, state).retrievability),
    interval: (state, retention) => algorithm.next_interval(state, retention),
    elapsedOf: (previous, at) => Math.max(0, (at - previous) / DAY_MS),
  };
}

export { default_w as FSRS6_DEFAULT_WEIGHTS };
