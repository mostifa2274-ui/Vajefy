import assert from "node:assert/strict";
import test from "node:test";
import { draftAudit, type DraftManifest } from "./rights-staging";

const sourceSha = "a".repeat(64);
const record = {
  lemma: "house",
  partOfSpeech: "noun",
  wordNetSenseKey: "house%1:06:00::",
};
const candidates = new Map([["house|noun", record]]);
function fixture(): DraftManifest {
  return {
    schemaVersion: 1,
    status: "STAGING_ONLY_NOT_PUBLIC_NOT_RIGHTS_CLEARED",
    sourceManifest: "content/rights-staging/oewn-2025-candidates.json",
    sourceArchiveSha256: sourceSha,
    authorship: "authoring-session",
    creationPolicy: "New, unapproved copy. Needs separate rights review.",
    requiredReviews: ["linguistic", "copyright", "pedagogy"],
    draftCount: 1,
    drafts: [{
      candidate: { ...record },
      editorialStatus: "DRAFT_NEEDS_HUMAN_PEDAGOGY_RIGHTS_AND_SENSE_REVIEW",
      levelHypothesis: "A1_UNVERIFIED",
      sourceSenseMatch: "NOT_YET_VERIFIED",
      reuseLegacyContent: false,
      selectionRationale: "Useful concrete noun; requires independent CEFR review.",
      authoredTeaching: {
        meaningEn: "a building in which people live",
        meaningFa: "خانه",
        examples: [
          { en: "There is a small garden behind our house.", fa: "پشت خانهٔ ما باغچهٔ کوچکی هست." },
          { en: "I can see a green door at that house.", fa: "در آن خانه یک در سبز می‌بینم." },
        ],
      },
    }],
  };
}

test("independent draft staging accepts sourced unapproved copy but never grants rights", () => {
  const proof = fixture();
  assert.deepEqual(draftAudit(proof, candidates, sourceSha, [], []), []);
  assert.equal(proof.drafts[0]?.levelHypothesis, "A1_UNVERIFIED");
});

test("independent draft staging rejects verbatim inherited examples and translations", () => {
  const proof = fixture();
  const a = draftAudit(proof, candidates, sourceSha,
    ["There is a small garden behind our house."],
    ["پشت خانهٔ ما باغچهٔ کوچکی هست."]);
  assert.ok(a.some(x => x.includes("verbatim example")));
});

test("independent draft staging rejects inherited eight-word sequences", () => {
  const proof = fixture();
  const a = draftAudit(proof, candidates, sourceSha,
    ["Oh look, there is a small garden behind our house today."], []);
  assert.ok(a.some(x => x.includes("eight-word sequence")));
});

test("independent draft staging rejects fake source keys, upstream hash drift and approval claims", () => {
  const proof = fixture();
  proof.drafts[0]!.candidate.wordNetSenseKey = "fabricated";
  proof.sourceArchiveSha256 = "b".repeat(64);
  proof.drafts[0]!.editorialStatus = "CLEARED";
  const a = draftAudit(proof, candidates, sourceSha, [], []);
  assert.ok(a.some(x => x.includes("source lemma/POS/sense key")));
  assert.ok(a.some(x => x.includes("source archive hash")));
  assert.ok(a.some(x => x.includes("rights boundaries were relaxed")));
});

test("independent draft staging catches duplicate candidates, duplicate sentences and mismatched count", () => {
  const proof = fixture();
  proof.drafts.push(structuredClone(proof.drafts[0]!));
  const a = draftAudit(proof, candidates, sourceSha, [], []);
  assert.ok(a.some(x => x.includes("Draft count mismatch")));
  assert.ok(a.some(x => x.includes("duplicate lemma/POS")));
  assert.ok(a.some(x => x.includes("duplicate draft example")));
});
