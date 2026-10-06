import assert from "node:assert/strict";
import test from "node:test";
import { parseSemanticJudgeJson } from "./semantic-judge-json";

test("parses direct JSON", () => {
  assert.deepEqual(parseSemanticJudgeJson('{"criteria":[]}'), { criteria: [] });
});

test("parses a single JSON markdown fence", () => {
  assert.deepEqual(
    parseSemanticJudgeJson("```json\n{\"criteria\":[]}\n```"),
    { criteria: [] },
  );
});

test("extracts exactly one JSON object from surrounding model prose", () => {
  assert.deepEqual(
    parseSemanticJudgeJson(
      'Analysis complete. Final answer follows.\n{"criteria":[{"criterion":"grammar","result":"PASS"}]}\nEnd.',
    ),
    { criteria: [{ criterion: "grammar", result: "PASS" }] },
  );
});

test("ignores non-JSON brace fragments around one valid JSON object", () => {
  assert.deepEqual(
    parseSemanticJudgeJson('Reasoning used {not-json}.\n{"criteria":[]}\nDone.'),
    { criteria: [] },
  );
});

test("handles braces inside JSON strings", () => {
  assert.deepEqual(
    parseSemanticJudgeJson(
      'prefix {"criteria":[],"note":"literal { brace } inside string"} suffix',
    ),
    { criteria: [], note: "literal { brace } inside string" },
  );
});

test("rejects multiple valid JSON objects", () => {
  assert.throws(
    () => parseSemanticJudgeJson('first {"criteria":[]} second {"criteria":[]}'),
    /exactly one valid JSON object/,
  );
});

test("rejects content with no valid JSON object", () => {
  assert.throws(
    () => parseSemanticJudgeJson("analysis only, no structured payload"),
    /exactly one valid JSON object/,
  );
});
