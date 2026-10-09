import assert from "node:assert/strict";
import test from "node:test";
import {
  buildIndependentNgslSelection,
  NGSL_INDEPENDENT_STATUS,
  NGSL_REVIEW_STATUS,
} from "./rights-ngsl-independent";

const fixture = "word,rank\r\nthe,1\r\nbe,2\r\nand,3\r\n";
const options = { sourceRows: 3, selectedRows: 2 };

test("independent NGSL selection is derived only from source ranks, with no inherited IDs", () => {
  const result = buildIndependentNgslSelection(fixture, options);
  assert.equal(result.status, NGSL_INDEPENDENT_STATUS);
  assert.equal(result.selectedCount, 2);
  assert.equal(result.independentlyApprovedCount, 0);
  assert.equal(result.sourcePermissionAppliedToLegacyContent, false);
  assert.deepEqual(result.candidates.map(c => [c.candidateId, c.lemma, c.ngslCoreRank]), [
    ["ngsl-1.2-core-0001", "the", 1],
    ["ngsl-1.2-core-0002", "be", 2],
  ]);
  assert.ok(result.candidates.every(c => c.reviewStatus === NGSL_REVIEW_STATUS && !c.publicRelease));
  assert.equal(JSON.stringify(result).includes("lex:A1:"), false);
});

test("independent selection refuses missing, reordered, or forged source ranks", () => {
  assert.throws(() => buildIndependentNgslSelection("word,rank\nthe,2\nbe,1\nand,3", options), /rank\/header drift/);
  assert.throws(() => buildIndependentNgslSelection("word,rank\nthe,1\nbe,2", options), /incomplete/);
  assert.throws(() => buildIndependentNgslSelection("lemma,rank\nthe,1\nbe,2\nand,3", options), /invalid or incomplete/i);
  assert.throws(() => buildIndependentNgslSelection("word,rank\nthe,1\nbe,2\nthe,3", options), /duplicate/);
});

test("the frozen count cannot be replaced with an invalid or oversized selection", () => {
  assert.throws(() => buildIndependentNgslSelection(fixture, {sourceRows: 3,selectedRows: 4}), /size/);
  assert.throws(() => buildIndependentNgslSelection(fixture, {sourceRows: 3,selectedRows: 0}), /size/);
  assert.equal(buildIndependentNgslSelection(fixture, {sourceRows: 3,selectedRows: 3}).candidates.length, 3);
});
