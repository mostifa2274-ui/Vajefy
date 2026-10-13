import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildCefrjA1Curriculum, CEFRJ_CURRICULUM_STATUS, type Curriculum } from "./rights-cefrj-curriculum";

const unit = (id: string, entries: [string, string[]][]) => ({
  id, titleEn: id, titleFa: "واحد", status: "planned", objectiveEn: "x", objectiveFa: "هدف",
  targetEntries: entries.length, entries: entries.map(([e, prerequisites]) => ({ id: e, prerequisites })),
});
const current: Curriculum = {
  version: 1, level: "A1", assignedMinimum: 5,
  units: [unit("01-intro", [["lex:A1:i", []], ["lex:A1:be", ["lex:A1:i"]]]),
    unit("02-home", [["lex:A1:road", []], ["lex:A1:street", ["lex:A1:road", "lex:A1:be"]], ["lex:A1:house", []]])],
  calibrationSlice: { unit: "01-intro", entries: ["lex:A1:i", "lex:A1:be"] },
};
const assignments = (start: unknown[], end: unknown[], unitId = "02-home") => ({
  schemaVersion: 1, status: CEFRJ_CURRICULUM_STATUS, description: "test", units: [{ unit: unitId, start, end }],
});
const drafted = [{ headword: "am", id: "lex:A1:cefrj-am" }, { headword: "pet", id: "lex:A2:pet" }];
const movedUp = [{ entryId: "lex:A1:road", headword: "road", cefrjLevel: "A2" }];
const ok = assignments(
  [{ headword: "am", id: "lex:A1:cefrj-am", prerequisites: ["lex:A1:be"] }],
  [{ headword: "pet", id: "lex:A2:pet", prerequisites: ["lex:A1:house"] }],
);

test("keeps retained entries in place, removes moved-up entries and adds NEW entries without changing IDs", () => {
  const { staged, issues } = buildCefrjA1Curriculum({ current, assignments: ok, drafted, movedUp });
  assert.deepEqual(issues, []);
  const home = staged!.curriculum.units[1]!;
  assert.deepEqual(home.entries.map(e => e.id), ["lex:A1:cefrj-am", "lex:A1:street", "lex:A1:house", "lex:A2:pet"]);
  assert.equal(home.targetEntries, 4);
  assert.deepEqual(home.entries[1]!.prerequisites, ["lex:A1:be"]);
  assert.deepEqual(staged!.droppedPrerequisites, [{ id: "lex:A1:street", prerequisite: "lex:A1:road" }]);
  assert.deepEqual(staged!.removed, [{ id: "lex:A1:road", headword: "road", fromUnit: "02-home", toLevel: "A2" }]);
  assert.equal(staged!.curriculum.assignedMinimum, undefined);
  assert.deepEqual(staged!.counts, {
    units: 2, entries: 6, retained: 4, added: 2, removed: 1, promoted: 0, droppedPrerequisites: 1,
  });
});

const three: Curriculum = {
  ...current,
  units: [...current.units, unit("03-town", [["lex:A1:shop", []], ["lex:A1:do", ["lex:A1:shop"]]])],
};

test("promotes a retained entry to an earlier unit after its NEW start entries, dropping only named prerequisites", () => {
  const { staged, issues } = buildCefrjA1Curriculum({
    current: three, drafted, movedUp,
    assignments: { ...ok, promotions: [{ id: "lex:A1:do", unit: "02-home", dropPrerequisites: ["lex:A1:shop"] }] },
  });
  assert.deepEqual(issues, []);
  assert.deepEqual(staged!.curriculum.units[1]!.entries.map(e => e.id),
    ["lex:A1:cefrj-am", "lex:A1:do", "lex:A1:street", "lex:A1:house", "lex:A2:pet"]);
  assert.deepEqual(staged!.curriculum.units[2]!.entries.map(e => e.id), ["lex:A1:shop"]);
  assert.deepEqual(staged!.curriculum.units[1]!.entries[1]!.prerequisites, []);
  assert.deepEqual(staged!.promoted, [{ id: "lex:A1:do", fromUnit: "03-town", toUnit: "02-home" }]);
  assert.deepEqual(staged!.droppedPrerequisites.at(-1), { id: "lex:A1:do", prerequisite: "lex:A1:shop", reason: "promoted" });
  assert.equal(staged!.counts.promoted, 1);
});

