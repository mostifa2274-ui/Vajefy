import assert from "node:assert/strict";
import test from "node:test";
import { inLearningScope } from "./course-scope";
import { LEVEL_PLACEMENT } from "./level-placement";
import { levelOf } from "./text";

test("without a placement, an entry and its senses keep the level in their ID", () => {
  assert.equal(levelOf("lex:A1:film"), "A1");
  assert.equal(levelOf("lex:A2:pet#verb"), "A2");
  assert.equal(levelOf("phr:look-after"), null);
  assert.equal(inLearningScope("lex:A1:film", "A1"), true);
  assert.equal(inLearningScope("lex:A2:pet", "A1"), false);
  assert.equal(inLearningScope("lex:A2:pet", "A2"), true);
});

test("a placed entry and its senses are taught at their placement, not their ID prefix", () => {
  const placement = { "lex:A1:film": "A2", "lex:A2:pet": "A1" } as const;
  assert.equal(levelOf("lex:A1:film", placement), "A2");
  assert.equal(levelOf("lex:A2:pet", placement), "A1");
  assert.equal(levelOf("lex:A2:pet#verb", placement), "A1");
  assert.equal(levelOf("lex:A1:house", placement), "A1");
});

test("every placement names a lex entry whose level differs from its ID", () => {
  for (const [id, level] of Object.entries(LEVEL_PLACEMENT)) {
    assert.match(id, /^lex:[A-Za-z0-9]+:[a-z0-9-]+$/);
    assert.notEqual(levelOf(id, {}), level, `${id} is already ${level} by its ID`);
  }
});
