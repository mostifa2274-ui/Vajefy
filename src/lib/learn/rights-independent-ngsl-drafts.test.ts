import assert from "node:assert/strict";
import test from "node:test";
import { independentNgslSelection } from "./rights-independent-ngsl";
import {
  auditUnreviewedNgslDrafts,
  ngslDraftBatchFiles,
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

test("follow-up ranks 21–40 must match their exact separate source slice", () => {
  const next = fixture();
  next.lessons = next.lessons.map((item, i) => ({
    ...item,
    selectionId: selection.entries[i + 20]!.selectionId,
    lemma: selection.entries[i + 20]!.lemma,
    sourceRank: selection.entries[i + 20]!.sourceRank,
  }));
  const secondSlice = { ...selection, entries: selection.entries.slice(20, 40) };
  assert.deepEqual(auditUnreviewedNgslDrafts(next, secondSlice), []);
  assert.ok(auditUnreviewedNgslDrafts(next, selection).some(s => s.includes("wrongly sourced")));
  next.lessons[3]!.sourceRank = 200;
  assert.ok(auditUnreviewedNgslDrafts(next, secondSlice).some(s => s.includes("wrongly sourced")));
});

test("separate NGSL follow-up drafts reject fabricated approvals and cross-batch reuse", () => {
  const next = fixture();
  next.lessons = next.lessons.map((item, i) => ({
    ...item, ...selection.entries[i + 20],
    sourceRank: selection.entries[i + 20]!.sourceRank,
  }));
  const secondSlice = { ...selection, entries: selection.entries.slice(20, 40) };
  const prior = "Every bright little bird comes back to the same tree each morning";
  next.lessons[0]!.examples[0] = { en: prior, fa: "این فقط یک جملهٔ آزمایشی است." };
  assert.ok(auditUnreviewedNgslDrafts(next, secondSlice, [prior]).some(s => s.includes("verbatim overlap")));
  next.lessons[0]!.examples[0] = { en: "She walks to the shop.", fa: "او به مغازه می‌رود." };
  (next.lessons[0] as unknown as { rightsCleared: boolean }).rightsCleared = true;
  assert.ok(auditUnreviewedNgslDrafts(next, secondSlice).some(s => s.includes("unauthorized approval")));
});

test("third NGSL batch accepts only source ranks 41-60 and blocks approval claims", () => {
  const third = fixture();
  third.lessons = third.lessons.map((item, i) => ({
    ...item,
    selectionId: selection.entries[i + 40]!.selectionId,
    lemma: selection.entries[i + 40]!.lemma,
    sourceRank: selection.entries[i + 40]!.sourceRank,
  }));
  const thirdSlice = { ...selection, entries: selection.entries.slice(40, 60) };
  assert.deepEqual(auditUnreviewedNgslDrafts(third, thirdSlice), []);
  assert.ok(auditUnreviewedNgslDrafts(third, selection).some(s => s.includes("wrongly sourced")));
  third.lessons[0]!.sourceRank = 41_000;
  assert.ok(auditUnreviewedNgslDrafts(third, thirdSlice).some(s => s.includes("wrongly sourced")));
  third.lessons[0]!.sourceRank = 41;
  (third.lessons[0] as unknown as { semanticApproved: boolean }).semanticApproved = true;
  assert.ok(auditUnreviewedNgslDrafts(third, thirdSlice).some(s => s.includes("unauthorized approval")));
});

test("third NGSL batch rejects long copying from either earlier draft batch", () => {
  const third = fixture();
  third.lessons = third.lessons.map((item, i) => ({
    ...item,
    selectionId: selection.entries[i + 40]!.selectionId,
    lemma: selection.entries[i + 40]!.lemma,
    sourceRank: selection.entries[i + 40]!.sourceRank,
  }));
  const slice = { ...selection, entries: selection.entries.slice(40, 60) };
  const fromFirst = "A small green bicycle stands beside the old river bridge today";
  const fromSecond = "پسرک با کیف سرمه‌ای تازه از در پشتی باغ بیرون رفت";
  third.lessons[0]!.examples[0] = { en: fromFirst, fa: "برای آزمون یک جملهٔ ساده داریم." };
  assert.ok(auditUnreviewedNgslDrafts(third, slice, [fromFirst]).some(s => s.includes("verbatim overlap")));
  third.lessons[0]!.examples[0] = { en: "A different simple sentence.", fa: fromSecond };
  assert.ok(auditUnreviewedNgslDrafts(third, slice, [], [fromSecond]).some(s => s.includes("verbatim overlap")));
});

test("NGSL draft-batch discovery preserves contiguous 20-item source windows", () => {
  const valid = ngslDraftBatchFiles([
    "independent-ranks-41-60-drafts.json",
    "independent-first-900-selection.json",
    "independent-first-20-drafts.json",
    "independent-ranks-21-40-drafts.json",
  ]);
  assert.deepEqual(valid.issues, []);
  assert.deepEqual(valid.filenames, [
    "independent-first-20-drafts.json",
    "independent-ranks-21-40-drafts.json",
    "independent-ranks-41-60-drafts.json",
  ]);
  const missingMiddle = ngslDraftBatchFiles([
    "independent-first-20-drafts.json",
    "independent-ranks-41-60-drafts.json",
  ]);
  assert.ok(missingMiddle.issues.some(issue => issue.includes("expected 21")));
  const overlapping = ngslDraftBatchFiles([
    "independent-first-20-drafts.json",
    "independent-ranks-21-40-drafts.json",
    "independent-ranks-21-40-drafts.json",
  ]);
  assert.ok(overlapping.issues.some(issue => issue.includes("out-of-order")));
});

test("NGSL draft-batch discovery rejects malformed ranges and missing first batch", () => {
  const bad = ngslDraftBatchFiles([
    "independent-ranks-21-30-drafts.json",
    "independent-ranks-41-60-drafts.json",
    "independent-ranks-foo-80-drafts.json",
    "independent-ranks-901-920-drafts.json",
  ]);
  assert.ok(bad.issues.some(issue => issue.includes("Missing NGSL first-20")));
  assert.ok(bad.issues.some(issue => issue.includes("Invalid NGSL 20-item rank interval")));
  assert.ok(bad.issues.some(issue => issue.includes("Malformed NGSL draft batch name")));
});

test("independent NGSL drafts require distinct examples in both languages", () => {
  const batch = fixture();
  batch.lessons[0]!.examples[1] = {
    en: "there IS a test HERE!",
    fa: "اینجا یک آزمایش وجود دارد.",
  };
  assert.ok(
    auditUnreviewedNgslDrafts(batch, selection).some(issue =>
      issue.includes("duplicate English examples")),
  );
  assert.ok(
    auditUnreviewedNgslDrafts(batch, selection).some(issue =>
      issue.includes("duplicate Persian examples")),
  );
  batch.lessons[0]!.examples[1] = {
    en: "Another example about a different place.",
    fa: "این بار دربارهٔ جای دیگری می‌نویسیم.",
  };
  assert.ok(
    !auditUnreviewedNgslDrafts(batch, selection).some(issue =>
      issue.includes("duplicate")),
  );
});
