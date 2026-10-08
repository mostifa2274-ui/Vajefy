import { z } from "zod";

const text = z.string().trim().min(1);

export const provenanceStatus = z.enum(["cleared", "blocked", "unverified"]);
export const rightsState = z.enum(["allowed", "prohibited", "unverified"]);
export const attributionState = z.enum(["required", "not-required", "unknown"]);

export const provenanceSource = z
  .object({
    id: text,
    name: text,
    version: text,
    source: text,
    license: text,
    redistribution: rightsState,
    derivatives: rightsState,
    attribution: attributionState,
    status: provenanceStatus,
    evidence: z.array(text).default([]),
  })
  .superRefine((source, ctx) => {
    if (
      source.status === "cleared" &&
      (source.redistribution !== "allowed" || source.derivatives !== "allowed")
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "a cleared source must explicitly allow redistribution and derivative works",
      });
    }
    if (source.status === "cleared" && source.license === "UNVERIFIED") {
      ctx.addIssue({
        code: "custom",
        message: "a cleared source cannot use the UNVERIFIED licence marker",
      });
    }
    if (source.status === "cleared" && source.evidence.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "a cleared source requires verifiable licence/rights evidence references",
      });
    }
    if (source.status === "cleared" && source.attribution === "unknown") {
      ctx.addIssue({
        code: "custom",
        message: "a cleared source cannot leave its attribution requirement unknown",
      });
    }
  });

export const provenanceManifest = z.object({
  schemaVersion: z.literal(1),
  sources: z.array(provenanceSource).min(1),
});

export type ProvenanceManifest = z.infer<typeof provenanceManifest>;
export type ProvenanceSource = z.infer<typeof provenanceSource>;

export function provenanceBlockers(manifest: ProvenanceManifest): string[] {
  return manifest.sources.flatMap((source) => {
    const blockers: string[] = [];
    if (source.status !== "cleared") {
      blockers.push(`${source.id}:status=${source.status}`);
    }
    if (source.redistribution !== "allowed") {
      blockers.push(`${source.id}:redistribution=${source.redistribution}`);
    }
    if (source.derivatives !== "allowed") {
      blockers.push(`${source.id}:derivatives=${source.derivatives}`);
    }
    if (source.license === "UNVERIFIED") {
      blockers.push(`${source.id}:license=UNVERIFIED`);
    }
    // Defence in depth even when consumers bypass the schema parse:
    // a rights label without evidence or attribution is never approval.
    if (source.status === "cleared" && source.evidence.length === 0) {
      blockers.push(`${source.id}:evidence=missing`);
    }
    if (source.status === "cleared" && source.attribution === "unknown") {
      blockers.push(`${source.id}:attribution=unknown`);
    }
    return blockers;
  });
}

export const assuranceResult = z.enum([
  "PASS",
  "FAIL",
  "UNCERTAIN",
  "DISAGREEMENT",
  "QUARANTINED",
]);

export const assuranceCriterion = z.object({
  criterion: text,
  result: assuranceResult,
  confidence: z.number().min(0).max(1).optional(),
  evidence: z.array(text).default([]),
  reasonCode: text.nullable().default(null),
  evaluator: z
    .object({
      kind: z.enum(["deterministic", "model", "audio", "runtime"]),
      id: text,
      version: text,
      promptVersion: text.optional(),
      rubricVersion: text.optional(),
    })
    .optional(),
});

export const machineAssuranceRecord = z.object({
  schemaVersion: z.literal(1),
  targetId: text,
  contentVersion: text,
  sourceHash: text,
  generatedAt: text,
  criteria: z.array(assuranceCriterion).min(1),
  status: assuranceResult,
});

export type MachineAssuranceRecord = z.infer<typeof machineAssuranceRecord>;

export function aggregateAssurance(
  criteria: z.infer<typeof assuranceCriterion>[],
): z.infer<typeof assuranceResult> {
  const results = new Set(criteria.map((criterion) => criterion.result));
  if (results.has("QUARANTINED")) return "QUARANTINED";
  if (results.has("FAIL")) return "FAIL";
  if (results.has("DISAGREEMENT")) return "DISAGREEMENT";
  if (results.has("UNCERTAIN")) return "UNCERTAIN";
  return "PASS";
}


export const semanticJudgeRole = z.enum([
  "english",
  "persian",
  "pedagogical",
  "adversarial",
]);
export type SemanticJudgeRole = z.infer<typeof semanticJudgeRole>;

export const semanticCriterionResult = z.enum(["PASS", "FAIL", "UNCERTAIN"]);
export type SemanticCriterionResult = z.infer<typeof semanticCriterionResult>;

export const semanticEvaluator = z.object({
  kind: z.literal("model"),
  provider: text,
  modelId: text,
  modelVersion: text,
  promptVersion: text,
  rubricVersion: text,
  /** Distinct context identifier proving judges did not share generator/judge context. */
  contextIsolationKey: text,
  runId: text,
});

