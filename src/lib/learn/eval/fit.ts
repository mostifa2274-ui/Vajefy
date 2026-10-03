import { CLAMP_PARAMETERS, default_w, W17_W18_Ceiling } from "ts-fsrs";
import { clipFsrs6, fsrs6, type Rating } from "./models";
import { logLoss } from "./metrics";

/**
 * Personalised FSRS-6: weights fitted to one learner's earlier reviews by
 * minimising log loss, pulled towards the defaults so a short history cannot
 * move them far. Gradients are taken numerically, so this is for offline
 * evaluation, not for running on a phone.
 */

export type CardReviews = { at: number; rating: Rating }[];

const RANGES = CLAMP_PARAMETERS(W17_W18_Ceiling, true).map(([low, high]) => (high ?? 1) - (low ?? 0) || 1);

/** Log loss of FSRS-6 with these weights on reviews at least a day after the previous one. */
export function fsrs6Loss(weights: readonly number[], cards: CardReviews[]): { loss: number; n: number } {
  const model = fsrs6(weights);
  const predicted: number[] = [];
  const recalled: boolean[] = [];
  for (const reviews of cards) {
    let state = model.init(reviews[0]!.rating);
    for (let i = 1; i < reviews.length; i++) {
      const elapsed = model.elapsedOf(reviews[i - 1]!.at, reviews[i]!.at);
      if (elapsed >= 1) {
        predicted.push(model.predict(state, elapsed));
        recalled.push(reviews[i]!.rating > 1);
      }
      state = model.update(state, elapsed, reviews[i]!.rating);
    }
  }
  return { loss: logLoss(predicted, recalled), n: predicted.length };
}

export type FitOptions = { iterations?: number; learningRate?: number; regularisation?: number };

export function fitFsrs6(cards: CardReviews[], options: FitOptions = {}): { weights: number[]; loss: number; n: number } {
  const iterations = options.iterations ?? 40;
  const rate = options.learningRate ?? 0.02;
  const lambda = options.regularisation ?? 0.05;
  const start = [...default_w];
  const objective = (weights: number[]) => {
    const { loss, n } = fsrs6Loss(weights, cards);
    const penalty = weights.reduce((sum, value, index) => sum + ((value - start[index]!) / RANGES[index]!) ** 2, 0);
    return { value: (Number.isFinite(loss) ? loss : 10) + (lambda * penalty) / Math.max(1, Math.sqrt(n)), n };
  };

  let weights = [...start];
  let best = { weights, ...objective(weights) };
  // Adam on numerical gradients, scaled by each weight's allowed range.
  const m = new Array<number>(weights.length).fill(0);
  const v = new Array<number>(weights.length).fill(0);
  for (let step = 1; step <= iterations; step++) {
    const gradient = weights.map((value, index) => {
      const h = RANGES[index]! * 1e-3;
      const up = [...weights];
      const down = [...weights];
      up[index] = value + h;
      down[index] = value - h;
      return (objective(clipFsrs6(up)).value - objective(clipFsrs6(down)).value) / (2 * h);
    });
    weights = clipFsrs6(
      weights.map((value, index) => {
        m[index] = 0.9 * m[index]! + 0.1 * gradient[index]!;
        v[index] = 0.999 * v[index]! + 0.001 * gradient[index]! ** 2;
        const mHat = m[index]! / (1 - 0.9 ** step);
        const vHat = v[index]! / (1 - 0.999 ** step);
        return value - (rate * RANGES[index]! * mHat) / (Math.sqrt(vHat) + 1e-8);
      }),
    );
    const current = objective(weights);
    if (current.value < best.value) best = { weights, ...current };
  }
  const { loss, n } = fsrs6Loss(best.weights, cards);
  return { weights: best.weights, loss, n };
}
