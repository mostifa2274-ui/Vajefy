import assert from "node:assert/strict";
import test from "node:test";
import { independentNgslSelection } from "./rights-independent-ngsl";
import {
  auditUnreviewedNgslDrafts,
  type NgslDraftManifest,
} from "./rights-independent-ngsl-drafts";

const selection = independentNgslSelection(
  Array.from({ length: 2809 }, (_, i) => ({ lemma: "lemma-" + (i + 1), rank: i + 1 })),
);
function fixture(): NgslDraftManifest {
  return {
    schemaVersion: 1,
    status: "STAGING_ONLY_AI_AUTHORED_LESSONS_NOT_INDEPENDENTLY_VERIFIED",
    selection: "content/rights-staging/ngsl-1.2/independent-first-900-selection.json",
    authoringMethod: "MODEL_AUTHORED_FROM_SOURCE_LEMMAS_NO_LEGACY_TEXT_IMPORT",
    authoringAgent: "fixture-not-reviewed",
    count: 20,
    semanticallyReviewed: 0,
    persianReviewed: 0,
    cefrReviewed: 0,
    rightsCleared: 0,
    publiclyReleased: 0,
    lessons: selection.entries.slice(0, 20).map(e => ({
      selectionId: e.selectionId,
      lemma: e.lemma,
      sourceRank: e.sourceRank,
      partOfSpeech: "noun",
      meaningEn: "independent test expression",
      meaningFa: "یک عبارت برای آزمون",
      usageFa: "یک توضیح برای آزمون",
      examples: [
        { en: "There is a test here.", fa: "اینجا یک آزمایش وجود دارد." },
        { en: "She reads a page.", fa: "او یک صفحه می‌خواند." },
      ],
      editorialState: "STAGING_ONLY_AI_DRAFT_UNREVIEWED",
      semanticApproved: false,
      persianApproved: false,
      cefrApproved: false,
      rightsCleared: false,
      publicRelease: false,
    })),
  };
}

test("accepts structured unreviewed NGSL drafts without granting publication", () => {
  const x = fixture();
  assert.deepEqual(auditUnreviewedNgslDrafts(x, selection), []);
  assert.equal(x.publiclyReleased, 0);
});

test("rejects invented approvals and renamed source candidates", () => {
  const x = fixture();
  const y = structuredClone(x) as unknown as { lessons: { rightsCleared: boolean }[] };
  y.lessons[4]!.rightsCleared = true;
  assert.ok(auditUnreviewedNgslDrafts(y as unknown as NgslDraftManifest, selection).some(s => s.includes("unauthorized approval")));
  x.lessons[2]!.lemma = "legacy-only-title";
  assert.ok(auditUnreviewedNgslDrafts(x, selection).some(s => s.includes("wrongly sourced")));
});

test("rejects long verbatim English or Persian reuse from inherited lessons", () => {
  const x = fixture();
  x.lessons[0]!.examples[0] = {
    en: "The bright blue bus stops near the small school.",
    fa: "اتوبوس آبی روشن نزدیک مدرسه کوچک در همین خیابان توقف می‌کند.",
  };
  const inheritedEnglish = ["The bright blue bus stops near the small school."];
  const inheritedPersian = ["اتوبوس آبی روشن نزدیک مدرسه کوچک در همین خیابان توقف می‌کند."];
  assert.ok(auditUnreviewedNgslDrafts(x, selection, inheritedEnglish).some(s => s.includes("verbatim overlap")));
  assert.ok(auditUnreviewedNgslDrafts(x, selection, [], inheritedPersian).some(s => s.includes("verbatim overlap")));
});
