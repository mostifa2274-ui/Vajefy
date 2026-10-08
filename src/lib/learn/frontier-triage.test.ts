import assert from "node:assert/strict";
import test from "node:test";
import type { CheckItem } from "./content";
import { buildFrontierTriage, type FrontierTriageFinding } from "./frontier-triage";

const cloze: CheckItem = {
  type: "cloze",
  id: "c1",
  text: "The fridge is ___.",
  answer: "cold",
  accept: [],
  fa: "یخچال سرد است.",
  why: "صفت cold",
};
const choice: CheckItem = {
  type: "choice",
  id: "q1",
  prompt: "کدام گزینه درست است؟",
  options: [
    { text: "heavy book", ok: true, why: "درست است." },
    { text: "small table", ok: false, why: "نادرست است." },
  ],
};

const checks = new Map<string, readonly CheckItem[]>([
  ["lex:A1:early", [cloze]],
  ["lex:A1:late", [cloze, choice]],
  ["scene:test", [{ ...cloze, text: "This is wet." }]],
]);
const units = [
  { id: "01-first", entryIds: ["lex:A1:early"] },
  { id: "02-second", entryIds: ["second"] },
  { id: "03-third", entryIds: ["third"] },
  { id: "04-fourth", entryIds: ["lex:A1:late"] },
];
const finding = (where: string, token: string, entry: string, dependencyId?: string): FrontierTriageFinding => ({
  code: "FRONTIER_TASK_VOCABULARY",
  where,
  frontier: {
    token,
    frontier: 2,
    frontierEntryId: entry,
    ...(dependencyId ? { dependencyId } : {}),
  },
});

test("triage preserves the frozen pilot boundary and accounts for every support finding", () => {
  const report = buildFrontierTriage([
    finding("lex:A1:early.check[0]", "fridge", "lex:A1:early"),
    finding("lex:A1:late.check[0]", "fridge", "lex:A1:late"),
    finding("lex:A1:late.check[1]", "heavy", "lex:A1:late"),
    { ...finding("scene:test.check[0]", "wet", "lex:A1:late"), code: "FRONTIER_SCENE_VOCABULARY" },
    finding("lex:A1:late.check[0]", "later", "lex:A1:late", "lex:A1:later"),
  ], checks, units);

  assert.equal(report.total, 4);
  assert.equal(report.frozenPilot, 1);
  assert.equal(report.glossCandidates, 2);
  assert.equal(report.needsReview, 1);
  assert.equal(report.tokens.find(t => t.token === "fridge")?.occurrences, 2);
  assert.equal(report.tokens.find(t => t.token === "heavy")?.cases[0]?.classification, "requires-reword-or-review");
  assert.equal(report.tokens.find(t => t.token === "wet")?.cases[0]?.classification, "gloss-candidate");
  assert.equal(report.tokens.find(t => t.token === "later"), undefined);
});

test("triage never proposes a gloss that leaks the missing answer or lacks visible text", () => {
  const report = buildFrontierTriage([
    finding("lex:A1:late.check[0]", "cold", "lex:A1:late"),
    finding("lex:A1:late.check[0]", "unknown", "lex:A1:late"),
  ], checks, units);
  assert.equal(report.glossCandidates, 0);
  assert.equal(report.needsReview, 2);
  assert.ok(report.tokens.every(t => t.cases.every(c => c.reasons.length > 0)));
});

test("triage fails closed on missing task or curriculum metadata", () => {
  assert.throws(
    () => buildFrontierTriage([finding("lex:A1:late.check[25]", "fridge", "lex:A1:late")], checks, units),
    /task not found/,
  );
  assert.throws(
    () => buildFrontierTriage([finding("lex:A1:late.check[0]", "fridge", "missing")], checks, units),
    /anchor missing/,
  );
});
