import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { z } from "zod";
import {
  semanticEvidenceBundle,
  semanticJudgeRole,
  type SemanticEvidenceBundle,
  type SemanticJudgeRole,
} from "../src/lib/learn/assurance";
import {
  assignJudges,
  blockingRole,
  describeAssignment,
  measuredNeurons,
  planNextCalibration,
  rejectAfterFailures,
  semanticAutomationConfig,
  semanticAutomationLog,
  semanticRejectionLedger,
  SEMANTIC_AUTOMATION_ROLES,
  type AutomationState,
  type JudgeAssignments,
  type JudgeCandidate,
  type SemanticAutomationLogEntry,
} from "../src/lib/learn/semantic-automation";
import {
  scoreSemanticCalibration,
  type CalibrationRunInput,
  type SemanticCalibrationCase,
  type SemanticCalibrationManifest,
  type SemanticCalibrationPacket,
} from "../src/lib/learn/semantic-calibration";
import { estimateCampaign, type CampaignEstimate, type NeuronRates } from "./semantic-campaign";

/**
 * Unattended semantic judge calibration (content/assurance/semantic/AUTOMATION.md).
 *
 *   plan   [--role auto|<role>] [--github-output]
 *          activate the next candidate for every unqualified role, regenerate
 *          the Neuron budget, and say which campaign (if any) runs now
 *   record --role <role> --run-id <id> --run <bundle> x3 --attempt <attempt> x3
 *          [--report <file>] [--github-output]
 *          score a finished campaign, then qualify or reject the candidate,
 *          or log a failed attempt; charge the day's Neurons either way
 *   reserve --run-id <id> --neurons <n>
 *          charge a campaign's full upper bound before its inference starts;
 *          recording the campaign replaces the reservation
 *   check  fail unless the ledgers are valid and the active judges are the
 *          ones the pre-registered order selects
 *
 * --today YYYY-MM-DD overrides the UTC date (tests only).
 */

const ROOT = process.cwd();
const SCRIPTS = path.dirname(fileURLToPath(import.meta.url));
const SEMANTIC = path.join(ROOT, "content", "assurance", "semantic");
const CALIBRATION = path.join(SEMANTIC, "calibration");
const V1 = path.join(CALIBRATION, "v1");
const FILES = {
  config: path.join(SEMANTIC, "automation.json"),
  presets: path.join(SEMANTIC, "keyless-provider-presets.json"),
  rates: path.join(SEMANTIC, "workers-ai-neuron-rates.json"),
  manifest: path.join(V1, "manifest.json"),
  cases: path.join(V1, "cases.json"),
  qualified: path.join(CALIBRATION, "qualified.json"),
  rejected: path.join(CALIBRATION, "rejected.json"),
  log: path.join(CALIBRATION, "automation-log.json"),
  results: path.join(CALIBRATION, "results"),
};

type RolePreset = JudgeCandidate & { status?: string; rationale?: string };
type Presets = {
  roles: Record<SemanticJudgeRole, RolePreset>;
  candidates: Record<SemanticJudgeRole, JudgeCandidate[]>;
  [key: string]: unknown;
};

type QualificationLedger = {
  calibrationVersion: string;
  roles: Partial<Record<SemanticJudgeRole, { candidate: { modelId: string; modelVersion: string } }>>;
};

type AttemptRecord = {
  status: "started" | "complete" | "failed";
  failure?: { kind: "model" | "gateway"; code: string; targetId: string | null; detail: string };
  requestsSent?: number;
  usage?: { responses: number; responsesWithUsage: number; inputTokens: number; outputTokens: number };
};

