import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GOALS, type Pilot, type PilotOrder } from "./content";
import { advanceLesson, answerLesson, buildApplication, buildCheckup, buildLesson, checkupCandidates, checkupResult, gradeTyped, heldOutItem, lessonReadiness, lessonSize, lessonStats, nextTargets, resolveItem, seenPrompts, shapeOf, skillOf, writtenForms } from "./lesson";
import { focusFirst, indexPilot, introducible, introductionOrder, pilotFace, unitOf } from "./pilot";
import { orderForGoal } from "./targets";

const pilot = JSON.parse(readFileSync("content/compiled/enhanced.json", "utf8")) as Pilot;
const index = indexPilot(pilot);
let seed = 7;
const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const T0 = 1_800_000_000_000;

test("a lesson teaches, asks for the written word, plays it, uses it in context and retrieves it again after a delay", () => {
  const targets = introductionOrder(index.targets, "general").slice(0, 3);
  const lesson = buildLesson(index, targets, new Set(), T0, random);
  for (const target of targets) {
    const id = target.sense.id;
    const position = (kind: string, role?: string) =>
      lesson.steps.findIndex((step) => (step.kind === "teach" && kind === "teach" && step.target === id) || (step.kind === "check" && step.role === role && step.ref.target === id));
    const teach = position("teach");
    const retrieve = position("check", "retrieve");
    const listen = position("check", "listen");
    const context = position("check", "context");
    const delayed = position("check", "delayed");
    assert.ok(teach >= 0 && teach < retrieve && retrieve < listen && listen < context && context < delayed, id);
    // Written retrieval: type the English word from its Persian meaning.
    const recall = lesson.steps[retrieve]!;
    assert.ok(recall.kind === "check" && recall.ref.from === "generated" && recall.ref.mode === "recall");
    const item = resolveItem(index, recall.ref);
    assert.equal(item?.type, "recall");
    assert.equal(item?.type === "recall" && item.prompt, target.sense.gloss);
    assert.equal(skillOf(recall.ref, item!), "spelling");
    // Listening: the recorded word without its spelling, choosing its meaning.
    const heard = lesson.steps[listen]!;
    assert.ok(heard.kind === "check" && heard.ref.from === "generated" && heard.ref.mode === "listen");
    const listening = resolveItem(index, heard.ref);
    assert.equal(listening?.type, "listen");
    assert.equal(listening?.type === "listen" && listening.options.filter((option) => option.ok).length, 1);
    assert.equal(skillOf(heard.ref, listening!), "listening");
  }
  // Every item resolves to something the learner can answer.
  for (const step of lesson.steps) if (step.kind === "check") assert.ok(resolveItem(index, step.ref), JSON.stringify(step.ref));
  // The final authored check for each sense is reserved for delayed assessment.
  for (const target of targets) {
    const reserved = heldOutItem(index.content.get(target.sense.id)?.sense);
    if (!reserved) continue;
    assert.ok(
      !lesson.steps.some((step) => step.kind === "check" && step.ref.from === "sense" && step.ref.target === target.sense.id && step.ref.item === reserved.id),
      `held-out prompt leaked into teaching: ${target.sense.id}/${reserved.id}`,
    );
  }
});

test("written retrieval accepts each written form of a headword and shows its shape", () => {
  assert.deepEqual(writtenForms("a, an"), ["a", "an"]);
  assert.deepEqual(writtenForms("have to"), ["have to"]);
  assert.equal(shapeOf("book"), "b _ _ _");
  assert.equal(shapeOf("have to"), "h _ _ _   _ _");
  // Short words show only gaps, so the cue never is the answer.
  assert.equal(shapeOf("I"), "_");
  assert.equal(shapeOf("an"), "_ _");
  const article = index.bySense.get("lex:A1:a-an")!;
  const item = resolveItem(index, { from: "generated", target: article.sense.id, mode: "recall", options: [] });
  assert.ok(item?.type === "recall");
  assert.equal(gradeTyped("an", item.answer, item.accept), "correct");
  assert.equal(gradeTyped("a", item.answer, item.accept), "correct");
});

test("a word without a recording gets no listening question", () => {
  const targets = introductionOrder(index.targets, "general").slice(0, 2);
  const silent = { ...index, audio: {} };
  const lesson = buildLesson(silent, targets, new Set(), T0, random);
  assert.ok(!lesson.steps.some((step) => step.kind === "check" && step.role === "listen"));
  assert.ok(lesson.steps.some((step) => step.kind === "check" && step.role === "retrieve"));
});

