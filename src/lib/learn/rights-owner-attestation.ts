import { z } from "zod";

/**
 * Records what the owner said, not proof of copyright, licensing, toolchain,
 * independence from third-party inputs, or permission to publish any asset.
 */
export const ownerAuthorshipAttestation = z.object({
  schemaVersion: z.literal(1),
  declaredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  declarant: z.literal("Project owner (user statement in ChatGPT conversation)"),
  claimKind: z.literal("OWNER_SELF_REPORTED_AUTHORSHIP_NOT_INDEPENDENTLY_VERIFIED"),
  declaration: z.literal(
    "All lessons, existing audio, artwork, or historical repository content are made by chatgpt",
  ),
  categories: z.array(z.enum([
    "lessons", "audio", "artwork", "historical_repository_content",
  ])).length(4).refine(items => new Set(items).size === 4, "Every distinct asset category is required"),
  claimedCreator: z.literal("ChatGPT"),
  creationEvidence: z.literal("USER_STATEMENT_ONLY_NO_ITEM_LEVEL_GENERATION_LOG"),
  mediaProductionEvidence: z.literal("NOT_FILE_BY_FILE_VERIFIED"),
  thirdPartyInputRights: z.literal("NOT_ESTABLISHED_BY_THIS_STATEMENT"),
  sourceSelectionRights: z.literal("NOT_ESTABLISHED_BY_THIS_STATEMENT"),
  derivativeRedistributionRights: z.literal("NOT_ESTABLISHED_BY_THIS_STATEMENT"),
  legalEffect: z.literal("NO_RIGHTS_CLEARANCE_OR_LICENSE_GRANT"),
  gate0Effect: z.literal("GATE0_REMAINS_SUBJECT_TO_INDEPENDENT_SOURCE_AND_ITEM_EVIDENCE"),
  notes: z.array(z.string().trim().min(15)).min(3),
  /**
   * Later owner statements, kept verbatim. The 2026-10-10 statement and its answers are
   * bound exactly, so a deleted or reworded record fails validation. Each is testimony,
   * never a licence.
   */
  laterStatements: z.tuple([
    z.object({
      declaredOn: z.literal("2026-10-10"),
      declarant: z.literal("Project owner (user statement in Claude Code session)"),
      statement: z.literal("Map all words to ngsl list, all other materials except words are made of chatgpt"),
      answers: z.tuple([
        z.object({
          question: z.literal("When the lessons were made with ChatGPT, was any Oxford text (definitions, example sentences, exercises) pasted in as input?"),
          answer: z.literal("No, only the words"),
        }).strict(),
        z.object({
          question: z.literal("How should the app's word list be based on NGSL?"),
          answer: z.literal("Rebuild by an NGSL rule"),
        }).strict(),
        z.object({
          question: z.literal("Which rule should choose the A1 words?"),
          answer: z.literal("All CEFR-J A1 (~1,060)"),
        }).strict(),
        z.object({
          question: z.literal("Frozen Units 1–3 lose about 18 words under the new rule. May I edit them?"),
          answer: z.literal("Yes, unfreeze them"),
        }).strict(),
      ]),
      scope: z.string().trim().min(15),
      claimKind: z.literal("OWNER_SELF_REPORTED_AUTHORSHIP_NOT_INDEPENDENTLY_VERIFIED"),
      legalEffect: z.literal("NO_RIGHTS_CLEARANCE_OR_LICENSE_GRANT"),
    }).strict(),
  ]),
}).strict();

export type OwnerAuthorshipAttestation = z.infer<typeof ownerAuthorshipAttestation>;

/** User testimony is informational; release checks must use rights-lineage evidence. */
export function attestationCannotClearRights(
  record: OwnerAuthorshipAttestation,
): boolean {
  return record.legalEffect === "NO_RIGHTS_CLEARANCE_OR_LICENSE_GRANT" &&
    record.thirdPartyInputRights === "NOT_ESTABLISHED_BY_THIS_STATEMENT" &&
    record.sourceSelectionRights === "NOT_ESTABLISHED_BY_THIS_STATEMENT" &&
    record.derivativeRedistributionRights === "NOT_ESTABLISHED_BY_THIS_STATEMENT";
}
