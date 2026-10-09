import assert from "node:assert/strict";
import test from "node:test";
import {
  checkIndependentNgslSelection,
  independentNgslSelection,
  readRankedNgslCore,
} from "./rights-independent-ngsl";

const sourceRows = () => Array.from({ length: 2809 }, (_, i) => ({
  lemma: i === 0 ? "the" : i === 1 ? "be" : "sample-" + (i + 1),
  rank: i + 1,
}));
const csv = () => "word,rank\r\n" + sourceRows().map(x => x.lemma + "," + x.rank).join("\r\n") + "\r\n";

test("independently selects NGSL rank 1–900 with fresh IDs and no Oxford input", () => {
  const selection = independentNgslSelection(readRankedNgslCore(csv()));
  assert.equal(selection.entries.length, 900);
  assert.equal(selection.entries[0]?.lemma, "the");
  assert.equal(selection.entries.at(-1)?.sourceRank, 900);
  assert.equal(selection.entries.at(-1)?.selectionId, "ngsl:freq:0900");
  assert.equal(selection.selected, 900);
  assert.equal(selection.releasedItems, 0);
  assert.equal(selection.verifiedA1Words, 0);
  assert.equal(selection.authoredLessons, 0);
  assert.deepEqual(checkIndependentNgslSelection(selection, selection), []);
});

test("rejects duplicated rank and forged upstream lemma before selection", () => {
  assert.throws(() => readRankedNgslCore(csv().replace("sample-21,21", "sample-21,20")), /ranks must be/);
  assert.throws(() => readRankedNgslCore(csv().replace("sample-21,21", "sample-22,21")), /Duplicate/);
  assert.throws(() => readRankedNgslCore(csv().replace("word,rank", "lemma,rank")), /header changed/);
});

test("stage manifest cannot pretend frequency rank determines A1 or distribution permission", () => {
  const expected = independentNgslSelection(sourceRows());
  const fake = structuredClone(expected) as unknown as Record<string, unknown>;
  fake.verifiedA1Words = 900;
  assert.notDeepEqual(checkIndependentNgslSelection(fake, expected), []);
  const fake2 = structuredClone(expected);
  fake2.entries[7]!.releaseApproved = true as false;
  assert.notDeepEqual(checkIndependentNgslSelection(fake2, expected), []);
  const fake3 = structuredClone(expected);
  fake3.entries[0]!.lemma = "Oxford-import";
  assert.notDeepEqual(checkIndependentNgslSelection(fake3, expected), []);
});
