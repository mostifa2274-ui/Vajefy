import fs from "node:fs";
import path from "node:path";
import { evaluateLearner, type Learner, type LearnerResult, type ReviewLog } from "../src/lib/learn/eval/evaluate.ts";
import { bootstrapDifference, bootstrapMean } from "../src/lib/learn/eval/metrics.ts";
import type { Rating } from "../src/lib/learn/eval/models.ts";
import { fasterForgetting, simulateLearner } from "../src/lib/learn/eval/simulate.ts";
import {
  ASSESSMENT_PROTOCOL_ID,
  STUDY_VERSION,
} from "../src/lib/learn/study.ts";
import {
  validateAssessmentEvidence,
  validateStudyProtocols,
  type StudyProtocolRecord,
} from "../src/lib/learn/study-protocol.ts";

/**
 * The pilot study's analysis (docs/EVALUATION.md):
 *
 *   npm run evaluate -- <study files or folders> [--out report.md]
 *   npm run evaluate -- --simulate 6          (synthetic learners, to check the method)
 *
 * For each learner it compares, on reviews the models had not seen, the active
 * FSRS-6, FSRS-6 personalised on the learner's earlier reviews, and FSRS-7 as a
 * shadow; and it reports the principal measure from the 30-day check-ups.
 */

type Event = {
  id: string;
  type: string;
  at: number;
  item?: string;
  grade?: string;
  undone?: boolean;
  context?: {
    responseMs?: number;
    session?: string;
    prompt?: string;
    promptId?: string;
    contentVersion?: string;
  };
  assessment?: { part: "meaning" | "use"; correct?: boolean; missing?: true; delayDays: number };
};

const RATING: Record<string, Rating> = { again: 1, hard: 2, good: 3, easy: 4 };
const args = process.argv.slice(2);
const option = (flag: string) => {
  const at = args.indexOf(flag);
  return at >= 0 ? args[at + 1] : undefined;
};
const VALUE_FLAGS = new Set(["--out", "--simulate"]);
const inputs: string[] = [];
for (let index = 0; index < args.length; index++) {
  const arg = args[index]!;
  if (VALUE_FLAGS.has(arg)) {
    index += 1;
    continue;
  }
  if (!arg.startsWith("--")) inputs.push(arg);
}
const allowMixedProtocols = args.includes("--allow-mixed-protocols");

type Outcome = { arm: string; checked: number; usable: number; missing: number; activeHours: number };
const learners: Learner[] = [];
const outcomes = new Map<string, Outcome>();
const studyProtocols: StudyProtocolRecord[] = [];
const protocolErrors: string[] = [];

function files(target: string): string[] {
  if (!fs.existsSync(target)) return [];
  if (fs.statSync(target).isDirectory()) return fs.readdirSync(target).filter((name) => name.endsWith(".json")).map((name) => path.join(target, name));
  return [target];
}

for (const file of inputs.flatMap(files)) {
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  if (data.kind === "vajefy-study") {
    const events = Array.isArray(data.events) ? (data.events as Event[]) : [];
    const participant = typeof data.participant === "string" ? data.participant : "";
    const exportVersion =
      typeof data.version === "number" ? data.version : Number.NaN;
    const app =
      data.app && typeof data.app === "object"
        ? (data.app as Record<string, unknown>)
        : {};
    const protocol =
      data.protocol && typeof data.protocol === "object"
        ? (data.protocol as Record<string, unknown>)
        : {};
    const assessment =
      protocol.assessment && typeof protocol.assessment === "object"
        ? (protocol.assessment as Record<string, unknown>)
        : {};
    const contentVersion =
      typeof app.contentVersion === "string" && app.contentVersion
        ? app.contentVersion
        : null;
    const channel =
      typeof app.channel === "string" && app.channel ? app.channel : null;
    const build =
      typeof app.build === "string" && app.build ? app.build : null;
    studyProtocols.push({
      source: file,
      participant,
      version: exportVersion,
      contentVersion,
      channel,
      build,
      assessmentProtocol:
        typeof assessment.id === "string" ? assessment.id : null,
      assessmentBankContentVersion:
        typeof assessment.bankContentVersion === "string"
          ? assessment.bankContentVersion
          : null,
    });
    if (exportVersion >= 2) {
      protocolErrors.push(...validateAssessmentEvidence(file, events));
    }

    const reviews: ReviewLog[] = events
      .filter((event) => event.type === "review" && !event.undone && event.item && event.grade && RATING[event.grade])
      .map((event) => ({ card: event.item!, at: event.at, rating: RATING[event.grade!]! }));
    const id = participant;
    learners.push({ id, reviews });
    // A word is usable after 30 days only when both required parts were
    // actually observed. Missing held-out evidence is reported, never scored
    // as an incorrect learner answer.
    const parts = new Map<string, { meaning?: boolean; use?: boolean; missing?: boolean }>();
    for (const event of events) {
      if (event.type !== "assessment" || !event.assessment || event.assessment.delayDays < 30) continue;
      const key = `${event.context?.session ?? ""}\u0000${event.item}`;
      const previous = parts.get(key) ?? {};
      if (event.assessment.missing) {
        parts.set(key, { ...previous, missing: true });
      } else if (event.assessment.correct !== undefined) {
        parts.set(key, { ...previous, [event.assessment.part]: event.assessment.correct });
      }
    }
    const results = [...parts.values()];
    const complete = results.filter((item) => item.meaning !== undefined && item.use !== undefined);
    const activeMs = events.reduce((sum, event) => sum + (event.context?.responseMs ?? 0), 0);
    const arm = channel === "none" ? "comparison (current flow)" : "enhanced";
    outcomes.set(id, {
      arm,
      checked: complete.length,
      usable: complete.filter((item) => item.meaning && item.use).length,
      missing: results.length - complete.length,
      activeHours: activeMs / 3_600_000,
    });
  } else if (data.kind === "roshana-progress") {
    const progress = data.progress as { reviewHistory?: { id: string; at: number; grade: string }[] };
    learners.push({
      id: path.basename(file, ".json"),
      reviews: (progress.reviewHistory ?? []).filter((event) => RATING[event.grade]).map((event) => ({ card: event.id, at: event.at, rating: RATING[event.grade]! })),
    });
  } else {
    console.error(`${file}: not a study export or backup, skipped`);
  }
}

