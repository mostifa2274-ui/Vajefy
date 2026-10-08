import { z } from "zod";
import { semanticJudgeRole, type SemanticJudgeRole } from "./assurance";

/**
 * Unattended semantic judge calibration (plan §20–§21).
 *
 * Each role has pre-registered free Workers AI candidates, strongest first.
 * The planner keeps qualified judges, activates the first remaining candidate
 * for every other role, and chooses at most one calibration campaign that
 * fits what is left of the day's free Neuron ceiling. Nothing here calls a
 * model; the calibration workflow does that and records the outcome.
 */

export const SEMANTIC_AUTOMATION_ROLES = semanticJudgeRole.options;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const semanticAutomationConfig = z
  .object({
    schemaVersion: z.literal(1),
    enabled: z.boolean(),
    scope: z.string().min(1),
    authorizedBy: z.string().min(1),
    authorizedAt: isoDate,
    authorization: z.string().min(1),
    freeAllocationOnly: z.literal(true),
    dailyNeuronCeiling: z.number().int().positive(),
    ratesMaxAgeDays: z.number().int().min(1).max(30),
    failurePolicy: z
      .object({
        attempts: z.number().int().min(2),
        distinctDays: z.number().int().min(1),
      })
      .strict(),
    schedule: z.string().min(1),
  })
  .strict();
export type SemanticAutomationConfig = z.infer<typeof semanticAutomationConfig>;

const candidateIdentity = {
  role: semanticJudgeRole,
  model: z.string().startsWith("@cf/"),
  modelVersion: z.string().min(1),
  maxTokens: z.number().int().positive(),
  promptVersion: z.string().min(1),
  rubricVersion: z.string().min(1),
};

export const semanticRejection = z
  .object({
    ...candidateIdentity,
    reason: z.enum(["did-not-promote", "no-valid-output"]),
    rejectedAt: isoDate,
    runIds: z.array(z.string().min(1)).min(1),
    detail: z.string().min(1),
    metrics: z.record(z.string(), z.number()).optional(),
  })
  .strict();
export type SemanticRejection = z.infer<typeof semanticRejection>;

export const semanticRejectionLedger = z
  .object({
    schemaVersion: z.literal(1),
    calibrationVersion: z.string().min(1),
    rejected: z.array(semanticRejection),
  })
  .strict();
export type SemanticRejectionLedger = z.infer<typeof semanticRejectionLedger>;

/** Where a failed attempt went wrong: the model's output, or the gateway around it. */
export const semanticFailureKind = z.enum(["model", "gateway"]);

export const semanticAutomationLogEntry = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("reservation"),
      date: isoDate,
      /** A campaign reserved before inference; its record replaces the reservation. */
      runId: z.string().min(1).optional(),
      neuronsCharged: z.number().int().nonnegative(),
      note: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("calibration"),
      date: isoDate,
      at: z.string().min(1),
      runId: z.string().min(1),
      ...candidateIdentity,
      outcome: z.enum(["qualified", "rejected", "failed"]),
      failure: z
        .object({ kind: semanticFailureKind, code: z.string().min(1), detail: z.string() })
        .strict()
        .optional(),
      requestsSent: z.number().int().nonnegative(),
      neuronsCharged: z.number().int().nonnegative(),
      measured: z
        .object({
          inputTokens: z.number().int().nonnegative(),
          outputTokens: z.number().int().nonnegative(),
          neurons: z.number().int().nonnegative(),
        })
        .strict()
        .nullable(),
    })
    .strict(),
]);
export type SemanticAutomationLogEntry = z.infer<typeof semanticAutomationLogEntry>;

export const semanticAutomationLog = z
  .object({
    schemaVersion: z.literal(1),
    entries: z.array(semanticAutomationLogEntry),
  })
  .strict();
export type SemanticAutomationLog = z.infer<typeof semanticAutomationLog>;

export type JudgeCandidate = {
  provider: string;
  modelFamily: string;
  model: string;
  modelVersion: string;
  maxTokens: number;
};

/** One candidate's full frozen calibration campaign for one role. */
export type CandidateCampaign = {
  neuronsUpperBound: number;
  eligible: boolean;
  ineligibleReason?: string;
};

export type RoleVersions = { promptVersion: string; rubricVersion: string };

