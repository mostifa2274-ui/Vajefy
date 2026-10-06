import assert from "node:assert/strict";
import test from "node:test";
import {
  extractWorkersAiContent,
  semanticResponseFormat,
  workersAiDiagnostic,
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
            text: '{"criteria":[{"criterion":"grammar","result":"PASS","confidence":1,"evidence":["sense"],"reasonCode":null}]}',
          },
        ],
      },
    ],
  };

  assert.equal(
    extractWorkersAiContent(result),
    '{"criteria":[{"criterion":"grammar","result":"PASS","confidence":1,"evidence":["sense"],"reasonCode":null}]}',
  );
});

test("extracts top-level Responses API output_text", () => {
  assert.equal(
    extractWorkersAiContent({ output_text: '{"criteria":[{"criterion":"grammar","result":"PASS","confidence":1,"evidence":["sense"],"reasonCode":null}]}' }),
    '{"criteria":[{"criterion":"grammar","result":"PASS","confidence":1,"evidence":["sense"],"reasonCode":null}]}',
  );
});

test("preserves legacy Workers AI response strings", () => {
  assert.equal(
    extractWorkersAiContent({ response: '{"criteria":[{"criterion":"grammar","result":"PASS","confidence":1,"evidence":["sense"],"reasonCode":null}]}' }),
    '{"criteria":[{"criterion":"grammar","result":"PASS","confidence":1,"evidence":["sense"],"reasonCode":null}]}',
  );
});

test("preserves Chat Completions message content", () => {
  assert.equal(
    extractWorkersAiContent({
      choices: [{ message: { content: '{"criteria":[{"criterion":"grammar","result":"PASS","confidence":1,"evidence":["sense"],"reasonCode":null}]}' } }],
    }),
    '{"criteria":[{"criterion":"grammar","result":"PASS","confidence":1,"evidence":["sense"],"reasonCode":null}]}',
  );
});


test("rejects non-semantic JSON without criteria", () => {
  assert.equal(
    extractWorkersAiContent({ output_text: '{"status":"PASS"}' }),
    null,
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


test("prefers structured response object over duplicate Responses API text", () => {
  const structured = {
    criteria: [
      {
        criterion: "grammar",
        result: "PASS",
        confidence: 0.95,
        evidence: ["sense.examples.0.en"],
        reasonCode: null,
      },
    ],
  };

  assert.equal(
    extractWorkersAiContent({
      response: structured,
      output_text: JSON.stringify(structured),
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify(structured),
            },
          ],
        },
      ],
    }),
    JSON.stringify(structured),
  );
});

test("prefers structured response string over alternate output fields", () => {
  const structured =
    '{"criteria":[{"criterion":"grammar","result":"PASS","confidence":0.95,"evidence":["sense"],"reasonCode":null}]}';

  assert.equal(
    extractWorkersAiContent({
      response: structured,
      output_text: "non-json transport noise",
    }),
    structured,
  );
});


test("collapses identical structured payloads across final response fields", () => {
  const payload = {
    criteria: [
      {
        criterion: "grammar",
        result: "PASS",
        confidence: 0.95,
        evidence: ["sense.examples.0.en"],
        reasonCode: null,
      },
    ],
  };
  const json = JSON.stringify(payload);

  assert.equal(
    extractWorkersAiContent({
      response: payload,
      output_text: json,
      output: [
        {
          type: "reasoning",
          summary: [{ type: "summary_text", text: "not final evidence" }],
        },
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: json }],
        },
      ],
    }),
    json,
  );
});

test("canonicalizes one final JSON payload even when model adds prose", () => {
  const payload =
    '{"criteria":[{"criterion":"grammar","result":"PASS","confidence":0.9,"evidence":["sense"],"reasonCode":null}]}';

  assert.equal(
    extractWorkersAiContent({
      output: [
        {
          type: "message",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: `Here is the requested JSON:\n${payload}\nDone.`,
            },
          ],
        },
      ],
    }),
    payload,
  );
});

test("rejects conflicting final semantic payloads", () => {
  assert.equal(
    extractWorkersAiContent({
      output_text:
        '{"criteria":[{"criterion":"grammar","result":"PASS","confidence":0.9,"evidence":["sense"],"reasonCode":null}]}',
      output: [
        {
          type: "message",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text:
                '{"criteria":[{"criterion":"grammar","result":"FAIL","confidence":0.9,"evidence":["sense"],"reasonCode":"fixture"}]}',
            },
          ],
        },
      ],
    }),
    null,
  );
});

test("ignores reasoning text when final assistant message contains semantic JSON", () => {
  const payload =
    '{"criteria":[{"criterion":"grammar","result":"PASS","confidence":1,"evidence":["sense"],"reasonCode":null}]}';

  assert.equal(
    extractWorkersAiContent({
      output: [
        {
          type: "reasoning",
          summary: [
            {
              type: "summary_text",
              text: '{"criteria":[{"criterion":"grammar","result":"FAIL"}]}',
            },
          ],
        },
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: payload }],
        },
      ],
    }),
    payload,
  );
});


test("Workers AI diagnostic exposes structure but never response text", () => {
  const secretText =
    '{"criteria":[{"criterion":"grammar","result":"PASS"}],"secret":"DO_NOT_LOG"}';
  const diagnostic = workersAiDiagnostic({
    status: "incomplete",
    incomplete_details: { reason: "max_output_tokens" },
    output_text: secretText,
    output: [
      {
        type: "message",
        role: "assistant",
        status: "incomplete",
        content: [{ type: "output_text", text: secretText }],
      },
    ],
    usage: { input_tokens: 100, output_tokens: 900 },
  });

  const serialized = JSON.stringify(diagnostic);
  assert.equal(serialized.includes("DO_NOT_LOG"), false);
  assert.equal(serialized.includes(secretText), false);
  assert.equal(diagnostic.status, "incomplete");
  assert.deepEqual(diagnostic.incompleteDetails, {
    reason: "max_output_tokens",
  });
  assert.equal(
    (diagnostic.outputTextShape as { type?: string; length?: number }).type,
    "string",
  );
  assert.equal(
    (diagnostic.outputTextShape as { type?: string; length?: number }).length,
    secretText.length,
  );
});
