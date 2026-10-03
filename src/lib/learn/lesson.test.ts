import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GOALS, type Pilot, type PilotOrder } from "./content";
import { advanceLesson, answerLesson, buildApplication, buildCheckup, buildLesson, checkupCandidates, checkupResult, gradeTyped, lessonSize, nextTargets, resolveItem, seenPrompts } from "./lesson";
import { focusFirst, indexPilot, introducible, introductionOrder, pilotFace } from "./pilot";

const index = indexPilot(JSON.parse(readFileSync("public/data/enhanced.json", "utf8")) as Pilot);
let seed = 7;
const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const T0 = 1_800_000_000_000;

test("a lesson teaches, retrieves, uses in context and retrieves again after a delay", () => {
  const targets = introductionOrder(index.targets, "general").slice(0, 3);
  const lesson = buildLesson(index, targets, new Set(), T0, random);
  for (const target of targets) {
    const id = target.sense.id;
    const position = (kind: string, role?: string) =>
      lesson.steps.findIndex((step) => (step.kind === "teach" && kind === "teach" && step.target === id) || (step.kind === "check" && step.role === role && step.ref.target === id));
    const teach = position("teach");
    const retrieve = position("check", "retrieve");
    const context = position("check", "context");
    const delayed = position("check", "delayed");
    assert.ok(teach >= 0 && teach < retrieve && retrieve < context && context < delayed, id);
  }
  // Every item resolves to something the learner can answer.
  for (const step of lesson.steps) if (step.kind === "check") assert.ok(resolveItem(index, step.ref), JSON.stringify(step.ref));
  // The retrieval choice always contains the right meaning exactly once.
  const first = lesson.steps.find((step) => step.kind === "check" && step.role === "retrieve");
  assert.ok(first && first.kind === "check");
  const item = resolveItem(index, first.ref);
  assert.equal(item?.type === "choice" && item.options.filter((option) => option.ok).length, 1);
});

test("generated choices offer three other words' meanings, of the same part of speech when there are enough", () => {
  const targets = introductionOrder(index.targets, "general").slice(0, 5);
  const lesson = buildLesson(index, targets, new Set(), T0, random);
  const generated = lesson.steps.flatMap((step) => (step.kind === "check" && step.ref.from === "generated" ? [step.ref] : []));
  assert.ok(generated.length >= targets.length);
  for (const ref of generated) {
    const target = index.bySense.get(ref.target)!;
    const others = ref.options.filter((id) => id !== ref.target).map((id) => index.bySense.get(id)!);
    assert.equal(ref.options.length, 4);
    assert.equal(new Set(ref.options).size, 4);
    assert.ok(ref.options.includes(ref.target));
    for (const other of others) {
      assert.notEqual(other.entry.id, target.entry.id, "never another sense of the same word");
      assert.notEqual(other.sense.gloss, target.sense.gloss, "never the same meaning");
    }
    const samePos = index.targets.filter((item) => item.sense.pos === target.sense.pos && item.entry.id !== target.entry.id).length;
    if (samePos >= 10) assert.ok(others.every((other) => other.sense.pos === target.sense.pos), ref.target);
  }
});

test("a wrong retrieval earns one more, different opportunity, but only once", () => {
  const targets = introductionOrder(index.targets, "general").slice(0, 2);
  let lesson = buildLesson(index, targets, new Set(), T0, random);
  lesson = advanceLesson(lesson, T0);
  assert.equal(lesson.steps[lesson.index]?.kind, "check");
  const before = lesson.steps.length;
  lesson = answerLesson(lesson, { op: "a", result: "wrong", at: T0 }, index, random);
  assert.equal(lesson.steps.length, before + 1);
  const retries = lesson.steps.filter((step) => step.kind === "check" && step.role === "retry");
  assert.equal(retries.length, 1);
  // The same step cannot be answered twice.
  assert.equal(answerLesson(lesson, { op: "b", result: "wrong", at: T0 }, index, random), lesson);
});

test("typed answers accept listed alternatives and small slips", () => {
  assert.equal(gradeTyped("  bring ", "bring", []), "correct");
  assert.equal(gradeTyped("brinng", "bring", []), "close");
  assert.equal(gradeTyped("can not", "can't", ["cannot", "can not"]), "correct");
  assert.equal(gradeTyped("take", "bring", []), "wrong");
});

test("lesson size follows the learner's time and backs off when reviews pile up", () => {
  assert.equal(lessonSize(5, 0, 20), 2);
  assert.equal(lessonSize(10, 0, 20), 3);
  assert.equal(lessonSize(15, 0, 20), 5);
  assert.equal(lessonSize(15, 25, 20), 1);
  assert.equal(lessonSize(15, 45, 20), 0);
});

test("introduction order serves the goal and keeps further senses after first meetings", () => {
  const work = introductionOrder(index.targets, "work");
  const firstSecondSense = work.findIndex((target) => target.index > 0);
  assert.ok(work.slice(0, firstSecondSense).every((target) => target.index === 0));
  const known = Object.fromEntries(work.slice(0, 4).map((target) => [target.sense.id, {}]));
  assert.deepEqual(nextTargets(work, known, 2).map((target) => target.sense.id), work.slice(4, 6).map((target) => target.sense.id));
});

