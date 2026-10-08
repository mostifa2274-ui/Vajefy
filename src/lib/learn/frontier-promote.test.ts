import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMonotonicPromotions,
  applyPilotSafePromotions,
  improves,
  type FrontierCurriculum,
  type FrontierPromotion,
} from "../../../scripts/frontier-promote";

function entry(id: string, prerequisites: string[] = []) {
  return { id, prerequisites };
}

const curriculum: FrontierCurriculum = {
  version: 1,
  units: [
    { id: "01-one", targetEntries: 1, entries: [entry("u1")] },
    { id: "02-two", targetEntries: 1, entries: [entry("u2", ["u1"])] },
    { id: "03-three", targetEntries: 1, entries: [entry("u3", ["u2"])] },
    { id: "04-four", targetEntries: 1, entries: [entry("anchor", ["u3"])] },
    { id: "05-five", targetEntries: 1, entries: [entry("late-prereq", ["anchor"])] },
    {
      id: "06-six",
      targetEntries: 4,
      entries: [
        entry("first", ["u3"]),
        entry("second", ["first"]),
        entry("blocked", ["late-prereq"]),
        entry("pilot-sensitive", ["u1"]),
      ],
    },
  ],
};

const promotions: FrontierPromotion[] = [
  {
    dependencyId: "second",
    beforeEntryId: "anchor",
    targetUnit: "04-four",
    changesFrozenPilotRoster: false,
  },
  {
    dependencyId: "first",
    beforeEntryId: "anchor",
    targetUnit: "04-four",
    changesFrozenPilotRoster: false,
  },
  {
    dependencyId: "blocked",
    beforeEntryId: "anchor",
    targetUnit: "04-four",
    changesFrozenPilotRoster: false,
  },
  {
    dependencyId: "pilot-sensitive",
    beforeEntryId: "u2",
    targetUnit: "02-two",
    changesFrozenPilotRoster: true,
  },
];

test("pilot-safe promotions iterate through prerequisite closure without touching Units 1-3", () => {
  const result = applyPilotSafePromotions(curriculum, promotions);

  assert.deepEqual(result.curriculum.units.slice(0, 3), curriculum.units.slice(0, 3));
  assert.deepEqual(
    result.curriculum.units[3]?.entries.map((item) => item.id),
    ["first", "second", "anchor"],
  );
  assert.deepEqual(result.moved, ["first", "second"]);
  assert.deepEqual(result.alreadySatisfied, []);
  assert.deepEqual(result.blocked, [
    { dependencyId: "blocked", reason: "unmet-prerequisites:late-prereq" },
    { dependencyId: "pilot-sensitive", reason: "frozen-pilot-roster" },
  ]);
  assert.equal(result.curriculum.units[3]?.targetEntries, 3);
  assert.equal(result.curriculum.units[5]?.targetEntries, 2);
});

test("already-satisfied recommendations remain accounted for without reordering", () => {
  const result = applyPilotSafePromotions(curriculum, [
    {
      dependencyId: "u3",
      beforeEntryId: "anchor",
      targetUnit: "04-four",
      changesFrozenPilotRoster: false,
    },
  ]);
  assert.deepEqual(result.moved, []);
  assert.deepEqual(result.alreadySatisfied, ["u3"]);
  assert.deepEqual(result.blocked, []);
  assert.deepEqual(result.curriculum, curriculum);
});


test("stale or duplicate promotion plans fail closed", () => {
  assert.throws(
    () =>
      applyPilotSafePromotions(curriculum, [
        {
          dependencyId: "first",
          beforeEntryId: "anchor",
          targetUnit: "05-five",
          changesFrozenPilotRoster: false,
        },
      ]),
    /stale target unit/,
  );

  const duplicate: FrontierPromotion = {
    dependencyId: "first",
    beforeEntryId: "anchor",
    targetUnit: "04-four",
    changesFrozenPilotRoster: false,
  };
  assert.throws(
    () => applyPilotSafePromotions(curriculum, [duplicate, duplicate]),
    /duplicate dependency ids/,
  );
});