export type AutomationState = {
  calibrationVersion: string;
  candidates: Record<SemanticJudgeRole, JudgeCandidate[]>;
  /** Keyed by role, then by model id. */
  campaigns: Record<SemanticJudgeRole, Record<string, CandidateCampaign>>;
  versions: Record<SemanticJudgeRole, RoleVersions>;
  qualified: Partial<Record<SemanticJudgeRole, { modelId: string; modelVersion: string }>>;
  rejected: SemanticRejection[];
};

export type SkippedCandidate = { model: string; reason: string };

export type JudgeAssignment =
  | { status: "qualified"; candidate: JudgeCandidate; rank: number }
  | { status: "pending"; candidate: JudgeCandidate; rank: number; skipped: SkippedCandidate[] }
  /** Every candidate is rejected or unusable; a placeholder keeps the families distinct. */
  | { status: "exhausted"; candidate: JudgeCandidate; rank: number; skipped: SkippedCandidate[] };

export type JudgeAssignments = Record<SemanticJudgeRole, JudgeAssignment>;

export function candidateKey(
  calibrationVersion: string,
  role: SemanticJudgeRole,
  candidate: Pick<JudgeCandidate, "model" | "modelVersion" | "maxTokens">,
  versions: RoleVersions,
): string {
  return [
    calibrationVersion,
    role,
    candidate.model,
    candidate.modelVersion,
    candidate.maxTokens,
    versions.promptVersion,
    versions.rubricVersion,
  ].join("|");
}

function rejectionFor(
  state: AutomationState,
  role: SemanticJudgeRole,
  candidate: JudgeCandidate,
): SemanticRejection | undefined {
  const key = candidateKey(state.calibrationVersion, role, candidate, state.versions[role]);
  return state.rejected.find(
    (item) => candidateKey(state.calibrationVersion, item.role, item, item) === key,
  );
}

function campaignFor(
  state: AutomationState,
  role: SemanticJudgeRole,
  candidate: JudgeCandidate,
): CandidateCampaign {
  return (
    state.campaigns[role][candidate.model] ?? {
      neuronsUpperBound: Number.POSITIVE_INFINITY,
      eligible: false,
      ineligibleReason: "no-campaign-estimate",
    }
  );
}

/** A candidate that calibration could still try for this role, ignoring family clashes. */
function usable(state: AutomationState, role: SemanticJudgeRole, candidate: JudgeCandidate): boolean {
  return !rejectionFor(state, role, candidate) && campaignFor(state, role, candidate).eligible;
}

/**
 * Activate one judge per role. Qualified roles keep their judge; the others,
 * in role order, take their strongest candidate that is not rejected, is
 * eligible for the free allocation, and whose model family no other active
 * judge uses.
 */
export function assignJudges(state: AutomationState): JudgeAssignments {
  const assigned: Partial<JudgeAssignments> = {};
  const familyOwner = new Map<string, SemanticJudgeRole>();

  for (const role of SEMANTIC_AUTOMATION_ROLES) {
    const qualified = state.qualified[role];
    if (!qualified) continue;
    const rank = state.candidates[role].findIndex(
      (item) => item.model === qualified.modelId && item.modelVersion === qualified.modelVersion,
    );
    if (rank < 0) {
      throw new Error(`${role}: qualified judge ${qualified.modelId} is not an allowlisted candidate`);
    }
    const candidate = state.candidates[role][rank]!;
    if (familyOwner.has(candidate.modelFamily)) {
      throw new Error(`${role}: qualified judges share the ${candidate.modelFamily} family`);
    }
    familyOwner.set(candidate.modelFamily, role);
    assigned[role] = { status: "qualified", candidate, rank };
  }

  const exhausted: { role: SemanticJudgeRole; skipped: SkippedCandidate[] }[] = [];
  for (const role of SEMANTIC_AUTOMATION_ROLES) {
    if (assigned[role]) continue;
    const skipped: SkippedCandidate[] = [];
    let chosen: { candidate: JudgeCandidate; rank: number } | undefined;
    for (const [rank, candidate] of state.candidates[role].entries()) {
      const rejection = rejectionFor(state, role, candidate);
      const campaign = campaignFor(state, role, candidate);
      const owner = familyOwner.get(candidate.modelFamily);
      if (rejection) skipped.push({ model: candidate.model, reason: `rejected: ${rejection.reason}` });
      else if (!campaign.eligible) {
        skipped.push({ model: candidate.model, reason: `ineligible: ${campaign.ineligibleReason ?? "unknown"}` });
      } else if (owner) skipped.push({ model: candidate.model, reason: `family used by ${owner}` });
      else {
        chosen = { candidate, rank };
        break;
      }
    }
    if (!chosen) {
      exhausted.push({ role, skipped });
      continue;
    }
    familyOwner.set(chosen.candidate.modelFamily, role);
    assigned[role] = { status: "pending", ...chosen, skipped };
  }

  // A role with nothing left to calibrate still names a judge so the four
  // active judges stay distinct; it is never calibrated or qualified.
  for (const { role, skipped } of exhausted) {
    const ranked = [...state.candidates[role].entries()].sort(
      ([, a], [, b]) => Number(campaignFor(state, role, b).eligible) - Number(campaignFor(state, role, a).eligible),
    );
    const placeholder = ranked.find(([, candidate]) => !familyOwner.has(candidate.modelFamily));
    if (!placeholder) throw new Error(`${role}: no candidate with a free model family remains`);
    const [rank, candidate] = placeholder;
    familyOwner.set(candidate.modelFamily, role);
    assigned[role] = { status: "exhausted", candidate, rank, skipped };
  }

  return assigned as JudgeAssignments;
}