export const semanticCriterionJudgment = z.object({
  criterion: text,
  result: semanticCriterionResult,
  confidence: z.number().min(0).max(1),
  /** Stable field/claim identifiers supporting the judgment. */
  evidence: z.array(text).min(1),
  reasonCode: text.nullable().default(null),
});

export type SemanticCriterionJudgment = z.infer<
  typeof semanticCriterionJudgment
>;

export function aggregateSemanticCriteria(
  criteria: SemanticCriterionJudgment[],
): SemanticCriterionResult {
  if (criteria.some((criterion) => criterion.result === "FAIL")) return "FAIL";
  if (criteria.some((criterion) => criterion.result === "UNCERTAIN")) {
    return "UNCERTAIN";
  }
  return "PASS";
}

export const semanticJudgeRecord = z
  .object({
    schemaVersion: z.literal(1),
    role: semanticJudgeRole,
    targetId: text,
    contentVersion: text,
    inputHash: text.regex(/^[a-f0-9]{64}$/),
    generatedAt: text,
    evaluator: semanticEvaluator,
    criteria: z.array(semanticCriterionJudgment).min(1),
    status: semanticCriterionResult,
  })
  .superRefine((record, ctx) => {
    const names = record.criteria.map((criterion) => criterion.criterion);
    if (new Set(names).size !== names.length) {
      ctx.addIssue({
        code: "custom",
        path: ["criteria"],
        message: "semantic judge criteria must be unique",
      });
    }
    const expected = aggregateSemanticCriteria(record.criteria);
    if (record.status !== expected) {
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: `semantic judge status must equal derived criterion status ${expected}`,
      });
    }
  });

export type SemanticJudgeRecord = z.infer<typeof semanticJudgeRecord>;

export const semanticRubricRole = z.object({
  role: semanticJudgeRole,
  rubricVersion: text,
  promptVersion: text,
  criteria: z.array(text).min(1),
});

export const semanticRubricManifest = z
  .object({
    schemaVersion: z.literal(1),
    requiredRoles: z.array(semanticJudgeRole).min(1),
    vetoConfidence: z.number().min(0).max(1),
    roles: z.array(semanticRubricRole).min(1),
  })
  .superRefine((manifest, ctx) => {
    if (new Set(manifest.requiredRoles).size !== manifest.requiredRoles.length) {
      ctx.addIssue({
        code: "custom",
        path: ["requiredRoles"],
        message: "required semantic judge roles must be unique",
      });
    }
    const roleNames = manifest.roles.map((role) => role.role);
    if (new Set(roleNames).size !== roleNames.length) {
      ctx.addIssue({
        code: "custom",
        path: ["roles"],
        message: "semantic rubric role definitions must be unique",
      });
    }
    for (const required of manifest.requiredRoles) {
      if (!manifest.roles.some((role) => role.role === required)) {
        ctx.addIssue({
          code: "custom",
          path: ["roles"],
          message: `missing rubric definition for required role ${required}`,
        });
      }
    }
    for (const role of manifest.roles) {
      if (new Set(role.criteria).size !== role.criteria.length) {
        ctx.addIssue({
          code: "custom",
          path: ["roles"],
          message: `rubric criteria must be unique for role ${role.role}`,
        });
      }
    }
  });

export type SemanticRubricManifest = z.infer<typeof semanticRubricManifest>;

export type SemanticArbitration = {
  status: z.infer<typeof assuranceResult>;
  blockers: string[];
  rolesPresent: SemanticJudgeRole[];
  vetoes: string[];
};

