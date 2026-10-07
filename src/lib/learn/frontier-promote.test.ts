import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPilotSafePromotions,
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