/**
 * A pending role is ready when no earlier pending role could still change
 * which candidate it gets. While an earlier role holds, or may move to, a
 * family that this role ranks at or above its current pick, calibrating this
 * role now could lock in a weaker judge than the pre-registered order allows.
 */
export function blockingRole(
  state: AutomationState,
  assignments: JudgeAssignments,
  role: SemanticJudgeRole,
): SemanticJudgeRole | null {
  const own = assignments[role];
  if (own.status !== "pending") return null;
  const contested = new Set(
    state.candidates[role]
      .slice(0, own.rank + 1)
      .filter((candidate) => usable(state, role, candidate))
      .map((candidate) => candidate.modelFamily),
  );
  for (const earlier of SEMANTIC_AUTOMATION_ROLES.slice(0, SEMANTIC_AUTOMATION_ROLES.indexOf(role))) {
    const other = assignments[earlier];
    if (other.status !== "pending") continue;
    const reachable = state.candidates[earlier]
      .slice(other.rank)
      .filter((candidate) => usable(state, earlier, candidate))
      .map((candidate) => candidate.modelFamily);
    if (reachable.some((family) => contested.has(family))) return earlier;
  }
  return null;
}

export function neuronsUsedOn(log: SemanticAutomationLog, date: string): number {
  return log.entries
    .filter((entry) => entry.date === date)
    .reduce((total, entry) => total + entry.neuronsCharged, 0);
}

export function daysBetween(from: string, to: string): number {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
}

export type CalibrationPlan =
  | {
      action: "calibrate";
      role: SemanticJudgeRole;
      candidate: JudgeCandidate;
      neuronsUpperBound: number;
      usedToday: number;
    }
  | {
      action: "none";
      reason:
        | "automation-disabled"
        | "rates-stale"
        | "all-qualified"
        | "candidates-exhausted"
        | "role-not-pending"
        | "waiting-for-earlier-role"
        | "daily-ceiling";
      detail: string;
      usedToday: number;
    };

export type PlanOptions = {
  config: SemanticAutomationConfig;
  log: SemanticAutomationLog;
  ratesVerifiedAt: string;
  today: string;
  requestedRole?: SemanticJudgeRole;
};

