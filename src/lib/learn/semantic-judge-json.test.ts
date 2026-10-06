import assert from "node:assert/strict";
import test from "node:test";
import { parseSemanticJudgeJson } from "./semantic-judge-json";

test("parses direct JSON", () => {
  assert.deepEqual(parseSemanticJudgeJson('{"criteria":[]}'), { criteria: [] });
});

test("parses a single JSON markdown fence", () => {
  assert.deepEqual(
    parseSemanticJudgeJson('```json\n{"criteria":[]}\n```'),
    { criteria: [] },
  );
});

test("rejects prose around JSON", () => {
  assert.throws(
    () => parseSemanticJudgeJson('Here is the result: {"criteria":[]}'),
    /single JSON value/,
  );
});

test("rejects multiple fenced payloads", () => {
  assert.throws(
    () =>
      parseSemanticJudgeJson(
        '```json\n{"a":1}\n```\n```json\n{"b":2}\n```',
      ),
  );
});
