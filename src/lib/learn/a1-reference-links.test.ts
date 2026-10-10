import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { a1ReferenceLinks } from "./a1-reference-links";

const fixture = () => ({
  schemaVersion: 1, level: "A1",
  entries: { "lex:A1:make": ["conf:do-make"] },
  notes: { "conf:do-make": { deck: "conf", title: "do / make" } },
});

test("the distributed reference scope matches exactly the actual A1 catalogue links", () => {
  const links = a1ReferenceLinks.parse(JSON.parse(readFileSync("public/data/a1-reference-links.json", "utf8")));
  const plan = JSON.parse(readFileSync("content/plans/A1.json", "utf8")) as {
    batches: Array<{ entries: Array<{ id: string; refs?: string[] }> }>;
  };
  const expected = Object.fromEntries(plan.batches.flatMap(batch => batch.entries)
    .filter(entry => entry.refs?.length).map(entry => [entry.id, entry.refs]));
  assert.deepEqual(links.entries, expected);
  assert.equal(Object.keys(links.notes).length, new Set(Object.values(expected).flat()).size);
  assert.ok(links.notes["conf:do-make"]);
  assert.equal(links.notes["conf:raise-rise"], undefined);
});

test("reference scope rejects foreign-level entries and unlinked notes", () => {
  const foreign = { ...fixture(), entries: { "lex:A2:raise": ["conf:do-make"] } };
  assert.equal(a1ReferenceLinks.safeParse(foreign).success, false);
  const extra = { ...fixture(), notes: { ...fixture().notes, "conf:raise-rise": { deck: "conf", title: "raise / rise" } } };
  assert.equal(a1ReferenceLinks.safeParse(extra).success, false);
});

test("reference scope rejects missing, duplicate and wrong-deck links", () => {
  assert.equal(a1ReferenceLinks.safeParse({ ...fixture(), notes: {} }).success, false);
  assert.equal(a1ReferenceLinks.safeParse({ ...fixture(), entries: { "lex:A1:make": ["conf:do-make", "conf:do-make"] } }).success, false);
  assert.equal(a1ReferenceLinks.safeParse({ ...fixture(), notes: { "conf:do-make": { deck: "syn", title: "do / make" } } }).success, false);
});
