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
