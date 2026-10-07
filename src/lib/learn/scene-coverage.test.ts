import assert from "node:assert/strict";
import test from "node:test";
import { buildSceneCoverage } from "../../../scripts/scene-coverage";

const catalogue = {
  entries: [
    { id: "lex:A1:a", senses: [{ id: "lex:A1:a" }, { id: "lex:A1:a#two" }] },
    { id: "lex:A1:b", senses: [{ id: "lex:A1:b" }] },
  ],
};
const curriculum = {
  units: [{ entries: [{ id: "lex:A1:a" }, { id: "lex:A1:b" }] }],
};

test("scene coverage reports every sense and does not invent a threshold", () => {
  const report = buildSceneCoverage(catalogue, curriculum, [
    {
      id: "scene:one",
      kind: "dialogue",
      targets: ["lex:A1:a", "lex:A1:b"],
      check: [{}, {}],
    },
    {
      id: "scene:two",
      kind: "passage",
      targets: ["lex:A1:a"],
      check: [{}, {}, {}],
    },
  ]);
  assert.deepEqual(report.summary, {
    senses: 3,
    scenes: 2,
    covered: 1,
    uncovered: 2,
    coverageRatio: 0.333333,
    coveredByTwoOrMore: 0,
    maxScenesPerSense: 1,
  });
  assert.equal(report.threshold, null);
  assert.equal(report.thresholdStatus, "UNSET");
  assert.deepEqual(
    report.senses.find((sense) => sense.id === "lex:A1:a")?.scenes,
    ["scene:one"],
  );
});

test("scene coverage fails closed on unknown targets or too few checks", () => {
  assert.throws(
    () =>
      buildSceneCoverage(catalogue, curriculum, [
        {
          id: "scene:bad",
          kind: "dialogue",
          targets: ["lex:A1:unknown"],
          check: [{}, {}],
        },
      ]),
    /unknown target/,
  );
  assert.throws(
    () =>
      buildSceneCoverage(catalogue, curriculum, [
        {
          id: "scene:thin",
          kind: "dialogue",
          targets: ["lex:A1:a"],
          check: [{}],
        },
      ]),
    /at least two comprehension checks/,
  );
});