test("readiness counts unaided answers; a prompted retry stays helped until an unaided success", () => {
  const targets = introductionOrder(index.targets, "general").slice(0, 2);
  let lesson = buildLesson(index, targets, new Set(), T0, random);
  const [first, second] = targets.map((target) => target.sense.id) as [string, string];
  // Answer every check: the first word wrong at its written retrieval, everything else right.
  let guard = 0;
  while (lesson.index < lesson.steps.length && guard++ < 100) {
    const step = lesson.steps[lesson.index]!;
    if (step.kind === "check") {
      const wrong = step.role === "retrieve" && step.ref.target === first;
      const skipped = step.role === "listen" && step.ref.target === second;
      lesson = answerLesson(lesson, { op: `op${lesson.index}`, result: wrong ? "wrong" : skipped ? "skipped" : "correct", at: T0 }, index, random);
    }
    lesson = advanceLesson(lesson, T0);
  }
  // The first word's later unaided checks succeeded, so the help no longer counts.
  assert.deepEqual(lessonReadiness(lesson), { [first]: "ready", [second]: "ready" });
  // A skipped listening question is neither credit nor a miss.
  assert.equal(lessonStats(lesson).answered, lesson.answers.filter((answer) => answer.result !== "skipped").length);

  // Stopping right after a successful retry leaves the word helped, not ready.
  let partial = buildLesson(index, targets, new Set(), T0, random);
  partial = advanceLesson(partial, T0);
  partial = answerLesson(partial, { op: "w", result: "wrong", at: T0 }, index, random);
  const retryAt = partial.steps.findIndex((step) => step.kind === "check" && step.role === "retry");
  assert.ok(retryAt > partial.index);
  const retry = partial.steps[retryAt]!;
  assert.ok(retry.kind === "check" && retry.ref.from === "generated" && retry.ref.mode === "recall");
  partial = answerLesson({ ...partial, index: retryAt }, { op: "r", result: "correct", at: T0 }, index, random);
  assert.deepEqual(lessonReadiness(partial), { [first]: "helped" });
  // And a failed retry leaves it needing another try.
  const failed = answerLesson({ ...partial, answers: partial.answers.slice(0, 1) }, { op: "r2", result: "wrong", at: T0 }, index, random);
  assert.deepEqual(lessonReadiness(failed), { [first]: "again" });
});

test("typed sentence-frame answers count as context, not isolated spelling", () => {
  const target = index.targets.find((candidate) =>
    index.content.get(candidate.sense.id)?.sense.check.some((item) => item.type === "produce"),
  );
  assert.ok(target);
  const produce = index.content.get(target.sense.id)?.sense.check.find((item) => item.type === "produce");
  assert.ok(produce);
  const ref = { from: "sense" as const, target: target.sense.id, item: produce.id };
  const item = resolveItem(index, ref);
  assert.ok(item);
  assert.equal(skillOf(ref, item), "context");
});

