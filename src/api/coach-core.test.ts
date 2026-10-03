import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Pilot } from "../lib/learn/content";
import { anthropicBody, coachPrompt, coachRequest, COACH_TOOL, indexContent, readReply } from "./coach-core";

const content = indexContent(JSON.parse(readFileSync("public/data/pilot-a1.json", "utf8")) as Pilot);

test("a coach question is grounded in the word's own teaching content", () => {
  const request = coachRequest.parse({ task: "sentence", senses: ["lex:A1:bring"], text: "Can you bring me the book?", lang: "fa" });
  const prompt = coachPrompt(request, content)!;
  const { sense } = content.senses.get("lex:A1:bring")!;
  assert.ok(prompt.includes("lang: fa"));
  assert.ok(prompt.includes(sense.mistake.wrong), "the common mistake");
  assert.ok(prompt.includes(sense.examples[0]!.en), "an example");
  assert.ok(prompt.includes("SENTENCE: Can you bring me the book?"));
  assert.equal(coachPrompt({ ...request, senses: ["lex:A1:nonexistent"] }, content), null);
  const difference = coachPrompt(coachRequest.parse({ task: "difference", senses: ["lex:A1:bring", "lex:A1:take"], contrast: "contrast:bring-take", lang: "en" }), content)!;
  assert.ok(difference.includes("CONTRAST: bring / take"));
});

test("requests are bounded and validated", () => {
  assert.equal(coachRequest.safeParse({ task: "sentence", senses: ["lex:A1:bring"], text: "x".repeat(301), lang: "fa" }).success, false);
  assert.equal(coachRequest.safeParse({ task: "sentence", senses: ["javascript:alert(1)"], text: "hi", lang: "fa" }).success, false);
  assert.equal(coachRequest.safeParse({ task: "sentence", senses: [], text: "hi", lang: "fa" }).success, false);
});

test("only a well-formed tool answer is shown, and low confidence is shown as uncertainty", () => {
  const input = { verdict: "needs-change", issue: "word order", explanation: "توضیح", corrected: "Bring it to me.", next: "دوباره", confidence: "high" };
  const body = (value: unknown) => ({ content: [{ type: "text", text: "…" }, { type: "tool_use", name: COACH_TOOL.name, input: value }] });
  assert.deepEqual(readReply(body(input)), input);
  assert.equal(readReply(body({ ...input, confidence: "low" }))!.verdict, "unsure");
  assert.equal(readReply(body({ ...input, verdict: "great" })), null);
  assert.equal(readReply({ content: [{ type: "text", text: "Sure!" }] }), null);
  const request = anthropicBody("model", "prompt");
  assert.deepEqual(request.tool_choice, { type: "tool", name: COACH_TOOL.name });
  assert.equal(request.temperature, 0);
});

test("the evaluation withholds the sentence under test from the reference", () => {
  const { sense } = content.senses.get("lex:A1:bring")!;
  const request = coachRequest.parse({ task: "sentence", senses: ["lex:A1:bring"], text: sense.mistake.wrong, lang: "fa" });
  const reference = (prompt: string) => prompt.split("QUESTION")[0]!;
  assert.ok(reference(coachPrompt(request, content)!).includes(sense.mistake.wrong));
  assert.ok(!reference(coachPrompt(request, content, { withhold: sense.mistake.wrong })!).includes(sense.mistake.wrong));
});
