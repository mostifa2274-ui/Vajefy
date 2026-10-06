import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalizeSemanticJudgeContent,
  parseSemanticJudgeJson,
} from "./semantic-judge-json";

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


test("canonicalizes one criteria object surrounded by transport prose", () => {
  assert.equal(
    canonicalizeSemanticJudgeContent(
      'final answer: {"criteria":[{"criterion":"grammar"}]} done',
    ),
    '{"criteria":[{"criterion":"grammar"}]}',
  );
});

test("collapses duplicate identical criteria payloads", () => {
  const payload = '{"criteria":[{"criterion":"grammar"}]}';
  assert.equal(
    canonicalizeSemanticJudgeContent(`${payload}\n${payload}`),
    payload,
  );
});

test("rejects conflicting criteria payloads", () => {
  assert.equal(
    canonicalizeSemanticJudgeContent(
      '{"criteria":[{"criterion":"grammar"}]}\n{"criteria":[{"criterion":"naturalness"}]}',
    ),
    null,
  );
});

test("ignores unrelated JSON when exactly one criteria payload exists", () => {
  assert.equal(
    canonicalizeSemanticJudgeContent(
      '{"meta":{"id":1}}\n{"criteria":[{"criterion":"grammar"}]}',
    ),
    '{"criteria":[{"criterion":"grammar"}]}',
  );
});

test("does not canonicalize JSON without criteria", () => {
  assert.equal(canonicalizeSemanticJudgeContent('{"status":"PASS"}'), null);
});