test("enhanced content at another level is taught first to learners at that level", () => {
  // The A1 content, plus one entry written for A2 (docs/CATALOGUE.md).
  const compiled = JSON.parse(readFileSync("public/data/enhanced.json", "utf8")) as Pilot;
  const source = compiled.entries.find((entry) => entry.id === "lex:A1:time")!;
  const a2 = {
    ...source,
    id: "lex:A2:ability",
    headword: "ability",
    order: compiled.entries.length,
    senses: source.senses.map((sense, position) => ({ ...sense, id: position === 0 ? "lex:A2:ability" : `lex:A2:ability#${sense.id.split("#")[1]}` })),
  };
  const both = indexPilot({ ...compiled, entries: [...compiled.entries, a2] });
  const ordered = introductionOrder(both.targets, "general");
  assert.equal(focusFirst(ordered, "A1")[0]!.sense.id, ordered[0]!.sense.id, "an A1 learner's order is unchanged");
  const forA2 = focusFirst(ordered, "A2");
  assert.deepEqual(forA2.slice(0, a2.senses.length).map((target) => target.entry.id), a2.senses.map(() => "lex:A2:ability"));
  assert.equal(forA2.length, ordered.length, "and the other levels' lessons follow");
  assert.equal(pilotFace(both.bySense.get("lex:A2:ability")!, {}, "en-GB").level, "A2");
  assert.equal(pilotFace(both.bySense.get("lex:A1:time")!, {}, "en-GB").level, "A1");
});

test("contrasts and scenes can be practised on their own", () => {
  const contrast = buildApplication(index, "contrast", "contrast:bring-take", T0);
  assert.equal(contrast?.steps[0]?.kind, "contrast");
  const scene = buildApplication(index, "scene", "scene:cafe-order", T0);
  assert.equal(scene?.steps.at(-1)?.kind, "write");
  for (const step of [...(contrast?.steps ?? []), ...(scene?.steps ?? [])]) {
    if (step.kind === "check") assert.ok(resolveItem(index, step.ref));
  }
});

test("the small introduction-order file matches the full pilot for every goal", () => {
  const compiled = JSON.parse(readFileSync("public/data/enhanced-order.json", "utf8")) as PilotOrder;
  assert.equal(compiled.version, index.pilot.version);
  for (const goal of GOALS) {
    assert.deepEqual(
      compiled.order[goal],
      introductionOrder(index.targets, goal).map((target) => target.sense.id),
      goal,
    );
  }
});

test("the released channel introduces only reviewed entries, but keeps every sense for existing cards", () => {
  const releasedId = index.pilot.entries[0]!.id;
  const pilot = { ...index.pilot, entries: index.pilot.entries.map((entry) => ({ ...entry, released: entry.id === releasedId })) };
  const full = indexPilot(pilot);
  const view = introducible(full, "released");
  assert.ok(view.targets.length > 0);
  assert.ok(view.targets.every((target) => target.entry.id === releasedId));
  assert.deepEqual([...view.byEntry.keys()], [releasedId]);
  assert.equal(view.bySense.size, full.bySense.size);
  assert.ok(view.pilot.contrasts.every((contrast) => contrast.entries.every((id) => view.bySense.get(id)?.entry.released)));
  assert.equal(introducible(full, "draft"), full);
});

test("the 30-day check-up uses unseen prompts, measures use and meaning, and offers each word once a month", () => {
  const DAY = 86_400_000;
  const targets = index.targets.slice(0, 4);
  const history = targets.map((target, position) => ({ id: target.sense.id, at: T0 - (31 + position) * DAY }));
  // Too recent to check up.
  history.push({ id: index.targets[10]!.sense.id, at: T0 - 5 * DAY });
  const lesson = buildLesson(index, targets, new Set(), T0 - 40 * DAY, random);
  // Every prompt shown in the lesson counts as seen.
  const answered = { ...lesson, answers: lesson.steps.map((_, step) => ({ op: `o${step}`, step, result: "correct" as const, at: T0 })) };
  const seen = seenPrompts([answered]);

  const ids = index.targets.map((target) => target.sense.id);
  const candidates = checkupCandidates(ids, history, [answered], T0);
  assert.deepEqual(candidates.map((item) => item.id).sort(), targets.map((target) => target.sense.id).sort());
  assert.equal(candidates[0]!.delayDays, 34, "oldest first, with days since first met");

  const checkup = buildCheckup(index, candidates, seen, T0, random);
  assert.equal(checkup.mode, "checkup");
  const use = checkup.steps.filter((step) => step.kind === "check" && step.role === "checkup-use");
  const meaning = checkup.steps.filter((step) => step.kind === "check" && step.role === "checkup-meaning");
  assert.equal(use.length, targets.length);
  assert.equal(meaning.length, targets.length);
  assert.ok(checkup.steps.indexOf(use.at(-1)!) < checkup.steps.indexOf(meaning[0]!), "use comes before the meaning can cue it");
  for (const step of use) {
    if (step.kind === "check" && step.ref.from === "sense") assert.ok(!seen.has(`${step.ref.target}/${step.ref.item}`), "a fresh sentence");
  }

  // One word recalled but not used, the rest both.
  let session = checkup;
  for (const step of checkup.steps) {
    const wrong = step.kind === "check" && step.role === "checkup-use" && step.ref.target === targets[0]!.sense.id;
    session = advanceLesson(answerLesson(session, { op: newIdFor(session), result: wrong ? "wrong" : "correct", at: T0 }, index), T0);
  }
  assert.equal(session.steps.length, checkup.steps.length, "a check-up never adds retries");
  assert.deepEqual(checkupResult(session), { checked: 4, usable: 3, meaning: 4, use: 3 });
  assert.equal(checkupCandidates(ids, history, [answered, session], T0 + DAY).length, 0, "not checked again within 30 days");
});

function newIdFor(session: { answers: unknown[] }) {
  return `answer-${session.answers.length}`;
}