export function arbitrateSemanticJudgments(
  judgments: SemanticJudgeRecord[],
  manifest: SemanticRubricManifest,
  generationContextKey?: string,
): SemanticArbitration {
  const blockers: string[] = [];
  const vetoes: string[] = [];
  const byRole = new Map<SemanticJudgeRole, SemanticJudgeRecord>();

  for (const judgment of judgments) {
    if (byRole.has(judgment.role)) {
      blockers.push(`duplicate-role:${judgment.role}`);
    } else {
      byRole.set(judgment.role, judgment);
    }
  }

  for (const role of manifest.requiredRoles) {
    if (!byRole.has(role)) blockers.push(`missing-role:${role}`);
  }

  const targets = new Set(judgments.map((judgment) => judgment.targetId));
  const versions = new Set(judgments.map((judgment) => judgment.contentVersion));
  const inputHashes = new Set(judgments.map((judgment) => judgment.inputHash));
  if (targets.size > 1) blockers.push("target-mismatch");
  if (versions.size > 1) blockers.push("content-version-mismatch");
  if (inputHashes.size > 1) blockers.push("input-hash-mismatch");

  const contextKeys = judgments.map(
    (judgment) => judgment.evaluator.contextIsolationKey,
  );
  if (new Set(contextKeys).size !== contextKeys.length) {
    blockers.push("judge-context-not-independent");
  }
  if (
    generationContextKey &&
    contextKeys.some((key) => key === generationContextKey)
  ) {
    blockers.push("judge-context-matches-generator");
  }

  for (const role of manifest.requiredRoles) {
    const judgment = byRole.get(role);
    const rubric = manifest.roles.find((candidate) => candidate.role === role);
    if (!judgment || !rubric) continue;

    if (judgment.evaluator.rubricVersion !== rubric.rubricVersion) {
      blockers.push(`stale-rubric:${role}`);
    }
    if (judgment.evaluator.promptVersion !== rubric.promptVersion) {
      blockers.push(`stale-prompt:${role}`);
    }

    const actual = new Set(
      judgment.criteria.map((criterion) => criterion.criterion),
    );
    const missing = rubric.criteria.filter((criterion) => !actual.has(criterion));
    const extra = [...actual].filter(
      (criterion) => !rubric.criteria.includes(criterion),
    );
    if (missing.length) {
      blockers.push(`missing-criteria:${role}:${missing.join(",")}`);
    }
    if (extra.length) {
      blockers.push(`unknown-criteria:${role}:${extra.join(",")}`);
    }

    for (const criterion of judgment.criteria) {
      if (
        criterion.result === "FAIL" &&
        criterion.confidence >= manifest.vetoConfidence
      ) {
        vetoes.push(`${role}:${criterion.criterion}`);
      }
    }
  }

  if (blockers.length) {
    return {
      status: "QUARANTINED",
      blockers,
      rolesPresent: [...byRole.keys()],
      vetoes,
    };
  }

  if (vetoes.length) {
    return {
      status: "FAIL",
      blockers: [],
      rolesPresent: [...byRole.keys()],
      vetoes,
    };
  }

  const statuses = manifest.requiredRoles.map(
    (role) => byRole.get(role)!.status,
  );
  if (statuses.includes("UNCERTAIN")) {
    return {
      status: "UNCERTAIN",
      blockers: [],
      rolesPresent: [...byRole.keys()],
      vetoes: [],
    };
  }

  const hasFail = statuses.includes("FAIL");
  const hasPass = statuses.includes("PASS");
  if (hasFail && hasPass) {
    return {
      status: "DISAGREEMENT",
      blockers: [],
      rolesPresent: [...byRole.keys()],
      vetoes: [],
    };
  }
  if (hasFail) {
    return {
      status: "FAIL",
      blockers: [],
      rolesPresent: [...byRole.keys()],
      vetoes: [],
    };
  }

  return {
    status: "PASS",
    blockers: [],
    rolesPresent: [...byRole.keys()],
    vetoes: [],
  };
}


export const semanticEvidenceBundle = z.object({
  schemaVersion: z.literal(1),
  unitId: text,
  /**
   * Context identifier for the process that authored/generated the source
   * content. Judge contexts must differ from it.
   */
  generationContextKey: text,
  judgments: z.array(semanticJudgeRecord),
});

export type SemanticEvidenceBundle = z.infer<typeof semanticEvidenceBundle>;

/**
 * Generation provenance (plan §18): what produced each content entry. A
 * generator is named once; each entry records which generator last changed
 * it, when, and the content hashes before and after.
 */
export const HISTORICAL_GENERATOR = "historical-unknown";

export const contentGenerator = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("model"),
    provider: text,
    modelId: text,
    modelVersion: text,
    promptVersion: text,
    parameters: z.record(z.string(), z.unknown()).default({}),
    contextKey: text,
  }),
  /** An agent session; its model identifier is recorded where the tool allows. */
  z.object({
    kind: z.literal("agent"),
    provider: text,
    tool: text,
    session: text,
    modelId: text.optional(),
    promptVersion: text.optional(),
    contextKey: text,
  }),
  z.object({ kind: z.literal("human"), note: text, contextKey: text }),
  /** Only for content that existed before generation provenance was kept. */
  z.object({ kind: z.literal("unknown"), note: text, contextKey: text }),
]);

const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);

export const generationRecord = z.object({
  generator: text,
  recordedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** The entry's hash before this change; null when it was first recorded. */
  sourceHash: sha256Hex.nullable(),
  outputHash: sha256Hex,
});

export const generationManifest = z
  .object({
    schemaVersion: z.literal(1),
    generators: z.record(z.string(), contentGenerator),
    entries: z.record(z.string(), generationRecord),
  })
  .superRefine((manifest, ctx) => {
    for (const [id, record] of Object.entries(manifest.entries)) {
      const generator = manifest.generators[record.generator];
      if (!generator) {
        ctx.addIssue({ code: "custom", path: ["entries", id], message: `unknown generator ${record.generator}` });
      } else if (generator.kind === "unknown" && record.sourceHash !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["entries", id],
          message: "a change after provenance began must name a real generator, not an unknown one",
        });
      }
    }
  });

export type GenerationManifest = z.infer<typeof generationManifest>;
