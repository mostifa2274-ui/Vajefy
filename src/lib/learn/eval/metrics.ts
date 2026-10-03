/** Prediction quality on reviews the model had not seen (docs/EVALUATION.md). */

const EPSILON = 1e-6;

/** Mean binary cross-entropy: lower is better. */
export function logLoss(predicted: number[], recalled: boolean[]): number {
  if (!predicted.length) return Number.NaN;
  let sum = 0;
  predicted.forEach((p, index) => {
    const clamped = Math.min(1 - EPSILON, Math.max(EPSILON, p));
    sum -= recalled[index] ? Math.log(clamped) : Math.log(1 - clamped);
  });
  return sum / predicted.length;
}

/**
 * Calibration error: reviews are grouped into 20 bins by predicted recall, and
 * the bins' mean prediction is compared with their observed recall rate,
 * weighted by size. Lower is better.
 */
export function rmseBins(predicted: number[], recalled: boolean[], bins = 20): number {
  if (!predicted.length) return Number.NaN;
  const groups = Array.from({ length: bins }, () => ({ n: 0, p: 0, y: 0 }));
  predicted.forEach((p, index) => {
    const group = groups[Math.min(bins - 1, Math.max(0, Math.floor(p * bins)))]!;
    group.n += 1;
    group.p += p;
    group.y += recalled[index] ? 1 : 0;
  });
  let sum = 0;
  for (const group of groups) if (group.n) sum += group.n * (group.p / group.n - group.y / group.n) ** 2;
  return Math.sqrt(sum / predicted.length);
}

/** Probability that a recalled review was predicted higher than a forgotten one. 0.5 is chance. */
export function auc(predicted: number[], recalled: boolean[]): number {
  const ranked = predicted.map((p, index) => ({ p, y: recalled[index]! })).sort((a, b) => a.p - b.p);
  let positives = 0;
  let negatives = 0;
  let rankSum = 0;
  for (let i = 0; i < ranked.length; ) {
    let j = i;
    while (j < ranked.length && ranked[j]!.p === ranked[i]!.p) j++;
    const averageRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      if (ranked[k]!.y) {
        positives++;
        rankSum += averageRank;
      } else negatives++;
    }
    i = j;
  }
  if (!positives || !negatives) return Number.NaN;
  return (rankSum - (positives * (positives + 1)) / 2) / (positives * negatives);
}

/** Predicted and observed recall by tenth of predicted recall. */
export function calibration(predicted: number[], recalled: boolean[]): { from: number; to: number; n: number; predicted: number; observed: number }[] {
  const rows = Array.from({ length: 10 }, (_, index) => ({ from: index / 10, to: (index + 1) / 10, n: 0, predicted: 0, observed: 0 }));
  predicted.forEach((p, index) => {
    const row = rows[Math.min(9, Math.max(0, Math.floor(p * 10)))]!;
    row.n += 1;
    row.predicted += p;
    row.observed += recalled[index] ? 1 : 0;
  });
  return rows
    .filter((row) => row.n)
    .map((row) => ({ ...row, predicted: row.predicted / row.n, observed: row.observed / row.n }));
}

export type Interval = { mean: number; low: number; high: number; n: number };

function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/** The mean with a 95% percentile-bootstrap interval, resampling learners. */
export function bootstrapMean(values: number[], resamples = 2000, seed = 1): Interval {
  const n = values.length;
  if (!n) return { mean: Number.NaN, low: Number.NaN, high: Number.NaN, n };
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  const random = seededRandom(seed);
  const means: number[] = [];
  for (let r = 0; r < resamples; r++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += values[Math.floor(random() * n)]!;
    means.push(sum / n);
  }
  means.sort((a, b) => a - b);
  return { mean, low: means[Math.floor(0.025 * resamples)]!, high: means[Math.ceil(0.975 * resamples) - 1]!, n };
}

/** Difference of two groups' means (a − b), with a 95% bootstrap interval. */
export function bootstrapDifference(a: number[], b: number[], resamples = 2000, seed = 1): Interval {
  if (!a.length || !b.length) return { mean: Number.NaN, low: Number.NaN, high: Number.NaN, n: a.length + b.length };
  const random = seededRandom(seed);
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const draw = (values: number[]) => {
    let sum = 0;
    for (let i = 0; i < values.length; i++) sum += values[Math.floor(random() * values.length)]!;
    return sum / values.length;
  };
  const differences: number[] = [];
  for (let r = 0; r < resamples; r++) differences.push(draw(a) - draw(b));
  differences.sort((x, y) => x - y);
  return {
    mean: average(a) - average(b),
    low: differences[Math.floor(0.025 * resamples)]!,
    high: differences[Math.ceil(0.975 * resamples) - 1]!,
    n: a.length + b.length,
  };
}
