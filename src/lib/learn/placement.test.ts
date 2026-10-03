import assert from "node:assert/strict";
import test from "node:test";
import { placementLevel, type PlacementResult } from "./placement";

const row = (level: PlacementResult["level"], ...correct: boolean[]) => correct.map((ok) => ({ level, correct: ok }));

test("the suggested level is the first one not yet known", () => {
  assert.equal(placementLevel([...row("A1", false, false, true), ...row("A2", true, true, true)]), "A1");
  assert.equal(placementLevel([...row("A1", true, true, false), ...row("A2", true, false, false)]), "A2");
  assert.equal(
    placementLevel([...row("A1", true, true, true), ...row("A2", true, true, true), ...row("B1", true, true, false), ...row("B2", false, false, false)]),
    "B2",
  );
  assert.equal(placementLevel(["A1", "A2", "B1", "B2", "C1"].flatMap((level) => row(level as PlacementResult["level"], true, true, true))), "C1");
});

test("a lucky guess at a harder level does not skip an unknown easier one", () => {
  assert.equal(placementLevel([...row("A1", false, true, false), ...row("B2", true, true, true)]), "A1");
});
