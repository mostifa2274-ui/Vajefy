import assert from "node:assert/strict";
import test from "node:test";
import {
  extractWorkersAiContent,
  semanticResponseFormat,
} from "./semantic-gateway";

test("extracts Cloudflare Responses API output_text content", () => {
  const result = {
    id: "resp_1",
    object: "response",
    status: "completed",
    output: [
      { type: "reasoning", summary: [] },
      {
        type: "message",
        status: "completed",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text: '{"targetId":"cal-en-clean-i","status":"PASS"}',
          },
        ],
      },
    ],
  };

  assert.equal(
    extractWorkersAiContent(result),
    '{"targetId":"cal-en-clean-i","status":"PASS"}',
  );
});

test("extracts top-level Responses API output_text", () => {
  assert.equal(
    extractWorkersAiContent({ output_text: '{"status":"PASS"}' }),
    '{"status":"PASS"}',
  );
});

test("preserves legacy Workers AI response strings", () => {
  assert.equal(
    extractWorkersAiContent({ response: '{"status":"PASS"}' }),
    '{"status":"PASS"}',
  );
});

test("preserves Chat Completions message content", () => {
  assert.equal(
    extractWorkersAiContent({
      choices: [{ message: { content: '{"status":"PASS"}' } }],
    }),
    '{"status":"PASS"}',
  );
});

test("does not mistake reasoning-only output for final answer", () => {
  assert.equal(
    extractWorkersAiContent({
      status: "incomplete",
      output: [{ type: "reasoning", summary: [] }],
      incomplete_details: { reason: "max_output_tokens" },
    }),
    null,
  );
});


test("extracts Cloudflare JSON mode wrapped response object", () => {
  assert.equal(
    extractWorkersAiContent({
      response: {
        criteria: [
          {
            criterion: "grammar",
            result: "PASS",
            confidence: 0.9,
            evidence: ["sense.examples.0.en"],
            reasonCode: null,
          },
        ],
      },
    }),
    '{"criteria":[{"criterion":"grammar","result":"PASS","confidence":0.9,"evidence":["sense.examples.0.en"],"reasonCode":null}]}',
  );
});

test("extracts direct structured judge object", () => {
  assert.equal(
    extractWorkersAiContent({
      criteria: [
        {
          criterion: "grammar",
          result: "PASS",
          confidence: 1,
          evidence: ["sense"],
          reasonCode: null,
        },
      ],
    }),
    '{"criteria":[{"criterion":"grammar","result":"PASS","confidence":1,"evidence":["sense"],"reasonCode":null}]}',
  );
});

test("semantic response format binds criteria and exact array size", () => {
  const format = semanticResponseFormat({
    requiredCriteria: ["grammar", "naturalness"],
  });
  assert.equal(format.type, "json_schema");
  const schema = format.json_schema;
  const criteria = (
    schema.properties as {
      criteria: {
        minItems: number;
        maxItems: number;
        items: {
          properties: {
            criterion: { enum: string[] };
            result: { enum: string[] };
          };
        };
      };
    }
  ).criteria;
  assert.equal(criteria.minItems, 2);
  assert.equal(criteria.maxItems, 2);
  assert.deepEqual(criteria.items.properties.criterion.enum, [
    "grammar",
    "naturalness",
  ]);
  assert.deepEqual(criteria.items.properties.result.enum, [
    "PASS",
    "FAIL",
    "UNCERTAIN",
  ]);
});

test("semantic response format rejects missing or duplicate criteria", () => {
  assert.throws(
    () => semanticResponseFormat({ requiredCriteria: [] }),
    /invalid-required-criteria/,
  );
  assert.throws(
    () =>
      semanticResponseFormat({
        requiredCriteria: ["grammar", "grammar"],
      }),
    /invalid-required-criteria/,
  );
});
