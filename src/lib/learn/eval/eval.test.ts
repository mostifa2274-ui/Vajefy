import assert from "node:assert/strict";
import test from "node:test";
import { evaluateLearner } from "./evaluate";
import { auc, bootstrapDifference, bootstrapMean, calibration, logLoss, rmseBins } from "./metrics";
import { fasterForgetting, simulateLearner } from "./simulate";

test("metrics reward separation and calibration, and treat a constant guess as chance", () => {
  const recalled = [true, true, true, false, false];
  assert.equal(auc([0.9, 0.8, 0.7, 0.2, 0.1], recalled), 1);
  assert.equal(auc([0.5, 0.5, 0.5, 0.5, 0.5], recalled), 0.5);
  assert.ok(Math.abs(logLoss([0.5, 0.5], [true, false]) - Math.LN2) < 1e-12);
  // Forty reviews predicted at 0.75, of which thirty were recalled: perfectly calibrated.
  const p = new Array(40).fill(0.75);
  const y = Array.from({ length: 40 }, (_, index) => index < 30);
  assert.ok(rmseBins(p, y) < 1e-12);
  assert.deepEqual(calibration(p, y).map((row) => [row.n, row.observed]), [[40, 0.75]]);
});

test("a model fitted to a learner's earlier reviews predicts their later ones better when the defaults are wrong", () => {
  const learner = simulateLearner({ id: "fast-forgetter", trueWeights: fasterForgetting(), days: 60, newPerDay: 10, seed: 7 });
  const result = evaluateLearner(learner, { fit: { iterations: 25 } });
  assert.equal(result.personalised, true);
  const score = (name: string) => result.scores.find((item) => item.model.startsWith(name))!;
  const active = score("FSRS-6 (default");
  const personal = score("FSRS-6 (personalised");
  assert.ok(personal.n > 300 && personal.n === active.n, "judged on the same later reviews");
  assert.ok(personal.logLoss < active.logLoss, `log loss ${personal.logLoss} < ${active.logLoss}`);
  assert.ok(personal.rmseBins < active.rmseBins, `calibration ${personal.rmseBins} < ${active.rmseBins}`);
  // This learner forgets faster, so a faithful model asks for more reviews: workload must be weighed too.
  assert.ok(personal.reviewsPerDay! > active.reviewsPerDay!);
  assert.ok(score("FSRS-7").n === active.n, "the shadow FSRS-7 is judged on the same reviews");
});

test("a learner with little history keeps the default weights", () => {
  const learner = simulateLearner({ id: "new", days: 5, newPerDay: 5, seed: 3 });
  const result = evaluateLearner(learner);
  assert.equal(result.personalised, false);
  assert.equal(result.group, "under 100 reviews");
});

test("bootstrap intervals contain the mean and narrow with more learners", () => {
  const few = [1, 2, 3, 4, 5];
  const many = Array.from({ length: 200 }, (_, index) => (index % 5) + 1);
  const small = bootstrapMean(few);
  const large = bootstrapMean(many);
  assert.equal(small.mean, 3);
  assert.ok(small.low <= 3 && small.high >= 3);
  assert.ok(large.high - large.low < small.high - small.low);
  const difference = bootstrapDifference(many.map((value) => value + 1), many);
  assert.ok(Math.abs(difference.mean - 1) < 1e-12 && difference.low > 0, "a clear difference excludes zero");
});
