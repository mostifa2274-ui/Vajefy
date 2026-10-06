import assert from "node:assert/strict";
import test from "node:test";
import { estimateSemanticRoleBudget } from "./semantic-budget";

test("semantic budget uses per-request ceiling and all repeats", () => {
  const result = estimateSemanticRoleBudget(
    [
      { inputTokensUpperBound: 1000 },
      { inputTokensUpperBound: 2000 },
    ],
    3,
    500,
    {
      inputNeuronsPerMillionTokens: 10_000,
      outputNeuronsPerMillionTokens: 20_000,
    },
  );

  // request 1: ceil(10 + 10) = 20; request 2: ceil(20 + 10) = 30.
  assert.equal(result.neuronsUpperBound, 150);
  assert.equal(result.requestsPerRun, 2);
  assert.equal(result.inputTokensUpperBoundTotal, 9000);
  assert.equal(result.outputTokensUpperBoundTotal, 3000);
});

test("semantic budget rejects invalid bounds", () => {
  assert.throws(
    () =>
      estimateSemanticRoleBudget(
        [{ inputTokensUpperBound: 0 }],
        3,
        500,
        {
          inputNeuronsPerMillionTokens: 1,
          outputNeuronsPerMillionTokens: 1,
        },
      ),
    /inputTokensUpperBound/,
  );
});