test("balanced-wave floors block underfilling source units but allow true surplus", () => {
  const entries = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, index) => entry(prefix + "-" + index));

  const balanced: FrontierCurriculum = {
    version: 1,
    assignedMinimum: 240,
    calibrationSlice: { unit: "01-one" },
    units: [
      { id: "01-one", targetEntries: 20, entries: entries("u1", 20) },
      { id: "02-two", targetEntries: 20, entries: entries("u2", 20) },
      { id: "03-three", targetEntries: 20, entries: entries("u3", 20) },
      {
        id: "04-four",
        targetEntries: 20,
        entries: [entry("anchor"), ...entries("u4", 19)],
      },
      {
        id: "05-five",
        targetEntries: 20,
        entries: [entry("floor-dep"), ...entries("u5", 19)],
      },
      {
        id: "06-six",
        targetEntries: 21,
        entries: [entry("movable-dep"), ...entries("u6", 20)],
      },
    ],
  };

  const result = applyPilotSafePromotions(balanced, [
    {
      dependencyId: "floor-dep",
      beforeEntryId: "anchor",
      targetUnit: "04-four",
      changesFrozenPilotRoster: false,
    },
    {
      dependencyId: "movable-dep",
      beforeEntryId: "anchor",
      targetUnit: "04-four",
      changesFrozenPilotRoster: false,
    },
  ]);

  assert.deepEqual(result.moved, ["movable-dep"]);
  assert.deepEqual(result.blocked, [
    { dependencyId: "floor-dep", reason: "source-balanced-wave-floor:20" },
  ]);
  assert.equal(result.curriculum.units[4]?.entries.length, 20);
  assert.equal(result.curriculum.units[5]?.entries.length, 20);
  assert.equal(result.curriculum.units[3]?.entries.length, 21);
  assert.equal(result.curriculum.units[4]?.targetEntries, 20);
  assert.equal(result.curriculum.units[5]?.targetEntries, 20);
  assert.equal(result.curriculum.units[3]?.targetEntries, 21);
});

test("a move is kept only when frontier findings fall and no other finding rises", () => {
  assert.equal(improves({ FRONTIER_TASK_VOCABULARY: 10 }, { FRONTIER_TASK_VOCABULARY: 9 }), true);
  assert.equal(improves({ FRONTIER_TASK_VOCABULARY: 10 }, { FRONTIER_TASK_VOCABULARY: 10 }), false);
  assert.equal(
    improves(
      { FRONTIER_TASK_VOCABULARY: 10, EXAMPLE_REUSED: 2 },
      { FRONTIER_TASK_VOCABULARY: 8, EXAMPLE_REUSED: 3 },
    ),
    false,
  );
  // Fewer findings of another kind never stand in for frontier progress.
  assert.equal(
    improves(
      { FRONTIER_TASK_VOCABULARY: 10, EXAMPLE_REUSED: 2 },
      { FRONTIER_TASK_VOCABULARY: 10, EXAMPLE_REUSED: 0 },
    ),
    false,
  );
});

test("monotonic promotion keeps helpful moves, rejects a move that adds findings, and stops", () => {
  const order = (current: FrontierCurriculum) => current.units.flatMap((unit) => unit.entries.map((item) => item.id));
  const before = (current: FrontierCurriculum, id: string) => order(current).indexOf(id) < order(current).indexOf("anchor");
  // Moving "first" fixes three findings; moving "second" then would add two,
  // as moving spelling ahead of spell did.
  const evaluate = (current: FrontierCurriculum) => ({
    FRONTIER_TASK_VOCABULARY: 10 - (before(current, "first") ? 3 : 0) + (before(current, "second") ? 2 : 0),
  });
  let plans = 0;
  const plan = () => {
    plans += 1;
    return promotions.filter((promotion) => !promotion.changesFrozenPilotRoster && promotion.dependencyId !== "blocked");
  };

  const result = applyMonotonicPromotions(curriculum, plan, evaluate);

  assert.deepEqual(result.accepted, [{ dependencyId: "first", frontierBefore: 10, frontierAfter: 7 }]);
  assert.deepEqual(result.counts, { FRONTIER_TASK_VOCABULARY: 7 });
  assert.equal(before(result.curriculum, "first"), true);
  assert.equal(before(result.curriculum, "second"), false);
  // One round keeps "first"; the next finds nothing better and ends.
  assert.equal(result.rounds, 2);
  assert.equal(plans, 2);
  // The input is not modified.
  assert.equal(before(curriculum, "first"), false);
});
