import assert from "node:assert/strict";
import test from "node:test";
import { extractWorkersAiContent } from "./semantic-gateway";

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
