import {
  Rating,
  State,
  createEmptyCard,
  default_w,
  fsrs,
  type Card as FsrsCard,
  type CardInput as FsrsCardInput,
  type Grade as FsrsGrade,
} from "ts-fsrs";
import type { CardProg, FsrsCardState, Grade } from "./types";

const DAY = 86_400_000;
const MIN_EASE = 1.3;
export const DEFAULT_REQUEST_RETENTION = 0.9;

export type ScheduleMeta = {
  algorithm: "legacy" | "fsrs6";
  bridged?: boolean;
  elapsedDays: number;
  scheduledDays: number;
  stability?: number;
  difficulty?: number;
};

export type ScheduleResult = {
  card: CardProg;
  meta: ScheduleMeta;
};

const RATING: Record<Grade, FsrsGrade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeRetention(value: number): number {
  return clamp(Number.isFinite(value) ? value : DEFAULT_REQUEST_RETENTION, 0.8, 0.97);
}

function fsrsStateName(state: State): FsrsCardState["state"] {
  switch (state) {
    case State.New:
      return "new";
    case State.Learning:
      return "learning";
    case State.Review:
      return "review";
    case State.Relearning:
      return "relearning";
  }
}

function fsrsStateValue(state: FsrsCardState["state"]): State {
  switch (state) {
    case "new":
      return State.New;
    case "learning":
      return State.Learning;
    case "review":
      return State.Review;
    case "relearning":
      return State.Relearning;
  }
}

function nativeFsrsState(card: FsrsCard): FsrsCardState {
  return {
    model: "fsrs6",
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    state: fsrsStateName(card.state),
    ...(card.last_review ? { lastReview: card.last_review.getTime() } : {}),
  };
}

export function freshCard(now: number): CardProg {
  const card = createEmptyCard(new Date(now));
  return {
    ease: 2.5,
    interval: 0,
    due: now,
    reps: 0,
    lapses: 0,
    state: "learning",
    step: 0,
    fsrs: nativeFsrsState(card),
  };
}

export function isMastered(card: CardProg): boolean {
  if (card.fsrs) return card.fsrs.state === "review" && card.fsrs.stability >= 21;
  return card.state === "review" && card.interval >= 21;
}

/** When the card was last graded; older saves only imply it from due − interval. */
function lastGraded(card: CardProg): number {
  return card.last ?? card.due - card.interval * DAY;
}

/**
 * Official FSRS-6 bridge from an SM-2 style ease/interval pair.
 *
 * The Rust reference implementation exposes memory_state_from_sm2(). ts-fsrs
 * does not currently expose that helper, so we use the same published FSRS-6
 * formula with ts-fsrs' own default parameter vector. No historical reviews are
 * synthesized: this produces only a starting memory state for the next real
 * answer.
 */
function bridgeLegacyReview(card: CardProg, requestRetention: number): FsrsCardInput {
  const retention = normalizeRetention(requestRetention);
  const interval = Math.max(0.001, card.interval || 0.001);
  const w8 = default_w[8]!;
  const w9 = default_w[9]!;
  const w10 = default_w[10]!;
  const decay = -default_w[20]!;
  const factor = Math.pow(0.9, 1 / decay) - 1;
  const stability = interval * factor / (Math.pow(retention, 1 / decay) - 1);
  const denominator =
    Math.exp(w8) *
    Math.pow(stability, -w9) *
    Math.expm1((1 - retention) * w10);
  const difficulty = clamp(11 - (card.ease - 1) / denominator, 1, 10);
  const last = lastGraded(card);

  return {
    due: new Date(card.due),
    stability,
    difficulty,
    elapsed_days: Math.max(0, Math.round((card.due - last) / DAY)),
    scheduled_days: Math.max(1, Math.round(card.interval || 1)),
    learning_steps: 0,
    reps: card.reps,
    lapses: card.lapses,
    state: State.Review,
    last_review: new Date(last),
  };
}

function storedFsrsInput(card: CardProg): FsrsCardInput {
  const state = card.fsrs;
  if (!state) throw new Error("FSRS state is required.");
  return {
    due: new Date(card.due),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: 0,
    scheduled_days: state.scheduledDays,
    learning_steps: state.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: fsrsStateValue(state.state),
    last_review: state.lastReview ?? card.last ?? null,
  };
}

function fromFsrsCard(previous: CardProg, card: FsrsCard): CardProg {
  return {
    ...previous,
    interval: card.scheduled_days,
    due: card.due.getTime(),
    reps: card.reps,
    lapses: card.lapses,
    state: card.state === State.Review ? "review" : "learning",
    step: card.learning_steps,
    ...(card.last_review ? { last: card.last_review.getTime() } : {}),
    fsrs: nativeFsrsState(card),
  };
}