/** Choose at most one calibration campaign to run now. */
export function planNextCalibration(
  state: AutomationState,
  assignments: JudgeAssignments,
  options: PlanOptions,
): CalibrationPlan {
  const usedToday = neuronsUsedOn(options.log, options.today);
  const none = (reason: Extract<CalibrationPlan, { action: "none" }>["reason"], detail: string): CalibrationPlan => ({
    action: "none",
    reason,
    detail,
    usedToday,
  });

  if (!options.config.enabled) return none("automation-disabled", "content/assurance/semantic/automation.json has enabled: false.");
  const age = daysBetween(options.ratesVerifiedAt, options.today);
  if (!Number.isFinite(age) || age < 0 || age > options.config.ratesMaxAgeDays) {
    return none("rates-stale", `Workers AI rates were verified ${options.ratesVerifiedAt}; re-verify them first.`);
  }

  const roles = options.requestedRole ? [options.requestedRole] : SEMANTIC_AUTOMATION_ROLES;
  const pending = roles.filter((role) => assignments[role].status === "pending");
  if (!pending.length) {
    if (options.requestedRole) {
      return none("role-not-pending", `${options.requestedRole} is ${assignments[options.requestedRole].status}.`);
    }
    return SEMANTIC_AUTOMATION_ROLES.every((role) => assignments[role].status === "qualified")
      ? none("all-qualified", "Every role has a qualified judge.")
      : none("candidates-exhausted", "Every unqualified role has run out of pre-registered candidates.");
  }

  const ready = pending.filter((role) => !blockingRole(state, assignments, role));
  if (!ready.length) {
    const role = pending[0]!;
    return none("waiting-for-earlier-role", `${role} waits for ${blockingRole(state, assignments, role)} to settle.`);
  }

  // Each ready role takes its turn: the one attempted least recently goes
  // first, so a role that keeps failing cannot use up every day while a
  // larger campaign never fits. Role order breaks ties.
  const lastAttempt = (role: SemanticJudgeRole) =>
    options.log.entries.reduce(
      (latest, entry) => (entry.kind === "calibration" && entry.role === role && entry.at > latest ? entry.at : latest),
      "",
    );
  const turns = [...ready].sort((a, b) => lastAttempt(a).localeCompare(lastAttempt(b)));
  for (const role of turns) {
    const assignment = assignments[role];
    const neurons = campaignFor(state, role, assignment.candidate).neuronsUpperBound;
    if (usedToday + neurons <= options.config.dailyNeuronCeiling) {
      return { action: "calibrate", role, candidate: assignment.candidate, neuronsUpperBound: neurons, usedToday };
    }
  }
  return none(
    "daily-ceiling",
    `${usedToday} of ${options.config.dailyNeuronCeiling} Neurons are charged on ${options.today}; the next campaign does not fit until 00:00 UTC.`,
  );
}

/**
 * Failed attempts are retried, because a gateway or capacity fault is not the
 * model's fault. A candidate whose own output failed on enough attempts,
 * spread over enough UTC days, is rejected as unable to produce valid output.
 */
export function rejectAfterFailures(
  log: SemanticAutomationLog,
  calibrationVersion: string,
  role: SemanticJudgeRole,
  candidate: Pick<JudgeCandidate, "model" | "modelVersion" | "maxTokens">,
  versions: RoleVersions,
  policy: SemanticAutomationConfig["failurePolicy"],
): { reject: boolean; runIds: string[] } {
  const key = candidateKey(calibrationVersion, role, candidate, versions);
  const failures = log.entries.filter(
    (entry): entry is Extract<SemanticAutomationLogEntry, { kind: "calibration" }> =>
      entry.kind === "calibration" &&
      entry.outcome === "failed" &&
      entry.failure?.kind === "model" &&
      candidateKey(calibrationVersion, entry.role, entry, entry) === key,
  );
  const days = new Set(failures.map((entry) => entry.date));
  return {
    reject: failures.length >= policy.attempts && days.size >= policy.distinctDays,
    runIds: failures.map((entry) => entry.runId),
  };
}

/** Neurons for measured token usage at a model's rate, rounded up. */
export function measuredNeurons(
  inputTokens: number,
  outputTokens: number,
  rate: { inputNeuronsPerMillionTokens: number; outputNeuronsPerMillionTokens: number },
): number {
  return Math.ceil(
    (inputTokens * rate.inputNeuronsPerMillionTokens + outputTokens * rate.outputNeuronsPerMillionTokens) / 1_000_000,
  );
}

export function describeAssignment(assignment: JudgeAssignment, calibrationVersion: string, total: number): string {
  if (assignment.status === "qualified") {
    return `Qualified on ${calibrationVersion}; a qualified role keeps its judge.`;
  }
  const skipped = assignment.skipped.length
    ? ` Skipped: ${assignment.skipped.map((item) => `${item.model} (${item.reason})`).join("; ")}.`
    : "";
  if (assignment.status === "exhausted") {
    return `No candidate is left to calibrate; this placeholder keeps the judges' model families distinct and is never qualified. Pre-register a new candidate or calibration version.${skipped}`;
  }
  return `Next to calibrate: candidate ${assignment.rank + 1} of ${total} in the pre-registered order, strongest first.${skipped}`;
}