test("places a promoted entry directly after its anchor in the target unit", () => {
  const { staged, issues } = buildCefrjA1Curriculum({
    current: three, drafted, movedUp,
    assignments: { ...ok, promotions: [{ id: "lex:A1:do", unit: "02-home", after: "lex:A1:street", dropPrerequisites: ["lex:A1:shop"] }] },
  });
  assert.deepEqual(issues, []);
  assert.deepEqual(staged!.curriculum.units[1]!.entries.map(e => e.id),
    ["lex:A1:cefrj-am", "lex:A1:street", "lex:A1:do", "lex:A1:house", "lex:A2:pet"]);
  const bad = buildCefrjA1Curriculum({
    current: three, drafted, movedUp,
    assignments: { ...ok, promotions: [{ id: "lex:A1:do", unit: "02-home", after: "lex:A1:shop", dropPrerequisites: ["lex:A1:shop"] }] },
  }).issues.join("\n");
  assert.match(bad, /after lex:A1:shop must name a retained entry that stays in 02-home/);
});

test("rejects promotions that move later, touch the calibration unit, keep a later prerequisite or drop a non-prerequisite", () => {
  const run = (promotions: unknown[]) =>
    buildCefrjA1Curriculum({ current: three, drafted, movedUp, assignments: { ...ok, promotions } }).issues.join("\n");
  assert.match(run([{ id: "lex:A1:house", unit: "03-town", dropPrerequisites: [] }]), /must move to an earlier unit/);
  assert.match(run([{ id: "lex:A1:do", unit: "01-intro", dropPrerequisites: ["lex:A1:shop"] }]), /calibration unit is fixed/);
  assert.match(run([{ id: "lex:A1:do", unit: "02-home", dropPrerequisites: [] }]), /prerequisite lex:A1:shop must appear earlier/);
  assert.match(run([{ id: "lex:A1:do", unit: "02-home", dropPrerequisites: ["lex:A1:house"] }]), /cannot drop lex:A1:house/);
  assert.match(run([{ id: "lex:A1:road", unit: "02-home", dropPrerequisites: [] }]), /only a retained current A1 entry/);
  assert.match(run([{ id: "lex:A1:cefrj-am", unit: "02-home", dropPrerequisites: [] }]), /only a retained current A1 entry/);
});

test("rejects unplaced, misplaced and later-introduced entries", () => {
  const run = (a: unknown) => buildCefrjA1Curriculum({ current, assignments: a, drafted, movedUp }).issues.join("\n");
  assert.match(run(assignments([], [{ headword: "pet", id: "lex:A2:pet", prerequisites: [] }])), /cefrj-am: drafted NEW entry has no unit/);
  assert.match(run(assignments([{ headword: "am", id: "lex:A1:cefrj-am", prerequisites: ["lex:A2:pet"] }],
    [{ headword: "pet", id: "lex:A2:pet", prerequisites: [] }])), /prerequisite lex:A2:pet must appear earlier/);
  assert.match(run(assignments([{ headword: "am", id: "lex:A1:cefrj-am", prerequisites: ["lex:A1:road"] }],
    [{ headword: "pet", id: "lex:A2:pet", prerequisites: [] }])), /lex:A1:road is not in the staged A1 curriculum/);
  assert.match(run(assignments([{ headword: "am", id: "lex:A1:cefrj-am", prerequisites: [] }],
    [{ headword: "pet", id: "lex:A2:pet", prerequisites: [] }], "01-intro")), /calibration unit is fixed/);
  assert.match(run(assignments([{ headword: "is", id: "lex:A1:cefrj-am", prerequisites: [] }],
    [{ headword: "pet", id: "lex:A2:pet", prerequisites: [] }])), /does not match draft am/);
  assert.match(run({ ...ok, status: "APPROVED" }), /status/);
});

test("the committed staged curriculum places all NEW drafts and is not live", () => {
  const staged = JSON.parse(fs.readFileSync("content/rights-staging/a1-rebuild/curriculum-a1-cefrj.json", "utf8"));
  assert.equal(staged.liveInApp, false);
  assert.equal(staged.curriculumApproved, false);
  assert.equal(staged.counts.added, 338);
  assert.equal(staged.counts.removed, 166);
  const live = JSON.parse(fs.readFileSync("content/curriculum/A1.json", "utf8")) as Curriculum;
  assert.deepEqual(staged.curriculum.calibrationSlice, live.calibrationSlice);
});
