import assert from "node:assert/strict";
import test from "node:test";
import {
  auditSenseProposals,
  SOURCE_PIN,
  type ProposalManifest,
} from "./rights-sense-proposals";

const candidate = { lemma: "run", partOfSpeech: "verb", wordNetSenseKey: "run%2:42:08::" };
const key = "run%2:38:00::";
const hash = "b".repeat(64);
function sample(): {
  manifest: ProposalManifest;
  drafts: {
    status: string;
    sourceArchiveSha256: string;
    drafts: { candidate: typeof candidate; authoredTeaching: { meaningEn: string } }[];
  };
  alternatives: {
    status: string;
    sourceArchiveSha256: string;
    selectedSenseCount: number;
    approvedCount: number;
    entries: { candidate: typeof candidate; alternatives: { wordNetSenseKey: string; glossSha256: string }[] }[];
  };
} {
  return {
    manifest: {
      schemaVersion: 1,
      status: "STAGING_ONLY_MODEL_SENSE_PROPOSALS_NOT_APPROVED",
      sourceArchiveSha256: SOURCE_PIN,
      draftManifest: "content/rights-staging/independent-a1-editorial-drafts.json",
      alternativesManifest: "content/rights-staging/oewn-2025-draft-alternatives.json",
      proposalCount: 1,
      approvedCount: 0,
      proposals: [{
        candidate: { ...candidate },
        editorialMeaningEn: "move quickly using your legs",
        proposedSenseKey: key,
        sourceGlossSha256: hash,
        reason: "The authored examples describe running on foot.",
        caveat: "This is a model proposal, not editorial or legal review.",
        reviewStatus: "MODEL_PROPOSAL_REQUIRES_INDEPENDENT_REVIEW",
        approved: false,
      }],
    },
    drafts: {
      status: "STAGING_ONLY_NOT_PUBLIC_NOT_RIGHTS_CLEARED",
      sourceArchiveSha256: SOURCE_PIN,
      drafts: [{ candidate: { ...candidate }, authoredTeaching: { meaningEn: "move quickly using your legs" } }],
    },
    alternatives: {
      status: "STAGING_ONLY_ALTERNATIVE_SENSES_NOT_APPROVED",
      sourceArchiveSha256: SOURCE_PIN,
      selectedSenseCount: 0,
      approvedCount: 0,
      entries: [{ candidate: { ...candidate }, alternatives: [{ wordNetSenseKey: key, glossSha256: hash }] }],
    },
  };
}
test("staged model proposals are structurally valid without granting any review", () => {
  const { manifest, drafts, alternatives } = sample();
  assert.deepEqual(auditSenseProposals(manifest, drafts, alternatives), []);
  assert.equal(manifest.approvedCount, 0);
});
test("reject modified pinned candidate, alternative SHA and teaching meaning", () => {
  const a = sample();
  a.manifest.proposals[0]!.sourceGlossSha256 = "a".repeat(64);
  assert.match(auditSenseProposals(a.manifest, a.drafts, a.alternatives).join(), /source\/gloss hash/);
  const b = sample();
  b.manifest.proposals[0]!.candidate.wordNetSenseKey = "run%2:42:99::";
  assert.match(auditSenseProposals(b.manifest, b.drafts, b.alternatives).join(), /no matching pinned/);
  const c = sample();
  c.manifest.proposals[0]!.editorialMeaningEn = "route a wire";
  assert.match(auditSenseProposals(c.manifest, c.drafts, c.alternatives).join(), /teaching meaning/);
});
test("reject invented approvals, unapproved status laundering and source-pin drift", () => {
  const a = sample();
  a.manifest.approvedCount = 1 as 0;
  assert.match(auditSenseProposals(a.manifest, a.drafts, a.alternatives).join(), /approval state invalid/);
  const b = sample();
  b.manifest.proposals[0]!.approved = true as false;
  assert.match(auditSenseProposals(b.manifest, b.drafts, b.alternatives).join(), /review restrictions/);
  const c = sample();
  c.drafts.sourceArchiveSha256 = "a".repeat(64);
  assert.match(auditSenseProposals(c.manifest, c.drafts, c.alternatives).join(), /Staging source/);
});
test("reject unchanged bad original sense, duplicate proposals and missing caution", () => {
  const a = sample();
  a.manifest.proposals[0]!.proposedSenseKey = candidate.wordNetSenseKey;
  assert.match(auditSenseProposals(a.manifest, a.drafts, a.alternatives).join(), /distinct/);
  const b = sample();
  b.manifest.proposals.push(structuredClone(b.manifest.proposals[0]!));
  b.manifest.proposalCount = 2;
  assert.match(auditSenseProposals(b.manifest, b.drafts, b.alternatives).join(), /duplicate/);
  const c = sample();
  c.manifest.proposals[0]!.caveat = "Approved";
  assert.match(auditSenseProposals(c.manifest, c.drafts, c.alternatives).join(), /review restrictions/);
});
