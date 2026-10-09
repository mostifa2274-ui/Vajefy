/**
 * SHA-bound, strictly *unapproved* editorial queue for independently staged OEWN senses.
 * No rights, CEFR or lexical correctness judgment is conferred by these checks.
 */
type Candidate = { lemma: string; partOfSpeech: string; wordNetSenseKey: string };
type Alternative = { wordNetSenseKey: string; senseNumber: number; glossSha256: string; synsetOffset: string };
export type SourceSenseGroup = {
  candidate: Candidate;
  editorialMeaningEn: string;
  alternatives: Alternative[];
};
export type DraftSense = { candidate: Candidate; authoredTeaching: { meaningEn: string } };
export type SenseProposal = {
  candidate: Candidate;
  authoredMeaningEn: string;
  originalWordNetSenseKey: string;
  disposition: "UNVERIFIED_PROPOSED_SENSE" | "REQUIRES_MEANING_SPLIT";
  proposal: null | {
    wordNetSenseKey: string;
    senseNumber: number;
    sourceGlossSha256: string;
    synsetOffset: string;
  };
  editorialRationale: string;
  reviewStatus: string;
  levelStatus: string;
  rightsStatus: string;
  reviewEvidence: string[];
};
export type SenseProposalManifest = {
  schemaVersion: number;
  status: string;
  sourceArchiveSha256: string;
  draftManifest: string;
  alternativesManifest: string;
  proposalAuthor: string;
  draftCount: number;
  proposedCount: number;
  requiresSplitCount: number;
  approvedCount: number;
  entries: SenseProposal[];
};

export function checkUnapprovedSenseProposals(
  manifest: SenseProposalManifest,
  groups: readonly SourceSenseGroup[],
  drafts: readonly DraftSense[],
  options: { archiveSha256: string; draftManifest: string; alternativeManifest: string },
): string[] {
  const issues: string[] = [];
  const fail = (message: string) => issues.push(message);
  if (manifest.schemaVersion !== 1 ||
      manifest.status !== "STAGING_ONLY_AI_SENSE_PROPOSALS_NOT_APPROVED" ||
      !manifest.proposalAuthor?.trim() ||
      manifest.sourceArchiveSha256 !== options.archiveSha256 ||
      manifest.draftManifest !== options.draftManifest ||
      manifest.alternativesManifest !== options.alternativeManifest) {
    fail("Staging identity, provenance, or version mismatch");
  }
  if (!Array.isArray(manifest.entries) || !Array.isArray(groups) || !Array.isArray(drafts)) {
    return [...issues, "Missing manifest, alternative or draft rows"];
  }
  if (manifest.entries.length !== manifest.draftCount ||
      groups.length !== drafts.length ||
      manifest.entries.length !== groups.length) fail("Draft/alternatives/proposals coverage mismatch");
  if (manifest.approvedCount !== 0) fail("Only unapproved proposals are permitted");
  let proposed = 0, split = 0;
  const seen = new Set<string>();
  for (const [index, item] of manifest.entries.entries()) {
    const group = groups[index], draft = drafts[index];
    const prefix = `proposal[${index}]`;
    if (!group || !draft || !item || !item.candidate) {
      fail(prefix + ": missing matching upstream group or draft");
      continue;
    }
    const id = [item.candidate.lemma, item.candidate.partOfSpeech, item.candidate.wordNetSenseKey].join("|");
    if (seen.has(id)) fail(prefix + ": duplicate candidate");
    seen.add(id);
    if (JSON.stringify(item.candidate) !== JSON.stringify(group.candidate) ||
        JSON.stringify(item.candidate) !== JSON.stringify(draft.candidate) ||
        item.originalWordNetSenseKey !== item.candidate.wordNetSenseKey ||
        item.authoredMeaningEn !== group.editorialMeaningEn ||
        item.authoredMeaningEn !== draft.authoredTeaching.meaningEn) {
      fail(prefix + ": source key, draft or authored meaning changed");
    }
    if (item.reviewStatus !== "NO_INDEPENDENT_REVIEW" ||
        item.levelStatus !== "A1_NOT_VERIFIED" ||
        item.rightsStatus !== "NOT_CLEARED" ||
        !Array.isArray(item.reviewEvidence) || item.reviewEvidence.length !== 0 ||
        typeof item.editorialRationale !== "string" ||
        item.editorialRationale.trim().length < 30) {
      fail(prefix + ": forged review, rights, CEFR, or inadequate rationale");
    }
    if (item.disposition === "UNVERIFIED_PROPOSED_SENSE") {
      proposed++;
      if (!item.proposal) {
        fail(prefix + ": missing proposed sense");
        continue;
      }
      const alt = group.alternatives?.find(a => a.wordNetSenseKey === item.proposal!.wordNetSenseKey);
      if (!alt ||
          alt.senseNumber !== item.proposal.senseNumber ||
          alt.glossSha256 !== item.proposal.sourceGlossSha256 ||
          alt.synsetOffset !== item.proposal.synsetOffset ||
          !/^[a-f0-9]{64}$/.test(item.proposal.sourceGlossSha256)) {
        fail(prefix + ": proposal is not bound to the exact upstream source sense/gloss");
      }
      if (item.proposal.wordNetSenseKey === item.originalWordNetSenseKey) {
        fail(prefix + ": purported rekey keeps the original mismatched source key");
      }
    } else if (item.disposition === "REQUIRES_MEANING_SPLIT") {
      split++;
      if (item.proposal !== null) fail(prefix + ": split-required meaning must not have an automatic sense key");
    } else {
      fail(prefix + ": invalid editorial disposition");
    }
  }
  if (proposed !== manifest.proposedCount || split !== manifest.requiresSplitCount ||
      proposed + split !== manifest.draftCount) {
    fail("Proposed/split counts inconsistent with staging rows");
  }
  return issues;
}
