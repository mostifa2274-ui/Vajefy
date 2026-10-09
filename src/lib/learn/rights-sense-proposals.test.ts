import assert from "node:assert/strict";
import test from "node:test";
import {
  checkUnapprovedSenseProposals,
  type DraftSense,
  type SourceSenseGroup,
  type SenseProposalManifest,
} from "./rights-sense-proposals";

const original = { lemma: "run", partOfSpeech: "verb", wordNetSenseKey: "run%2:42:08::" };
const alternative = {
  wordNetSenseKey: "run%2:38:00::",
  senseNumber: 1,
  glossSha256: "a".repeat(64),
  synsetOffset: "01928212",
};
const group: SourceSenseGroup = {
  candidate: original,
  editorialMeaningEn: "move quickly using your legs",
  alternatives: [alternative, {
    wordNetSenseKey: original.wordNetSenseKey,
    senseNumber: 33,
    glossSha256: "b".repeat(64),
    synsetOffset: "02928212",
  }],
};
const draft: DraftSense = {
  candidate: original,
  authoredTeaching: { meaningEn: "move quickly using your legs" },
};
const source = {
  archiveSha256: "c".repeat(64),
  draftManifest: "drafts.json",
  alternativeManifest: "alternatives.json",
};
const make = (): SenseProposalManifest => ({
  schemaVersion: 1,
  status: "STAGING_ONLY_AI_SENSE_PROPOSALS_NOT_APPROVED",
  sourceArchiveSha256: source.archiveSha256,
  draftManifest: source.draftManifest,
  alternativesManifest: source.alternativeManifest,
  proposalAuthor: "test-unapproved",
  draftCount: 1,
  proposedCount: 1,
  requiresSplitCount: 0,
  approvedCount: 0,
  entries: [{
    candidate: original,
    originalWordNetSenseKey: original.wordNetSenseKey,
    authoredMeaningEn: group.editorialMeaningEn,
    disposition: "UNVERIFIED_PROPOSED_SENSE",
    proposal: {
      wordNetSenseKey: alternative.wordNetSenseKey,
      senseNumber: alternative.senseNumber,
      sourceGlossSha256: alternative.glossSha256,
      synsetOffset: alternative.synsetOffset,
    },
    editorialRationale: "A preliminary lexical meaning match only. No review or clearance.",
    reviewStatus: "NO_INDEPENDENT_REVIEW",
    levelStatus: "A1_NOT_VERIFIED",
    rightsStatus: "NOT_CLEARED",
    reviewEvidence: [],
  }],
});

const check = (m: SenseProposalManifest) =>
  checkUnapprovedSenseProposals(m, [group], [draft], source);

test("source-bound unreviewed rekey suggestion is structurally valid, not an approval", () => {
  assert.deepEqual(check(make()), []);
});
test("refuses forged rights, human review and CEFR approval", () => {
  const m = make();
  m.entries[0]!.rightsStatus = "CLEARED";
  m.entries[0]!.reviewStatus = "APPROVED";
  m.entries[0]!.levelStatus = "A1_CERTIFIED";
  m.approvedCount = 1;
  assert.ok(check(m).some(e => e.includes("forged")));
  assert.ok(check(m).some(e => e.includes("Only unapproved")));
});
test("rejects invented source keys and altered upstream source gloss hashes", () => {
  const m = make();
  m.entries[0]!.proposal!.wordNetSenseKey = "run%2:88:88::";
  assert.ok(check(m).some(e => e.includes("exact upstream")));
  const changed = make();
  changed.entries[0]!.proposal!.sourceGlossSha256 = "e".repeat(64);
  assert.ok(check(changed).some(e => e.includes("exact upstream")));
});
test("rejects a rekey that retains the original incorrect source sense", () => {
  const m = make();
  m.entries[0]!.proposal = {
    wordNetSenseKey: original.wordNetSenseKey,
    senseNumber: 33,
    sourceGlossSha256: "b".repeat(64),
    synsetOffset: "02928212",
  };
  assert.ok(check(m).some(e => e.includes("keeps the original")));
});
test("requiring a split never silently picks an automatic sense", () => {
  const m = make();
  m.entries[0]!.disposition = "REQUIRES_MEANING_SPLIT";
  m.proposedCount = 0;
  m.requiresSplitCount = 1;
  assert.ok(check(m).some(e => e.includes("must not have")));
  m.entries[0]!.proposal = null;
  assert.deepEqual(check(m), []);
});
test("source drift or missing coverage fails closed", () => {
  const m = make();
  m.entries[0]!.authoredMeaningEn = "run a computer program";
  assert.ok(check(m).some(e => e.includes("changed")));
  const shorter = make();
  shorter.entries.length = 0;
  assert.ok(check(shorter).some(e => e.includes("coverage")));
});
