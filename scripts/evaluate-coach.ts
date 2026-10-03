import fs from "node:fs";
import path from "node:path";
import type { Pilot } from "../src/lib/learn/content.ts";
import { anthropicBody, coachPrompt, indexContent, readReply, type CoachReply } from "../src/api/coach-core.ts";

/**
 * The AI coach's release gate (docs/COACH.md): the exact prompt and output
 * contract the Worker uses, on the fixed evaluation set.
 *
 *   ANTHROPIC_API_KEY=… npm run coach:eval -- [--model claude-sonnet-5-5] [--split test] [--limit 40] [--lang fa]
 *   npm run coach:eval -- --dry-run
 *
 * Gate: on the balanced held-out split, at least 95% of verdicts agree with the
 * expected ones, and every answer is well formed. Context-dependent cases may
 * be answered "natural" or "unsure".
 */

type Case = { id: string; split: string; source: string; senses: string[]; text: string; expect: CoachReply["verdict"][] };

const args = process.argv.slice(2);
const option = (flag: string) => {
  const at = args.indexOf(flag);
  return at >= 0 ? args[at + 1] : undefined;
};
const ROOT = process.cwd();
const model = option("--model") ?? "claude-sonnet-5-5";
const split = option("--split") ?? "test";
const lang = (option("--lang") ?? "fa") as "fa" | "en";
const limit = Number(option("--limit") ?? Infinity);
const dryRun = args.includes("--dry-run");

const set = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "coach-eval", "cases.json"), "utf8")) as { status: string; cases: Case[] };
const content = indexContent(JSON.parse(fs.readFileSync(path.join(ROOT, "public", "data", "pilot-a1.json"), "utf8")) as Pilot);

// Balance the split: as many natural as need-a-change cases, plus every context-dependent one.
const pool = set.cases.filter((item) => item.split === split);
const natural = pool.filter((item) => item.expect.length === 1 && item.expect[0] === "natural");
const wrong = pool.filter((item) => item.expect[0] === "needs-change");
const context = pool.filter((item) => item.expect.length > 1);
const half = Math.min(natural.length, wrong.length, Number.isFinite(limit) ? Math.floor(limit / 2) : Infinity);
const cases = [...natural.slice(0, half), ...wrong.slice(0, half), ...context];

console.log(`Coach evaluation: ${cases.length} ${split} cases (${half} natural, ${half} need a change, ${context.length} context-dependent); model ${model}; explanations in ${lang}.`);
if (set.status !== "reviewed") console.log("Note: the case set is a draft until bilingual review confirms its expected verdicts; a pass on it is provisional.");

if (dryRun) {
  const sample = cases[0]!;
  console.log("\nSample prompt:\n");
  console.log(coachPrompt({ task: "sentence", senses: sample.senses, text: sample.text, lang }, content, { withhold: sample.text }));
  process.exit(0);
}
const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.error("Set ANTHROPIC_API_KEY, or use --dry-run.");
  process.exit(1);
}

type Outcome = { item: Case; reply: CoachReply | null; ms: number; input: number; output: number };
async function run(item: Case): Promise<Outcome> {
  // The case's own sentence is withheld from the reference (leave-one-out).
  const prompt = coachPrompt({ task: "sentence", senses: item.senses, text: item.text, lang }, content, { withhold: item.text })!;
  const started = Date.now();
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(anthropicBody(model, prompt)),
    });
    if (response.status === 429 || response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
      continue;
    }
    const body = (await response.json()) as { usage?: { input_tokens?: number; output_tokens?: number } };
    return { item, reply: response.ok ? readReply(body) : null, ms: Date.now() - started, input: body.usage?.input_tokens ?? 0, output: body.usage?.output_tokens ?? 0 };
  }
  return { item, reply: null, ms: Date.now() - started, input: 0, output: 0 };
}

const outcomes: Outcome[] = [];
for (let start = 0; start < cases.length; start += 4) {
  outcomes.push(...(await Promise.all(cases.slice(start, start + 4).map(run))));
  process.stdout.write(`\r${outcomes.length}/${cases.length}`);
}
process.stdout.write("\n");

const agree = outcomes.filter((outcome) => outcome.reply && outcome.item.expect.includes(outcome.reply.verdict));
const invalid = outcomes.filter((outcome) => !outcome.reply);
const persian = outcomes.filter((outcome) => outcome.reply && /[؀-ۿ]/.test(outcome.reply.explanation));
const matrix = new Map<string, number>();
for (const outcome of outcomes) {
  const cell = `${outcome.item.expect.join("|")} → ${outcome.reply?.verdict ?? "invalid"}`;
  matrix.set(cell, (matrix.get(cell) ?? 0) + 1);
}
const rate = agree.length / Math.max(1, outcomes.length);
const latency = outcomes.map((outcome) => outcome.ms).sort((a, b) => a - b);
console.log(`\nAgreement: ${agree.length}/${outcomes.length} (${(rate * 100).toFixed(1)}%)`);
console.log(`Malformed answers: ${invalid.length}`);
if (lang === "fa") console.log(`Explanations in Persian: ${persian.length}/${outcomes.length - invalid.length}`);
console.log(`Latency: median ${latency[Math.floor(latency.length / 2)]} ms, 95th percentile ${latency[Math.floor(latency.length * 0.95)]} ms`);
console.log(`Tokens: ${outcomes.reduce((sum, item) => sum + item.input, 0)} in, ${outcomes.reduce((sum, item) => sum + item.output, 0)} out`);
console.log("\nExpected → answered:");
for (const [cell, count] of [...matrix].sort()) console.log(`  ${cell}: ${count}`);
const misses = outcomes.filter((outcome) => !agree.includes(outcome)).slice(0, 15);
if (misses.length) {
  console.log("\nDisagreements (first 15):");
  for (const miss of misses) console.log(`  [${miss.item.source}] "${miss.item.text}" expected ${miss.item.expect.join("/")}, got ${miss.reply?.verdict ?? "invalid"}${miss.reply?.issue ? ` (${miss.reply.issue})` : ""}`);
}
const pass = split === "test" && rate >= 0.95 && invalid.length === 0;
console.log(`\nGate (held-out split, ≥95% agreement, no malformed answers): ${pass ? "PASS" : "FAIL"}`);
process.exit(pass ? 0 : 1);
