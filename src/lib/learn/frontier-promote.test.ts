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
    {
      id: "04-four",
      targetEntries: 6,
      entries: [
        entry("base", ["u3"]),
        entry("anchor", ["base"]),
        entry("late-prereq", ["anchor"]),
        entry("blocked", ["late-prereq"]),
        entry("first", ["base"]),
        entry("second", ["first"]),
      ],
    },
    { id: "05-five", targetEntries: 1, entries: [entry("cross", ["u3"])] },
    { id: "06-six", targetEntries: 1, entries: [entry("pilot-sensitive", ["u1"])] },
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
    dependencyId: "cross",
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

test("pilot-safe promotions iterate within a unit without changing the frozen roster or wave sizes", () => {
  const result = applyPilotSafePromotions(curriculum, promotions);

  assert.deepEqual(result.curriculum.units.slice(0, 3), curriculum.units.slice(0, 3));
  assert.deepEqual(
    result.curriculum.units[3]?.entries.map((item) => item.id),
    ["base", "first", "second", "anchor", "late-prereq", "blocked"],
  );
  assert.deepEqual(result.moved, ["first", "second"]);
  assert.deepEqual(result.alreadySatisfied, []);
  assert.deepEqual(result.blocked, [
    { dependencyId: "blocked", reason: "unmet-prerequisites:late-prereq" },
    { dependencyId: "cross", reason: "balanced-wave-required" },
    { dependencyId: "pilot-sensitive", reason: "frozen-pilot-roster" },
  ]);
  assert.deepEqual(
    result.curriculum.units.map((unit) => ({
      id: unit.id,
      targetEntries: unit.targetEntries,
      entries: unit.entries.length,
    })),
    curriculum.units.map((unit) => ({
      id: unit.id,
      targetEntries: unit.targetEntries,
      entries: unit.entries.length,
    })),
  );
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