function scheduleFsrs(
  card: CardProg,
  grade: Grade,
  now: number,
  requestRetention: number,
  bridged: boolean,
): ScheduleResult {
  const retention = normalizeRetention(requestRetention);
  const scheduler = fsrs({
    request_retention: retention,
    enable_fuzz: false,
    learning_steps: ["1m", "10m"],
    relearning_steps: ["10m"],
  });
  const input = bridged ? bridgeLegacyReview(card, retention) : storedFsrsInput(card);
  const result = scheduler.next(input, new Date(now), RATING[grade]);
  return {
    card: fromFsrsCard(card, result.card),
    meta: {
      algorithm: "fsrs6",
      ...(bridged ? { bridged: true } : {}),
      elapsedDays: result.log.elapsed_days,
      scheduledDays: result.card.scheduled_days,
      stability: result.card.stability,
      difficulty: result.card.difficulty,
    },
  };
}

function scheduleLegacy(card: CardProg, grade: Grade, now: number): ScheduleResult {
  const next: CardProg = { ...card, last: now };

  if (grade === "again") {
    next.ease = Math.max(MIN_EASE, next.ease - 0.2);
    next.lapses += 1;
    next.reps = 0;
    next.state = "learning";
    next.step = 0;
    next.interval = 0;
    next.due = now + 60_000;
    return {
      card: next,
      meta: { algorithm: "legacy", elapsedDays: 0, scheduledDays: 0 },
    };
  }

  if (grade === "hard") next.ease = Math.max(MIN_EASE, next.ease - 0.05);
  if (grade === "easy") next.ease += 0.15;

  if (next.state === "learning") {
    if (grade === "easy") {
      next.state = "review";
      next.step = 0;
      next.interval = 4;
      next.reps = 1;
      next.due = now + 4 * DAY;
      return {
        card: next,
        meta: { algorithm: "legacy", elapsedDays: 0, scheduledDays: 4 },
      };
    }
    if (grade === "hard") {
      next.due = now + 8 * 60_000;
      return {
        card: next,
        meta: { algorithm: "legacy", elapsedDays: 0, scheduledDays: 0 },
      };
    }
    if (next.step <= 0) {
      next.step = 1;
      next.due = now + 10 * 60_000;
      return {
        card: next,
        meta: { algorithm: "legacy", elapsedDays: 0, scheduledDays: 0 },
      };
    }
    next.state = "review";
    next.step = 0;
    next.interval = 1;
    next.reps = 1;
    next.due = now + DAY;
    return {
      card: next,
      meta: { algorithm: "legacy", elapsedDays: 0, scheduledDays: 1 },
    };
  }

  // Kept only for legacy cards still inside learning steps. Review-state legacy
  // cards are bridged to FSRS before reaching this branch.
  const current = card.interval || 1;
  const elapsed = Math.max(0, (now - lastGraded(card)) / DAY);
  const base = Math.min(current, elapsed);
  const factor = grade === "hard" ? 1.2 : grade === "good" ? next.ease : next.ease * 1.3;
  const interval = Math.max(current, Math.round(base * factor));
  next.interval = interval;
  next.reps += 1;
  next.due = now + interval * DAY;
  return {
    card: next,
    meta: {
      algorithm: "legacy",
      elapsedDays: elapsed,
      scheduledDays: interval,
    },
  };
}

export function scheduleWithMeta(
  card: CardProg,
  grade: Grade,
  now: number,
  requestRetention = DEFAULT_REQUEST_RETENTION,
): ScheduleResult {
  if (card.fsrs) return scheduleFsrs(card, grade, now, requestRetention, false);
  // Preserve old short learning steps exactly; once an older card has graduated
  // to review, bridge it at its next real review rather than rewriting its due
  // date or inventing historical answers.
  if (card.state === "review" && card.interval > 0) {
    return scheduleFsrs(card, grade, now, requestRetention, true);
  }
  return scheduleLegacy(card, grade, now);
}

export function schedule(
  card: CardProg,
  grade: Grade,
  now: number,
  requestRetention = DEFAULT_REQUEST_RETENTION,
): CardProg {
  return scheduleWithMeta(card, grade, now, requestRetention).card;
}

export function retrievability(
  card: CardProg,
  now = Date.now(),
  requestRetention = DEFAULT_REQUEST_RETENTION,
): number | null {
  if (!card.fsrs && card.state !== "review") return null;
  const retention = normalizeRetention(requestRetention);
  const scheduler = fsrs({
    request_retention: retention,
    enable_fuzz: false,
    learning_steps: ["1m", "10m"],
    relearning_steps: ["10m"],
  });
  const input = card.fsrs ? storedFsrsInput(card) : bridgeLegacyReview(card, retention);
  return scheduler.get_retrievability(input, new Date(now), false);
}