test("generated choices offer three other words' meanings, of the same part of speech when there are enough", () => {
  const targets = introductionOrder(index.targets, "general").slice(0, 5);
  const lesson = buildLesson(index, targets, new Set(), T0, random);
  const generated = lesson.steps.flatMap((step) =>
    step.kind === "check" && step.ref.from === "generated" && step.ref.mode !== "recall" ? [step.ref] : [],
  );
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

test("A1 lessons follow the curriculum unit by unit for every goal, after each word's prerequisites", () => {
  const curriculum = JSON.parse(readFileSync("content/curriculum/A1.json", "utf8")) as {
    units: { id: string; entries: { id: string; prerequisites: string[] }[] }[];
  };
  const sequence = curriculum.units.flatMap((unit) => unit.entries.map((entry) => entry.id));
  for (const goal of GOALS) {
    const first = introductionOrder(index.targets, goal).filter((target) => target.index === 0);
    assert.deepEqual(first.map((target) => target.entry.id), sequence, goal);
  }
  const position = new Map(sequence.map((id, at) => [id, at]));
  for (const entry of pilot.entries) {
    assert.deepEqual(entry.prerequisites, curriculum.units.flatMap((unit) => unit.entries).find((item) => item.id === entry.id)!.prerequisites);
    for (const required of entry.prerequisites) assert.ok(position.get(required)! < position.get(entry.id)!, `${required} before ${entry.id}`);
  }
  const first = index.targets[0]!;
  assert.deepEqual(unitOf(index, first), { id: "01-introductions", level: "A1", titleEn: "Introductions and personal information", titleFa: "معرفی و اطلاعات شخصی", number: 1 });
  assert.equal(unitOf(index, index.bySense.get("lex:A1:time")!)?.number, 3);
});

test("a further sense comes one unit after its word, and never in the same lesson", () => {
  const ordered = introductionOrder(index.targets, "general");
  const at = new Map(ordered.map((target, position) => [target.sense.id, position]));
  const further = ordered.filter((target) => target.index > 0);
  assert.ok(further.length > 0);
  for (const target of further) {
    const unit = target.entry.unit!;
    const nextUnit = ordered.filter((other) => other.index === 0 && other.entry.unit === unit + 1);
    for (const other of nextUnit) assert.ok(at.get(other.sense.id)! < at.get(target.sense.id)!, `${other.sense.id} before ${target.sense.id}`);
  }
  // Even when a further sense is next in line, it waits for its word's first sense.
  const sense = further[0]!;
  const word = index.bySense.get(sense.entry.id)!;
  const known = Object.fromEntries(ordered.filter((target) => target !== sense && target !== word).map((target) => [target.sense.id, {}]));
  assert.deepEqual(nextTargets([word, sense], known, 2).map((target) => target.sense.id), [word.sense.id]);
  assert.deepEqual(nextTargets([word, sense], { ...known, [word.sense.id]: {} }, 2).map((target) => target.sense.id), [sense.sense.id]);
  const known4 = Object.fromEntries(ordered.slice(0, 4).map((target) => [target.sense.id, {}]));
  assert.deepEqual(nextTargets(ordered, known4, 2).map((target) => target.sense.id), ordered.slice(4, 6).map((target) => target.sense.id));
});

test("outside a curriculum, targets that serve the goal come first and further senses last", () => {
  const targets = [
    { id: "lex:A2:a", goals: ["everyday"] as const, sense: 0 },
    { id: "lex:A2:a#two", goals: ["everyday"] as const, sense: 1 },
    { id: "lex:A2:b", goals: ["work"] as const, sense: 0 },
    { id: "lex:A1:c", goals: ["everyday"] as const, sense: 0, unit: 0 },
  ];
  assert.deepEqual(
    orderForGoal(targets, "work", (target) => target).map((target) => target.id),
    ["lex:A1:c", "lex:A2:b", "lex:A2:a", "lex:A2:a#two"],
  );
});

test("enhanced content at another level is taught first to learners at that level", () => {
  // The A1 content, plus one entry written for A2 (docs/CATALOGUE.md).
  const compiled = pilot;
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
  assert.equal(pilotFace(both.content.get("lex:A2:ability")!, {}, "en-GB").level, "A2");
  assert.equal(pilotFace(both.content.get("lex:A1:time")!, {}, "en-GB").level, "A1");
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
  assert.equal(compiled.version, index.version);
  for (const goal of GOALS) {
    assert.deepEqual(
      compiled.order[goal],
      introductionOrder(index.targets, goal).map((target) => target.sense.id),
      goal,
    );
  }
});

test("the released channel introduces only reviewed entries, but keeps every sense for existing cards", () => {
  const releasedId = pilot.entries[0]!.id;
  const full = indexPilot({ ...pilot, entries: pilot.entries.map((entry) => ({ ...entry, released: entry.id === releasedId })) });
  const view = introducible(full, "released");
  assert.ok(view.targets.length > 0);
  assert.ok(view.targets.every((target) => target.entry.id === releasedId));
  assert.deepEqual([...view.byEntry.keys()], [releasedId]);
  assert.equal(view.bySense.size, full.bySense.size);
  assert.ok(view.contrasts.every((contrast) => contrast.entries.every((id) => view.bySense.get(id)?.entry.released)));
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
  assert.deepEqual(checkupResult(session), { checked: 4, usable: 3, meaning: 4, use: 3, missing: 0 });
  assert.equal(checkupCandidates(ids, history, [answered, session], T0 + DAY).length, 0, "not checked again within 30 days");
});

test("a used-up held-out prompt is recorded as missing, never replaced by recognition", () => {
  const target = index.targets[0]!;
  const heldOut = heldOutItem(index.content.get(target.sense.id)?.sense);
  assert.ok(heldOut);
  const candidates = [{ id: target.sense.id, delayDays: 31 }];
  const seen = new Set([`${target.sense.id}/${heldOut.id}`]);
  const checkup = buildCheckup(index, candidates, seen, T0, random);

  const use = checkup.steps.filter((step) => step.kind === "check" && step.role === "checkup-use");
  const meaning = checkup.steps.filter((step) => step.kind === "check" && step.role === "checkup-meaning");
  assert.equal(use.length, 0, "no easier substitute is created");
  assert.equal(meaning.length, 1, "the independent meaning part may still run");
  assert.deepEqual(checkup.missing, { [target.sense.id]: ["use"] });

  let session = checkup;
  for (const _step of checkup.steps) {
    session = advanceLesson(answerLesson(session, { op: newIdFor(session), result: "correct", at: T0 }, index), T0);
  }
  assert.deepEqual(checkupResult(session), { checked: 0, usable: 0, meaning: 1, use: 0, missing: 1 });
});

function newIdFor(session: { answers: unknown[] }) {
  return `answer-${session.answers.length}`;
}


test("authored task support survives content resolution for the learner UI", () => {
  const localPilot = structuredClone(pilot);
  const entry = localPilot.entries.find((candidate) =>
    candidate.senses.some((sense) => sense.check.length > 0),
  );
  assert.ok(entry);
  const sense = entry.senses.find((candidate) => candidate.check.length > 0);
  assert.ok(sense);
  const authored = sense.check[0];
  authored.support = [{ en: "helper", fa: "واژهٔ کمکی" }];

  const localIndex = indexPilot(localPilot);
  const resolved = resolveItem(localIndex, {
    from: "sense",
    target: sense.id,
    item: authored.id,
  });
  assert.deepEqual(resolved?.support, [{ en: "helper", fa: "واژهٔ کمکی" }]);
});
