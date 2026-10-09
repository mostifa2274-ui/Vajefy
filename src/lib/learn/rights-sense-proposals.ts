/**
 * OEWN lexical sense proposals are editorial leads, not licence, semantic,
 * translation, human-review, CEFR or public-distribution authorisations.
 *
 * Fail closed against the exact, SHA-pinned offline candidate alternatives.
 * Neither this validator nor its fixtures may promote a draft to public content.
 */
export type WordnetIdentity = {
  lemma: string;
  partOfSpeech: string;
  wordNetSenseKey: string;
};
export type SenseProposal = {
  candidate: WordnetIdentity;
  editorialMeaningEn: string;
  proposedSenseKey: string;
  sourceGlossSha256: string;
  reason: string;
  caveat: string;
  reviewStatus: "MODEL_PROPOSAL_REQUIRES_INDEPENDENT_REVIEW";
  approved: false;
};
export type ProposalManifest = {
  schemaVersion: 1;
  status: "STAGING_ONLY_MODEL_SENSE_PROPOSALS_NOT_APPROVED";
  sourceArchiveSha256: string;
  draftManifest: string;
  alternativesManifest: string;
  proposalCount: number;
  approvedCount: 0;
  proposals: SenseProposal[];
};

type EditorialDraft = {
  candidate: WordnetIdentity;
  authoredTeaching: { meaningEn: string };
};
type AlternativesGroup = {
  candidate: WordnetIdentity;
  alternatives: { wordNetSenseKey: string; glossSha256: string }[];
};
type DraftEvidence = {
  status: string;
  sourceArchiveSha256: string;
  drafts: EditorialDraft[];
};
type AlternativeEvidence = {
  status: string;
  sourceArchiveSha256: string;
  selectedSenseCount: number;
  approvedCount: number;
  entries: AlternativesGroup[];
};

export const SOURCE_PIN =
  "38b16326159f51853626b7d24a44c453fa88ab33f06fce5ec8fc5996d1c2be93";
const HASH = /^[a-f0-9]{64}$/;
const candidateId = (c: WordnetIdentity) =>
  [c.lemma, c.partOfSpeech, c.wordNetSenseKey].join("|");

export function auditSenseProposals(
  manifest: ProposalManifest,
  drafts: DraftEvidence,
  alternatives: AlternativeEvidence,
): string[] {
  const errors: string[] = [];
  if (manifest.schemaVersion !== 1 ||
      manifest.status !== "STAGING_ONLY_MODEL_SENSE_PROPOSALS_NOT_APPROVED" ||
      manifest.sourceArchiveSha256 !== SOURCE_PIN ||
      manifest.draftManifest !== "content/rights-staging/independent-a1-editorial-drafts.json" ||
      manifest.alternativesManifest !== "content/rights-staging/oewn-2025-draft-alternatives.json") {
    errors.push("Proposal status or pinned source coordinates changed.");
  }
  if (drafts.status !== "STAGING_ONLY_NOT_PUBLIC_NOT_RIGHTS_CLEARED" ||
      alternatives.status !== "STAGING_ONLY_ALTERNATIVE_SENSES_NOT_APPROVED" ||
      drafts.sourceArchiveSha256 !== SOURCE_PIN ||
      alternatives.sourceArchiveSha256 !== SOURCE_PIN ||
      alternatives.selectedSenseCount !== 0 || alternatives.approvedCount !== 0) {
    errors.push("Staging source or its zero-approval state changed.");
  }
  if (!Array.isArray(manifest.proposals) ||
      manifest.proposals.length === 0 ||
      manifest.proposalCount !== manifest.proposals.length ||
      manifest.approvedCount !== 0 ||
      !Array.isArray(drafts.drafts) || !Array.isArray(alternatives.entries)) {
    errors.push("Proposal counts or staging-only approval state invalid.");
    return errors;
  }

  const editorial = new Map(drafts.drafts.map(d => [candidateId(d.candidate), d]));
  const altGroups = new Map(alternatives.entries.map(g => [candidateId(g.candidate), g]));
  if (editorial.size !== drafts.drafts.length ||
      altGroups.size !== alternatives.entries.length) {
    errors.push("Duplicate source draft or alternative identity.");
  }
  const seen = new Set<string>();
  for (const [index, p] of manifest.proposals.entries()) {
    const base = "proposals[" + index + "]";
    if (!p || !p.candidate ||
        typeof p.candidate.lemma !== "string" ||
        typeof p.candidate.partOfSpeech !== "string" ||
        typeof p.candidate.wordNetSenseKey !== "string") {
      errors.push(base + ": missing original source candidate.");
      continue;
    }
    const id = candidateId(p.candidate);
    if (seen.has(id)) errors.push(base + ": duplicate source candidate.");
    seen.add(id);
    const draft = editorial.get(id);
    const group = altGroups.get(id);
    if (!draft || !group) {
      errors.push(base + ": no matching pinned editorial draft and alternatives.");
      continue;
    }
    if (p.editorialMeaningEn !== draft.authoredTeaching.meaningEn) {
      errors.push(base + ": edited teaching meaning was not reflected in proposal.");
    }
    if (p.proposedSenseKey === p.candidate.wordNetSenseKey) {
      errors.push(base + ": proposed sense must be distinct from the known unverified original.");
    }
    const source = group.alternatives.find(a => a.wordNetSenseKey === p.proposedSenseKey);
    if (!source || !HASH.test(p.sourceGlossSha256) ||
        p.sourceGlossSha256 !== source.glossSha256) {
      errors.push(base + ": missing or altered pinned alternative sense/gloss hash.");
    }
    if (p.reviewStatus !== "MODEL_PROPOSAL_REQUIRES_INDEPENDENT_REVIEW" ||
        p.approved !== false ||
        typeof p.reason !== "string" || p.reason.trim().length < 35 ||
        typeof p.caveat !== "string" || p.caveat.trim().length < 30) {
      errors.push(base + ": missing review restrictions, reason or counterexample/caveat.");
    }
    // This is deliberately an integrity-only check, NOT a semantic verdict.
  }
  if (manifest.proposals.length > drafts.drafts.length) {
    errors.push("More proposals than independently staged source drafts.");
  }
  return errors;
}
