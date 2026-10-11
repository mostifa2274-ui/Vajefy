import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import { auditCefrjLessonDrafts, identityHasPos, type CefrjLessonDraftManifest } from "./rights-cefrj-lesson-drafts";
import type { SelectedRecord } from "./rights-cefrj-selection";
import type { PlacedWord } from "./rights-level-selection";

const selection = fs.readFileSync("content/rights-staging/a1-rebuild/cefrj-a1-selection.json", "utf8");
const levelSelection = fs.readFileSync("content/rights-staging/level-rebuild/level-selection.json", "utf8");
const batch = JSON.parse(fs.readFileSync("content/rights-staging/a1-rebuild/lessons-new-001-020.json", "utf8")) as CefrjLessonDraftManifest;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const context = {
  selected: (JSON.parse(selection) as { selected: SelectedRecord[] }).selected,
  words: (JSON.parse(levelSelection) as { words: PlacedWord[] }).words,
  selectionSha256: sha256(selection), levelSelectionSha256: sha256(levelSelection),
  identities: ["a1", "a2", "b1", "b2", "b2x", "c1"].flatMap(level =>
    (JSON.parse(fs.readFileSync("public/data/lex-" + level + ".json", "utf8")) as { id: string; pos: string }[])
      .map(x => ({ id: x.id, partsOfSpeech: x.pos }))),
};
const clone = () => structuredClone(batch);

test("the full first-20 CEFR-J drafts match source senses and preserve compatible entry IDs", () => {
  assert.deepEqual(auditCefrjLessonDrafts(batch, context), []);
  assert.equal(batch.lessons.find(x => x.sourceHeadword === "hold")!.entry.id, "lex:B2:hold");
  assert.equal(batch.lessons.find(x => x.sourceHeadword === "cover")!.entry.id, "lex:B1:cover");
  assert.equal(batch.lessons.find(x => x.sourceHeadword === "set")!.entry.id, "lex:B1:set-put");
});

test("stale source selections, reordered windows and missing lessons fail", () => {
  assert.match(auditCefrjLessonDrafts(batch, { ...context, selectionSha256: "a".repeat(64) }).join("\n"), /source selection changed/);
  const changed = clone(); changed.lessons.reverse();
  assert.match(auditCefrjLessonDrafts(changed, context).join("\n"), /out-of-order/);
  changed.lessons.pop();
  assert.match(auditCefrjLessonDrafts(changed, context).join("\n"), /window/);
});

test("staging cannot claim independent approval, rights or audio certification", () => {
  for (const flag of ["semanticApproved", "persianApproved", "cefrApproved", "rightsCleared", "audioCertified", "curriculumApproved", "publicRelease"] as const) {
    const changed = clone(); Object.assign(changed.lessons[0]!, { [flag]: true });
    assert.ok(auditCefrjLessonDrafts(changed, context).length, flag);
  }
  assert.ok(auditCefrjLessonDrafts({ ...batch, publiclyReleased: 1 }, context).length);
});

test("a selected noun cannot inherit the verb's ID or be authored as the NGSL verb sense", () => {
  const changed = clone(); const hold = changed.lessons.find(x => x.sourceHeadword === "hold")!;
  hold.entry.id = "lex:A2:hold"; hold.entry.senses[0]!.id = "lex:A2:hold";
  hold.sourceRecords[0]!.senseId = "lex:A2:hold";
  assert.match(auditCefrjLessonDrafts(changed, context).join("\n"), /preserved entry ID/);
  hold.entry.senses[0]!.pos = "verb";
  assert.match(auditCefrjLessonDrafts(changed, context).join("\n"), /sense\/source part of speech/);
  assert.equal(identityHasPos({ id: "x", partsOfSpeech: "فعل وجهی" }, "verb"), false);
});

test("lowercase modal may cannot inherit the capitalized month May's ID", () => {
  const changed = clone(); const may = changed.lessons[0]!;
  may.entry.id = "lex:A1:may"; may.entry.senses[0]!.id = "lex:A1:may";
  may.sourceRecords[0]!.senseId = "lex:A1:may";
  assert.match(auditCefrjLessonDrafts(changed, context).join("\n"), /preserved entry ID/);
});

test("missing Persian, reused held-out sentences and identical mistake translations fail", () => {
  const changed = clone(); const s = changed.lessons[0]!.entry.senses[0]!;
  s.grammar[0]!.note = "Use the base verb";
  s.mistake.wrongFa = s.mistake.rightFa;
  const heldOut = s.check.at(-1)!;
  assert.equal(heldOut.type, "produce");
  if (heldOut.type === "produce") heldOut.frame = s.examples[0]!.en.replace("may", "___");
  const issues = auditCefrjLessonDrafts(changed, context).join("\n");
  assert.match(issues, /Persian explanations/);
  assert.match(issues, /translations are identical/);
  assert.match(issues, /reuses a teaching example/);
});

test("existing teaching examples and long Persian overlaps are detected", () => {
  const en = batch.lessons[0]!.entry.senses[0]!.examples[0]!.en;
  assert.match(auditCefrjLessonDrafts(batch, { ...context, inheritedEnglish: [en] }).join("\n"), /overlaps legacy/);
  const changed = clone(); changed.lessons[0]!.entry.senses[0]!.examples[0]!.fa = "این یک جمله طولانی فارسی است که از متن قبلی کپی شده است";
  assert.match(auditCefrjLessonDrafts(changed, { ...context, inheritedPersian: ["این یک جمله طولانی فارسی است که از متن قبلی کپی شده است"] }).join("\n"), /overlaps legacy/);
});
