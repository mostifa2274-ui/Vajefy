/**
 * Automatic repair loop (plan §8).
 *
 * A deterministic finding becomes a field-scoped diagnosis. The loop may
 * propose a pure Unicode repair, ask for field-only regeneration, or
 * quarantine. It never writes learner-facing text, never treats a retry as
 * certification, and never converts an unknown code into a pass.
 */

export const MAX_AUTOMATIC_REPAIR_ATTEMPTS = 3;

export const repairAction = [
  "regenerate_field_only",
  "deterministic_normalize",
  "quarantine",
] as const;

export type RepairAction = (typeof repairAction)[number];

export const repairStatus = [
  "RETRY",
  "AWAITING_REGENERATION",
  "PENDING_REVERIFICATION",
  "QUARANTINED_AUTOMATICALLY",
] as const;

export type RepairStatus = (typeof repairStatus)[number];

export type RepairRule = {
  action: RepairAction;
  /** Path under the sense or scene, without the stable id. */
  field: string;
  preserve: readonly string[];
  reason: string;
};

const IDENTITY = ["stableId", "lemma", "sense"] as const;

const RULES: Record<string, RepairRule> = {
  PERSIAN_GLOSS: field("gloss", "missing or non-Persian gloss"),
  PERSIAN_MEANING: field("meaning", "missing or non-Persian meaning"),
  PERSIAN_GRAMMAR_NOTE: field("grammar.note", "missing or non-Persian grammar note"),
  PERSIAN_EXAMPLE: field("examples.fa", "missing or non-Persian example translation"),
  DUPLICATE_EXAMPLE_EN: field("examples.en", "duplicate English example"),
  DUPLICATE_EXAMPLE_FA: field("examples.fa", "duplicate Persian example translation"),
  EXAMPLE_COUNT: field("examples", "fewer than three pedagogically distinct examples"),
  EXAMPLE_NEAR_DUPLICATE: field("examples", "examples differ by only a word or two"),
  EXAMPLE_REUSED: field("examples.en", "example sentence already used by an earlier sense"),
  USAGE_REQUIRED: field("usage", "usage guidance required for this part of speech"),
  PERSIAN_USAGE: field("usage", "missing or non-Persian usage note"),
  MISTAKE_WRONG_FA_MISSING: field("mistake.wrongFa", "incorrect example has no Persian translation"),
  PERSIAN_MISTAKE_WRONG: field("mistake.wrongFa", "incorrect-example translation is not Persian"),
  MISTAKE_RIGHT_FA_MISSING: field("mistake.rightFa", "corrected example has no Persian translation"),
  PERSIAN_MISTAKE_RIGHT: field("mistake.rightFa", "corrected-example translation is not Persian"),
  MISTAKE_FA_IDENTICAL: {
    action: "regenerate_field_only",
    field: "mistake.wrongFa",
    preserve: [...IDENTITY, "mistake.right", "mistake.rightFa", "examples", "grammar"],
    reason: "wrong and corrected Persian translations are identical",
  },
  MISTAKE_EN_IDENTICAL: {
    action: "regenerate_field_only",
    field: "mistake.wrong",
    preserve: [...IDENTITY, "mistake.right", "mistake.rightFa", "examples", "grammar"],
    reason: "wrong and corrected English sentences are identical",
  },
  PERSIAN_MISTAKE_WHY: field("mistake.why", "mistake explanation is missing or not Persian"),
  PERSIAN_CHECK_FEEDBACK: field("check.why", "task feedback is missing or not Persian"),
  PERSIAN_CHECK_FA: field("check.fa", "task prompt translation is missing or not Persian"),
  PERSIAN_CHECK_PROMPT: field("check.prompt", "task prompt is missing or not Persian"),
  PERSIAN_IN_ENGLISH: field(
    "english",
    "Persian script is in an English field; regenerate that field, do not delete it",
  ),
  FRONTIER_TASK_VOCABULARY: field(
    "check",
    "task uses vocabulary beyond the curriculum frontier",
  ),
  FRONTIER_SCENE_VOCABULARY: field(
    "check",
    "scene task uses vocabulary beyond the curriculum frontier",
  ),
  UNICODE_NOT_NFC: {
    action: "deterministic_normalize",
    field: "text",
    preserve: [...IDENTITY],
    reason: "text is not Unicode NFC; normalize that field only",
  },
  BIDI_CONTROL: {
    action: "deterministic_normalize",
    field: "text",
    preserve: [...IDENTITY],
    reason: "explicit bidi control belongs in the interface, not stored text",
  },
  MALFORMED_UNICODE: {
    action: "quarantine",
    field: "text",
    preserve: [...IDENTITY],
    reason: "lone surrogate, U+FFFD or control character cannot be guessed",
  },
};

function field(path: string, reason: string): RepairRule {
  return {
    action: "regenerate_field_only",
    field: path,
    preserve: [...IDENTITY],
    reason,
  };
}

export function repairCatalog(): Readonly<Record<string, RepairRule>> {
  return RULES;
}

export type RepairFinding = {
  code: string;
  where: string;
  message?: string;
};

export type RepairDiagnosis = {
  code: string;
  where: string;
  targetId: string;
  field: string;
  action: RepairAction | "unsupported";
  preserve: readonly string[];
  reason: string;
  status: "FAIL" | "UNCERTAIN";
};

const FIELD_MARKERS = [
  ".mistake",
  ".examples",
  ".gloss",
  ".meaning",
  ".grammar",
  ".usage",
  ".check",
  ".collocations",
] as const;