const protocolValidation = validateStudyProtocols(
  studyProtocols,
  allowMixedProtocols,
);
protocolErrors.push(...protocolValidation.errors);
if (protocolErrors.length) {
  console.error(
    [
      "Study protocol validation failed:",
      ...protocolErrors.map((error) => `- ${error}`),
    ].join("\n"),
  );
  process.exit(1);
}

const simulated = Number(option("--simulate") ?? 0);
for (let index = 0; index < simulated; index++) {
  learners.push(
    simulateLearner({
      id: `simulated-${index + 1}${index % 2 ? "-fast-forgetting" : ""}`,
      trueWeights: index % 2 ? fasterForgetting() : undefined,
      days: 30 + 15 * (index % 4),
      newPerDay: 5 + 5 * (index % 3),
      seed: index + 1,
    }),
  );
}

if (!learners.length) {
  console.error(
    "Usage: npm run evaluate -- <study files or folders> [--out report.md] [--allow-mixed-protocols] | --simulate <n>",
  );
  process.exit(1);
}

const results: LearnerResult[] = learners.map((learner) => evaluateLearner(learner));
const fixed = (value: number | null | undefined, digits = 3) => (value == null || !Number.isFinite(value) ? "–" : value.toFixed(digits));
const lines: string[] = [];
lines.push(`# Scheduler and learning evaluation`, "");
if (simulated) lines.push(`**${simulated} of ${learners.length} learners are simulated**, to check the method; they are not evidence about real learners.`, "");
if (studyProtocols.length) {
  const protocol = protocolValidation.summary;
  const armCounts = {
    enhanced: studyProtocols.filter((item) => item.channel !== "none").length,
    comparison: studyProtocols.filter((item) => item.channel === "none").length,
  };
  lines.push(
    "## Study protocol integrity",
    "",
    `- Export schema: ${protocol.exportVersions.join(", ")} (current supported: ${STUDY_VERSION})`,
    `- Content / assessment-bank version: ${protocol.contentVersions.join(", ")}`,
    `- Delayed-assessment protocol: ${protocol.assessmentProtocols.join(", ")} (current: ${ASSESSMENT_PROTOCOL_ID})`,
    `- Deployment builds observed: ${protocol.builds.length ? protocol.builds.join(", ") : "legacy exports did not record build ids"}`,
    `- Arms: ${armCounts.enhanced} enhanced, ${armCounts.comparison} comparison`,
    "",
  );
  if (protocolValidation.warnings.length) {
    lines.push(
      "**Exploratory mixed-protocol analysis:**",
      ...protocolValidation.warnings.map((warning) => `- ${warning}`),
      "",
    );
  }
}
lines.push(
  "Models are judged only on reviews after each learner's 70% time cut-off, at least a calendar day after the card's previous review. Personalised FSRS-6 is fitted on the reviews before the cut-off. Lower log loss and calibration error (RMSE) are better; AUC above 0.5 means recalled reviews were predicted higher. Reviews a day is a projection for the next 30 days at 90% retention if every review succeeds.",
  "",
);

