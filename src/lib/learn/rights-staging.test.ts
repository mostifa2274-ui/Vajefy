import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { auditOewnSenseReferences, draftAudit, type DraftManifest, type OewnSenseReferenceManifest } from "./rights-staging";

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

test("independent staging detects longer Persian-source fragments despite extra prose", () => {
  const proof = fixture();
  const shared = "صبح زود همراه خانواده در یک پارک بزرگ قدم می زنیم و درباره برنامه سفر صحبت می کنیم";
  proof.drafts[0]!.authoredTeaching.examples[0]!.fa =
    "دیروز " + shared + " و سپس به خانه برمی‌گردیم.";
  const inherited = "در خاطرات هفته قبل نوشته بودم که " +
    shared.replaceAll("می", "مي").replaceAll("ک", "ك") +
    " اما هوا ناگهان بارانی شد.";
  const errors = draftAudit(proof, candidates, sourceSha, [], [inherited]);
  assert.ok(errors.some(x => x.includes("ten-word Persian sequence")));
});

test("short generic Persian vocabulary is not treated as a copied sentence", () => {
  const proof = fixture();
  const errors = draftAudit(proof, candidates, sourceSha, [], [
    "من به خانه می‌روم.",
    "صبح خوش!",
  ]);
  assert.equal(errors.some(x => x.includes("ten-word Persian sequence")), false);
});


const hashGloss = (s: string) => createHash("sha256").update(s).digest("hex");
function lexicalReferenceFixture(): OewnSenseReferenceManifest {
  const gloss = "a building used as a home";
  return {
    schemaVersion: 1,
    status: "STAGING_ONLY_LEXICAL_SOURCE_NOT_RELEASE_CLEARED",
    sourceManifest: "content/rights-staging/oewn-2025-candidates.json",
    sourceArchiveSha256: sourceSha,
    sourceUrl: "https://en-word.net/static/english-wordnet-2025.zip",
    licenseNotices: [
      "https://github.com/globalwordnet/english-wordnet/blob/main/LICENSE.md",
      "https://wordnet.princeton.edu/license-and-commercial-use",
    ],
    legalStatus: "No rights or CEFR approvals. External verification required.",
    candidateCount: 1,
    references: [{
      candidate: { ...record },
      dataFile: "data.noun",
      synsetOffset: "01234567",
      senseNumber: 3,
      tagCount: 0,
      synsetMembers: ["house"],
      sourceGloss: gloss,
      glossSha256: hashGloss(gloss),
      reviewStatus: "SOURCE_SENSE_NOT_YET_EDITORIALLY_VERIFIED",
    }],
  };
}

test("source sense records preserve exact intake mapping without falsely approving the draft", () => {
  const source = lexicalReferenceFixture();
  assert.deepEqual(auditOewnSenseReferences(source, [record], sourceSha, hashGloss), []);
  assert.equal(source.references[0]?.senseNumber, 3);
  assert.equal(source.references[0]?.reviewStatus, "SOURCE_SENSE_NOT_YET_EDITORIALLY_VERIFIED");
});

test("source sense integrity rejects altered gloss, wrong mapping and forged source approval", () => {
  const source = lexicalReferenceFixture();
  source.references[0]!.sourceGloss = "different text";
  source.references[0]!.candidate.wordNetSenseKey = "invented";
  source.references[0]!.reviewStatus = "CLEARED";
  const issues = auditOewnSenseReferences(source, [record], sourceSha, hashGloss);
  assert.ok(issues.some(x => x.includes("exact pinned candidate sense")));
  assert.ok(issues.some(x => x.includes("altered source gloss")));
  assert.ok(issues.some(x => x.includes("improperly claims")));
});

test("source sense audit requires both licences and full inventory", () => {
  const source = lexicalReferenceFixture();
  source.licenseNotices = [];
  source.references = [];
  const issues = auditOewnSenseReferences(source, [record], sourceSha, hashGloss);
  assert.ok(issues.some(x => x.includes("licence notices")));
  assert.ok(issues.some(x => x.includes("count")));
  assert.ok(issues.some(x => x.includes("Missing source sense evidence")));
});