/** Stable id may itself contain dots (`a1.take.01`). Split on a known field. */
export function splitFindingWhere(where: string): { targetId: string; field: string } {
  let at = -1;
  for (const marker of FIELD_MARKERS) {
    const index = where.indexOf(marker);
    if (index !== -1 && (at === -1 || index < at)) at = index;
  }
  if (at === -1) return { targetId: where, field: "" };
  return { targetId: where.slice(0, at), field: where.slice(at + 1) };
}

/** Stable id is the path before the first known field marker. */
export function targetIdFromWhere(where: string): string {
  return splitFindingWhere(where).targetId;
}

export function diagnoseFinding(finding: RepairFinding): RepairDiagnosis {
  const rule = RULES[finding.code];
  const located = splitFindingWhere(finding.where);
  if (!rule) {
    return {
      code: finding.code,
      where: finding.where,
      targetId: located.targetId,
      field: located.field || finding.where,
      action: "unsupported",
      preserve: [...IDENTITY],
      reason: "unclassified finding; abstain rather than repair or accept",
      status: "UNCERTAIN",
    };
  }
  const specific = specificField(located.field, rule.field);
  return {
    code: finding.code,
    where: finding.where,
    targetId: located.targetId,
    field: specific,
    action: rule.action,
    preserve: rule.preserve,
    reason: rule.reason,
    status: "FAIL",
  };
}

/** Prefer a more specific finding path; keep the rule's leaf when the finding is coarser. */
function specificField(whereField: string, ruleField: string): string {
  if (!whereField) return ruleField;
  if (whereField === ruleField || whereField.startsWith(ruleField)) return whereField;
  if (ruleField.startsWith(whereField)) return ruleField;
  return whereField;
}

const BIDI_CONTROL = /[\u202A-\u202E\u2066-\u2069]/gu;

/**
 * Pure proposal. Returns null when the code is not a deterministic repair,
 * when the value is already compliant, or when the only change would empty
 * the field. Does not invent wording.
 */
export function proposeDeterministicRepair(value: string, code: string): string | null {
  if (code === "UNICODE_NOT_NFC") {
    const normalized = value.normalize("NFC");
    return normalized === value ? null : normalized;
  }
  if (code === "BIDI_CONTROL") {
    const stripped = value.replace(BIDI_CONTROL, "");
    if (stripped === value || stripped.trim() === "") return null;
    return stripped;
  }
  return null;
}

export type RepairPlanItem = {
  code: string;
  where: string;
  targetId: string;
  field: string;
  action: RepairAction | "unsupported";
  preserve: readonly string[];
  findingStatus: "FAIL" | "UNCERTAIN";
  status: RepairStatus;
  attempts: number;
  reason: string;
};

/** Diagnose a batch. Unsupported and quarantine items abstain. Never emits PASS. */
export function planRepairs(findings: readonly RepairFinding[]): RepairPlanItem[] {
  return findings.map((finding) => {
    const diagnosis = diagnoseFinding(finding);
    const transition = nextRepairState({
      action: diagnosis.action,
      attemptsAlreadyUsed: 0,
      verification: "not_run",
    });
    return {
      code: diagnosis.code,
      where: diagnosis.where,
      targetId: diagnosis.targetId,
      field: diagnosis.field,
      action: diagnosis.action,
      preserve: diagnosis.preserve,
      findingStatus: diagnosis.status,
      status: transition.status,
      attempts: transition.attempts,
      reason: transition.reason,
    };
  });
}

export type VerificationOutcome = "still_failing" | "deterministic_cleared" | "not_run";

export type RepairTransition = {
  status: RepairStatus;
  attempts: number;
  reason: string;
};

/**
 * Advance one finding. `attemptsAlreadyUsed` counts completed regeneration or
 * deterministic attempts, not diagnoses. A pass here only means the dependent
 * verification chain must be rerun; it is not a certificate.
 */
export function nextRepairState(input: {
  action: RepairAction | "unsupported";
  attemptsAlreadyUsed: number;
  verification: VerificationOutcome;
}): RepairTransition {
  const used = Math.max(0, input.attemptsAlreadyUsed);
  if (input.action === "quarantine" || input.action === "unsupported") {
    return {
      status: "QUARANTINED_AUTOMATICALLY",
      attempts: used,
      reason:
        input.action === "quarantine"
          ? "finding cannot be repaired without guessing"
          : "unclassified finding is quarantined, not accepted",
    };
  }
  if (input.verification === "not_run") {
    return {
      status: input.action === "regenerate_field_only" ? "AWAITING_REGENERATION" : "RETRY",
      attempts: used,
      reason: "diagnosis only; no repair has been applied",
    };
  }
  if (input.verification === "deterministic_cleared") {
    return {
      status: "PENDING_REVERIFICATION",
      attempts: used + 1,
      reason: "field change must rerun the dependent verification chain; this is not certification",
    };
  }
  const attempts = used + 1;
  if (attempts >= MAX_AUTOMATIC_REPAIR_ATTEMPTS) {
    return {
      status: "QUARANTINED_AUTOMATICALLY",
      attempts,
      reason: `still failing after ${attempts} bounded attempts`,
    };
  }
  return {
    status: "RETRY",
    attempts,
    reason: `attempt ${attempts} of ${MAX_AUTOMATIC_REPAIR_ATTEMPTS} still failing`,
  };
}