function option(flag: string): string | undefined {
  const at = process.argv.indexOf(flag);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

function options(flag: string): string[] {
  return process.argv.flatMap((value, index) => (process.argv[index - 1] === flag ? [value] : []));
}

function read<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function write(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function parse<T>(schema: z.ZodType<T>, file: string): T {
  const result = schema.safeParse(read<unknown>(file));
  if (!result.success) {
    fail(
      `${path.relative(ROOT, file)} is invalid:\n${result.error.issues
        .map((issue) => `- ${issue.path.map(String).join(".")}: ${issue.message}`)
        .join("\n")}`,
    );
  }
  return result.data;
}

function githubOutput(values: Record<string, string | number>) {
  if (!process.argv.includes("--github-output")) return;
  const file = process.env.GITHUB_OUTPUT;
  if (!file) fail("--github-output needs GITHUB_OUTPUT.");
  fs.appendFileSync(file, Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(""));
}

const today = option("--today") ?? new Date().toISOString().slice(0, 10);

function load() {
  const config = parse(semanticAutomationConfig, FILES.config);
  const rejectedLedger = parse(semanticRejectionLedger, FILES.rejected);
  const log = parse(semanticAutomationLog, FILES.log);
  const presets = read<Presets>(FILES.presets);
  const rates = read<NeuronRates>(FILES.rates);
  const manifest = read<SemanticCalibrationManifest & { calibrationVersion: string; requiredRunsPerRole: number }>(
    FILES.manifest,
  );
  const qualified = read<QualificationLedger>(FILES.qualified);

  if (rejectedLedger.calibrationVersion !== manifest.calibrationVersion) {
    fail("calibration/rejected.json is for a different calibration version.");
  }
  if (qualified.calibrationVersion !== manifest.calibrationVersion) {
    fail("calibration/qualified.json is for a different calibration version.");
  }
  if (config.dailyNeuronCeiling > rates.calibrationSafetyCeilingNeurons) {
    fail("automation.json dailyNeuronCeiling exceeds the calibration safety ceiling.");
  }

  const context = { root: ROOT, rates, repeats: manifest.requiredRunsPerRole, calibrationDir: V1 };
  const estimates = {} as Record<SemanticJudgeRole, Record<string, CampaignEstimate>>;
  const versions = {} as AutomationState["versions"];
  for (const role of SEMANTIC_AUTOMATION_ROLES) {
    const list = presets.candidates[role];
    if (!list?.length) fail(`${role}: no pre-registered candidates.`);
    if (new Set(list.map((item) => item.model)).size !== list.length) fail(`${role}: duplicate candidate models.`);
    estimates[role] = Object.fromEntries(list.map((item) => [item.model, estimateCampaign(context, role, item)]));
    const packet = read<SemanticCalibrationPacket>(path.join(V1, "packets", `${role}.json`));
    const spec = packet.roles.find((item) => item.role === role);
    if (!spec) fail(`${role}: calibration packet role spec missing.`);
    versions[role] = { promptVersion: spec.promptVersion, rubricVersion: spec.rubricVersion };
  }

  const state: AutomationState = {
    calibrationVersion: manifest.calibrationVersion,
    candidates: presets.candidates,
    campaigns: Object.fromEntries(
      SEMANTIC_AUTOMATION_ROLES.map((role) => [
        role,
        Object.fromEntries(
          Object.entries(estimates[role]).map(([model, estimate]) => [
            model,
            {
              neuronsUpperBound: estimate.neuronsUpperBound ?? Number.POSITIVE_INFINITY,
              eligible: estimate.eligible && (estimate.neuronsUpperBound ?? Infinity) <= config.dailyNeuronCeiling,
              ineligibleReason:
                estimate.ineligibleReason ??
                ((estimate.neuronsUpperBound ?? Infinity) > config.dailyNeuronCeiling ? "over-daily-ceiling" : undefined),
            },
          ]),
        ),
      ]),
    ) as AutomationState["campaigns"],
    versions,
    qualified: Object.fromEntries(
      Object.entries(qualified.roles).map(([role, record]) => [role, record!.candidate]),
    ),
    rejected: rejectedLedger.rejected,
  };

  return { config, rejectedLedger, log, presets, rates, manifest, state, estimates };
}

function expectedRoles(state: AutomationState, assignments: JudgeAssignments): Presets["roles"] {
  return Object.fromEntries(
    SEMANTIC_AUTOMATION_ROLES.map((role) => {
      const assignment = assignments[role];
      return [
        role,
        {
          ...assignment.candidate,
          status: assignment.status === "pending" ? "calibrating" : assignment.status,
          rationale: describeAssignment(assignment, state.calibrationVersion, state.candidates[role].length),
        },
      ];
    }),
  ) as Presets["roles"];
}

function runScript(script: string, args: string[] = []): boolean {
  const result = spawnSync(process.execPath, [...process.execArgv, path.join(SCRIPTS, script), ...args], {
    cwd: ROOT,
    stdio: "inherit",
  });
  return result.status === 0;
}

function mustRun(script: string, args: string[] = []) {
  if (!runScript(script, args)) fail(`${script} ${args.join(" ")} failed.`);
}

/** Activate the selected judges and regenerate the budget for them. */
function activate() {
  const loaded = load();
  const assignments = assignJudges(loaded.state);
  loaded.presets.roles = expectedRoles(loaded.state, assignments);
  write(FILES.presets, loaded.presets);
  mustRun("semantic-neuron-budget.ts");
  return { ...loaded, assignments };
}

function printAssignments(state: AutomationState, assignments: JudgeAssignments) {
  for (const role of SEMANTIC_AUTOMATION_ROLES) {
    const assignment = assignments[role];
    const blocker = blockingRole(state, assignments, role);
    console.log(
      `- ${role}: ${assignment.status} ${assignment.candidate.model}${blocker ? ` (waits for ${blocker})` : ""}`,
    );
  }
}

function plan() {
  const requested = option("--role");
  if (requested && requested !== "auto" && !semanticJudgeRole.safeParse(requested).success) {
    fail(`Unknown role: ${requested}`);
  }
  const { config, log, rates, state, assignments } = activate();
  const next = planNextCalibration(state, assignments, {
    config,
    log,
    ratesVerifiedAt: rates.verifiedAt,
    today,
    requestedRole: requested && requested !== "auto" ? (requested as SemanticJudgeRole) : undefined,
  });
  console.log(`Semantic calibration plan for ${today} (${next.usedToday}/${config.dailyNeuronCeiling} Neurons charged):`);
  printAssignments(state, assignments);
  if (next.action === "calibrate") {
    console.log(`Next: calibrate ${next.role} with ${next.candidate.model} (≤ ${next.neuronsUpperBound} Neurons).`);
    githubOutput({ action: "calibrate", role: next.role, model: next.candidate.model, neurons: next.neuronsUpperBound });
  } else {
    console.log(`Next: nothing (${next.reason}). ${next.detail}`);
    githubOutput({ action: "none", reason: next.reason });
  }
}

function readAttempt(file: string): AttemptRecord | null {
  if (!fs.existsSync(file)) return null;
  try {
    return read<AttemptRecord>(file);
  } catch {
    return { status: "started" };
  }
}

function record() {
  const roleRaw = option("--role");
  const runId = option("--run-id");
  const runFiles = options("--run");
  const attemptFiles = options("--attempt");
  if (!roleRaw || !semanticJudgeRole.safeParse(roleRaw).success) fail("record needs --role <role>.");
  if (!runId) fail("record needs --run-id <id>.");
  const role = roleRaw as SemanticJudgeRole;

  const loaded = load();
  const { config, log, presets, manifest, state, estimates, rejectedLedger } = loaded;
  if (runFiles.length !== manifest.requiredRunsPerRole || attemptFiles.length !== manifest.requiredRunsPerRole) {
    fail(`record needs ${manifest.requiredRunsPerRole} --run and --attempt files.`);
  }
  const assignments = assignJudges(state);
  const assignment = assignments[role];
  const active = presets.roles[role];
  if (assignment.status !== "pending" || assignment.candidate.model !== active.model) {
    fail(`${role}: ${active.model} is not the candidate awaiting calibration.`);
  }
  const candidate = assignment.candidate;
  const estimate = estimates[role][candidate.model]!;
  const versions = state.versions[role];
  const perRun = Math.ceil((estimate.neuronsUpperBound ?? 0) / manifest.requiredRunsPerRole);
  const perRequest = estimate.maxRequestNeuronsUpperBound ?? 0;

  // Charge what each started repeat could have cost. A repeat with no
  // record of its own was interrupted and is charged in full.
  const attempts = attemptFiles.map(readAttempt);
  let neuronsCharged = 0;
  let requestsSent = 0;
  let responses = 0;
  let responsesWithUsage = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let failure: NonNullable<AttemptRecord["failure"]> | undefined;
  for (const attempt of attempts) {
    if (!attempt) continue;
    if (attempt.status === "started") {
      neuronsCharged += perRun;
      requestsSent += estimate.requestsPerRun;
      failure ??= { kind: "gateway", code: "interrupted", targetId: null, detail: "The repeat stopped without a record." };
      continue;
    }
    const sent = attempt.requestsSent ?? estimate.requestsPerRun;
    requestsSent += sent;
    neuronsCharged += attempt.status === "complete" ? perRun : Math.min(perRun, sent * perRequest);
    responses += attempt.usage?.responses ?? 0;
    responsesWithUsage += attempt.usage?.responsesWithUsage ?? 0;
    inputTokens += attempt.usage?.inputTokens ?? 0;
    outputTokens += attempt.usage?.outputTokens ?? 0;
    if (attempt.status === "failed") failure ??= attempt.failure ?? { kind: "gateway", code: "unknown", targetId: null, detail: "" };
  }
  if (!attempts.some(Boolean)) fail("No calibration repeat started; nothing to record.");
  const measured =
    responses > 0 && responsesWithUsage === responses && estimate.rate
      ? { inputTokens, outputTokens, neurons: measuredNeurons(inputTokens, outputTokens, estimate.rate) }
      : null;

  const complete =
    !failure &&
    attempts.every((attempt) => attempt?.status === "complete") &&
    runFiles.every((file) => fs.existsSync(file));

  let outcome: "qualified" | "rejected" | "failed" = "failed";
  let report: ReturnType<typeof scoreSemanticCalibration> | undefined;
  if (complete) {
    const cases = read<{ cases: SemanticCalibrationCase[] }>(FILES.cases).cases;
    const packet = read<SemanticCalibrationPacket>(path.join(V1, "packets", `${role}.json`));
    const runs: CalibrationRunInput[] = runFiles.map((file) => {
      const parsed = semanticEvidenceBundle.safeParse(read<unknown>(path.resolve(file)));
      return parsed.success
        ? { file, bundle: parsed.data as SemanticEvidenceBundle }
        : { file, parseProblems: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
    });
    report = scoreSemanticCalibration(role, cases, manifest, packet, runs);
    const reportFile = option("--report");
    if (reportFile) write(path.resolve(reportFile), report);

    const precondition = report.checks.enoughRuns && report.checks.sameCandidate && report.checks.independentRepeats;
    if (!precondition) {
      // A broken campaign says nothing about the model's judgement.
      failure = {
        kind: "gateway",
        code: "invalid-campaign",
        targetId: null,
        detail: report.invalidRuns.map((item) => `${item.file}: ${item.problems.join("; ")}`).join(" | ") || "Repeats are not independent runs of one candidate.",
      };
    } else if (report.promoted) {
      outcome = "qualified";
    } else {
      outcome = "rejected";
      const failed = Object.entries(report.checks)
        .filter(([, passed]) => !passed)
        .map(([check]) => check);
      rejectedLedger.rejected.push({
        role,
        model: candidate.model,
        modelVersion: candidate.modelVersion,
        maxTokens: candidate.maxTokens,
        ...versions,
        reason: "did-not-promote",
        rejectedAt: today,
        runIds: [runId],
        detail: `Missed the frozen ${manifest.calibrationVersion} gate on: ${failed.join(", ")}.`,
        metrics: report.metrics,
      });
    }
  }

  if (outcome === "qualified") {
    if (runScript("record-semantic-qualification.ts", ["--role", role, ...runFiles.flatMap((file) => ["--run", file])])) {
      write(path.join(FILES.results, `${role}.json`), report);
    } else {
      outcome = "failed";
      failure = { kind: "gateway", code: "qualification-record-failed", targetId: null, detail: "The promoted campaign could not be recorded." };
    }
  }

  const entry: SemanticAutomationLogEntry = {
    kind: "calibration",
    date: today,
    at: new Date().toISOString(),
    runId,
    role,
    model: candidate.model,
    modelVersion: candidate.modelVersion,
    maxTokens: candidate.maxTokens,
    ...versions,
    outcome,
    ...(outcome === "failed" && failure ? { failure: { kind: failure.kind, code: failure.code, detail: failure.detail.slice(0, 500) } } : {}),
    requestsSent,
    neuronsCharged,
    measured,
  };
  // The record replaces the run's reservation.
  log.entries = log.entries.filter((item) => !(item.kind === "reservation" && item.runId === runId));
  log.entries.push(entry);

  if (outcome === "failed" && failure?.kind === "model") {
    const decision = rejectAfterFailures(log, state.calibrationVersion, role, candidate, versions, config.failurePolicy);
    if (decision.reject) {
      rejectedLedger.rejected.push({
        role,
        model: candidate.model,
        modelVersion: candidate.modelVersion,
        maxTokens: candidate.maxTokens,
        ...versions,
        reason: "no-valid-output",
        rejectedAt: today,
        runIds: decision.runIds,
        detail: `Failed to produce valid judgments on ${decision.runIds.length} attempts across ${config.failurePolicy.distinctDays}+ UTC days; last: ${failure.code}.`,
      });
    }
  }

  write(FILES.log, log);
  write(FILES.rejected, rejectedLedger);

  // The outcome changes which judges are active next.
  activate();
  if (outcome === "qualified") mustRun("check-semantic-qualification.ts", ["--role", role]);

  console.log(
    `Recorded ${role} ${candidate.model}: ${outcome}${failure && outcome === "failed" ? ` (${failure.kind}: ${failure.code})` : ""}; ${requestsSent} request(s), ${neuronsCharged} Neurons charged${measured ? `, ${measured.neurons} measured` : ""}.`,
  );
  githubOutput({ outcome, failure_kind: outcome === "failed" ? (failure?.kind ?? "gateway") : "none" });
}

function reserve() {
  const runId = option("--run-id");
  const neurons = Number(option("--neurons"));
  if (!runId || !Number.isInteger(neurons) || neurons <= 0) fail("reserve needs --run-id <id> and --neurons <n>.");
  const log = parse(semanticAutomationLog, FILES.log);
  if (log.entries.some((entry) => entry.runId === runId)) fail(`Run ${runId} is already in the log.`);
  log.entries.push({
    kind: "reservation",
    date: today,
    runId,
    neuronsCharged: neurons,
    note: `Calibration run ${runId} reserved its full campaign upper bound before inference. If no record replaces this, the whole bound stays charged.`,
  });
  write(FILES.log, log);
  console.log(`Reserved ${neurons} Neurons on ${today} for run ${runId}.`);
}

function check() {
  const { presets, state, log, config } = load();
  const assignments = assignJudges(state);
  const expected = expectedRoles(state, assignments);
  const problems: string[] = [];
  for (const role of SEMANTIC_AUTOMATION_ROLES) {
    if (JSON.stringify(presets.roles[role]) !== JSON.stringify(expected[role])) {
      problems.push(`${role}: active judge is not the one the pre-registered order selects (${expected[role].model})`);
    }
  }
  for (const entry of log.entries) {
    if (entry.kind === "calibration" && entry.outcome !== "failed" && entry.failure) {
      problems.push(`log ${entry.runId}: only failed attempts carry a failure`);
    }
  }
  const recorded = new Set(log.entries.flatMap((entry) => (entry.kind === "calibration" ? [entry.runId] : [])));
  for (const entry of log.entries) {
    if (entry.kind === "reservation" && entry.runId && recorded.has(entry.runId)) {
      problems.push(`log ${entry.runId}: a recorded run still holds its reservation`);
    }
  }
  // Reservations may fill a day; calibration must never push it over.
  for (const date of new Set(log.entries.map((entry) => entry.date))) {
    const day = log.entries.filter((entry) => entry.date === date);
    const charged = day.reduce((total, entry) => total + entry.neuronsCharged, 0);
    if (charged > config.dailyNeuronCeiling && day.some((entry) => entry.kind === "calibration")) {
      problems.push(`${date}: ${charged} Neurons charged, above the ${config.dailyNeuronCeiling} daily ceiling`);
    }
  }
  if (problems.length) {
    for (const problem of problems) console.error(`! ${problem}`);
    fail("Semantic calibration automation: FAIL. Run npm run assurance:semantic:automation -- plan to re-activate judges.");
  }
  console.log(
    `Semantic calibration automation: PASS (${config.enabled ? "enabled" : "disabled"}; ${state.rejected.length} rejected candidate(s); ${log.entries.length} log entr${log.entries.length === 1 ? "y" : "ies"}).`,
  );
  printAssignments(state, assignments);
}

const command = process.argv[2];
if (command === "plan") plan();
else if (command === "record") record();
else if (command === "reserve") reserve();
else if (command === "check") check();
else fail("Usage: semantic-automation.ts plan|record|reserve|check [options]");