for (const result of results) {
  lines.push(`## ${result.learner}`, "", `${result.reviews} reviews (${result.group}); personalised: ${result.personalised ? "yes" : "no, too little history"}.`, "");
  lines.push("| Model | Judged | Log loss | RMSE (bins) | AUC | Reviews a day |", "|---|---|---|---|---|---|");
  for (const score of result.scores) {
    lines.push(`| ${score.model} | ${score.n} | ${fixed(score.logLoss)} | ${fixed(score.rmseBins)} | ${fixed(score.auc)} | ${fixed(score.reviewsPerDay, 1)} |`);
  }
  const outcome = outcomes.get(result.learner);
  if (outcome) {
    lines.push(
      "",
      `30-day check-up: ${outcome.usable} of ${outcome.checked} fully observed words recalled and used; ${outcome.missing} missing held-out measurements; ${fixed(outcome.activeHours, 2)} active hours; ${outcome.activeHours > 0 ? fixed(outcome.usable / outcome.activeHours, 1) : "–"} usable words per active hour.`,
    );
  }
  lines.push("");
}

// Pooled over learners, weighted by judged reviews, per history group.
lines.push("## Summary", "", "| History | Model | Learners | Judged | Log loss | RMSE (bins) | Better than active |", "|---|---|---|---|---|---|---|");
for (const group of ["under 100 reviews", "100–999 reviews", "1000+ reviews"] as const) {
  const inGroup = results.filter((result) => result.group === group);
  if (!inGroup.length) continue;
  const models = inGroup[0]!.scores.map((score) => score.model.replace(/: too little history, defaults/, ""));
  models.forEach((model, column) => {
    let n = 0;
    let loss = 0;
    let squared = 0;
    let better = 0;
    for (const result of inGroup) {
      const score = result.scores[column]!;
      if (!score.n) continue;
      n += score.n;
      loss += score.logLoss * score.n;
      squared += score.rmseBins ** 2 * score.n;
      if (score.logLoss < result.scores[1]!.logLoss) better++;
    }
    lines.push(`| ${group} | ${model} | ${inGroup.length} | ${n} | ${fixed(loss / n)} | ${fixed(Math.sqrt(squared / n))} | ${column === 1 ? "–" : `${better} of ${inGroup.length}`} |`);
  });
}
// Uncertainty: 95% bootstrap intervals over learners.
const interval = (value: { mean: number; low: number; high: number; n: number }, digits = 3) =>
  `${fixed(value.mean, digits)} (95% interval ${fixed(value.low, digits)} to ${fixed(value.high, digits)}; ${value.n} learners)`;
lines.push("", "### Differences from the active scheduler", "", "Mean per-learner difference in log loss on later reviews; below zero is better than the active FSRS-6.", "");
const personalised = results.filter((result) => result.personalised);
const differences = (column: number, from: LearnerResult[]) => from.map((result) => result.scores[column]!.logLoss - result.scores[1]!.logLoss).filter(Number.isFinite);
lines.push(`- Personalised FSRS-6: ${interval(bootstrapMean(differences(2, personalised)), 4)}`);
lines.push(`- FSRS-7 (shadow): ${interval(bootstrapMean(differences(3, results)), 4)}`);

const perHour = (arm: string) =>
  [...outcomes.values()].filter((item) => item.arm === arm && item.checked && item.activeHours > 0).map((item) => item.usable / item.activeHours);
if ([...outcomes.values()].some((item) => item.checked)) {
  lines.push("", "### Principal measure", "", "Words recalled and used correctly 30 days or more after they were first met, per active study hour.", "");
  for (const arm of ["enhanced", "comparison (current flow)"]) {
    const values = perHour(arm);
    if (values.length) lines.push(`- ${arm}: ${interval(bootstrapMean(values), 1)}`);
  }
  const enhanced = perHour("enhanced");
  const comparison = perHour("comparison (current flow)");
  if (enhanced.length && comparison.length) {
    lines.push(`- Difference, enhanced − comparison: ${interval(bootstrapDifference(enhanced, comparison), 1)}`);
  }
}
lines.push(
  "",
  "A model earns deployment only through better measured outcomes on real learners at an acceptable workload, with uncertainty reported; these figures are inputs to that decision, not the decision.",
);

const report = `${lines.join("\n")}\n`;
const out = option("--out");
if (out) {
  fs.writeFileSync(out, report);
  console.log(`Wrote ${out}`);
} else process.stdout.write(report);
