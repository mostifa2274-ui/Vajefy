import { auc, calibration, logLoss, rmseBins } from "./metrics";
import { fitFsrs6, type CardReviews } from "./fit";
import { calendarDays, fsrs6, fsrs7, type MemoryModel, type Rating } from "./models";

/**
 * Chronological evaluation for one learner: models are fitted (if at all) on
 * the reviews before a cut-off time and judged only on the later reviews,
 * which they never saw. Every review still updates the memory state.
 */

export type ReviewLog = { card: string; at: number; rating: Rating };
export type Learner = { id: string; reviews: ReviewLog[] };

export type ModelScore = {
  model: string;
  /** Later reviews judged: at least a day after the card's previous review. */
  n: number;
  logLoss: number;
  rmseBins: number;
  auc: number;
  /** Reviews a day over the next 30 days at 90% retention, if every one succeeds: a workload projection. */
  reviewsPerDay: number | null;
  calibration: ReturnType<typeof calibration>;
};

export type LearnerResult = {
  learner: string;
  reviews: number;
  /** Limited history is where defaults and personalisation differ most. */
  group: "under 100 reviews" | "100–999 reviews" | "1000+ reviews";
  personalised: boolean;
  scores: ModelScore[];
};

export type EvaluationOptions = { trainShare?: number; minTrain?: number; fit?: Parameters<typeof fitFsrs6>[1]; horizonDays?: number };

function byCard(reviews: ReviewLog[]): Map<string, ReviewLog[]> {
  const cards = new Map<string, ReviewLog[]>();
  for (const review of [...reviews].sort((a, b) => a.at - b.at)) {
    const list = cards.get(review.card) ?? [];
    list.push(review);
    cards.set(review.card, list);
  }
  return cards;
}

function score<S>(model: MemoryModel<S>, cards: Map<string, ReviewLog[]>, cutoff: number, horizonDays: number): ModelScore {
  const predicted: number[] = [];
  const recalled: boolean[] = [];
  let projected = 0;
  for (const reviews of cards.values()) {
    let state = model.init(reviews[0]!.rating);
    for (let i = 1; i < reviews.length; i++) {
      const elapsed = model.elapsedOf(reviews[i - 1]!.at, reviews[i]!.at);
      // Every model is judged on the same reviews: later than the cut-off, and
      // on a later calendar day than the card's previous review.
      if (reviews[i]!.at >= cutoff && calendarDays(reviews[i - 1]!.at, reviews[i]!.at) >= 1) {
        predicted.push(model.predict(state, elapsed));
        recalled.push(reviews[i]!.rating > 1);
      }
      state = model.update(state, elapsed, reviews[i]!.rating);
    }
    // Workload projection from the final state, assuming each review succeeds.
    let day = 0;
    let projectedState = state;
    for (let guard = 0; guard < 100; guard++) {
      const next = Math.max(1, model.interval(projectedState, 0.9));
      if (day + next > horizonDays) break;
      day += next;
      projected++;
      projectedState = model.update(projectedState, next, 3);
    }
  }
  return {
    model: model.name,
    n: predicted.length,
    logLoss: logLoss(predicted, recalled),
    rmseBins: rmseBins(predicted, recalled),
    auc: auc(predicted, recalled),
    reviewsPerDay: projected / horizonDays,
    calibration: calibration(predicted, recalled),
  };
}

/** A reference with no memory model: always the recall rate seen before the cut-off. */
function baseline(cards: Map<string, ReviewLog[]>, cutoff: number): ModelScore {
  const train: boolean[] = [];
  const recalled: boolean[] = [];
  for (const reviews of cards.values()) {
    for (let i = 1; i < reviews.length; i++) {
      if (calendarDays(reviews[i - 1]!.at, reviews[i]!.at) < 1) continue;
      (reviews[i]!.at < cutoff ? train : recalled).push(reviews[i]!.rating > 1);
    }
  }
  const rate = train.length ? train.filter(Boolean).length / train.length : 0.9;
  const predicted = recalled.map(() => rate);
  return { model: "Average recall", n: predicted.length, logLoss: logLoss(predicted, recalled), rmseBins: rmseBins(predicted, recalled), auc: auc(predicted, recalled), reviewsPerDay: null, calibration: calibration(predicted, recalled) };
}

export function evaluateLearner(learner: Learner, options: EvaluationOptions = {}): LearnerResult {
  const trainShare = options.trainShare ?? 0.7;
  const minTrain = options.minTrain ?? 100;
  const horizon = options.horizonDays ?? 30;
  const sorted = [...learner.reviews].sort((a, b) => a.at - b.at);
  const cutoff = sorted[Math.floor(sorted.length * trainShare)]?.at ?? Number.POSITIVE_INFINITY;
  const cards = byCard(sorted);
  const training: CardReviews[] = [...byCard(sorted.filter((review) => review.at < cutoff)).values()].filter((reviews) => reviews.length > 1);
  const trainingReviews = training.reduce((sum, reviews) => sum + reviews.length - 1, 0);
  const personalised = trainingReviews >= minTrain;
  const fitted = personalised ? fitFsrs6(training, options.fit).weights : undefined;
  const scores = [
    baseline(cards, cutoff),
    score(fsrs6(undefined, "FSRS-6 (default, active)"), cards, cutoff, horizon),
    score(fsrs6(fitted, personalised ? "FSRS-6 (personalised)" : "FSRS-6 (personalised: too little history, defaults)"), cards, cutoff, horizon),
    score(fsrs7(undefined, "FSRS-7 (default, shadow)"), cards, cutoff, horizon),
  ];
  const count = sorted.length;
  return {
    learner: learner.id,
    reviews: count,
    group: count < 100 ? "under 100 reviews" : count < 1000 ? "100–999 reviews" : "1000+ reviews",
    personalised,
    scores,
  };
}
