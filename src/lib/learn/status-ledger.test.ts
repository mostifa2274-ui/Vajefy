import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkStatusLedger,
  LEDGER_END,
  LEDGER_START,
  parseStatusLedger,
  summarizeStatusLedger,
} from "./status-ledger";

const HEADER =
  "| ID | Task | State | First commit | Completion commit | Evidence | Release impact | Notes |\n|---|---|---|---|---|---|---|---|";

function ledger(...rows: string[]): string {
  return ["# Status", "", LEDGER_START, HEADER, ...rows, LEDGER_END, ""].join("\n");
}

function messages(markdown: string, required: string[] = []): string[] {
  const parsed = parseStatusLedger(markdown);
  return [...parsed.problems, ...checkStatusLedger(parsed.rows, required)].map(
    (problem) => problem.message,
  );
}

test("a consistent ledger parses into rows with commits, evidence and notes", () => {
  const parsed = parseStatusLedger(
    ledger(
      "| F01 | Provenance | DONE | `a2d5b50` | `6e6a44b` | #82; `content/assurance/provenance.json` | release-gate | — |",
      "| F07 | Practice | NOT_STARTED | — | — | — | scope | — |",
      "| GATE0-RIGHTS | Rights | BLOCKED | `a2d5b50` | — | `content/assurance/provenance.json` | release-gate | Licence unverified. |",
    ),
  );
  assert.deepEqual(parsed.problems, []);
  assert.deepEqual(checkStatusLedger(parsed.rows, ["F01", "F07"]), []);
  const [done, idle, blocked] = parsed.rows;
  assert.equal(done.firstCommit, "a2d5b50");
  assert.equal(done.completionCommit, "6e6a44b");
  assert.deepEqual(done.pullRequests, [82]);
  assert.deepEqual(done.paths, ["content/assurance/provenance.json"]);
  assert.equal(idle.firstCommit, null);
  assert.equal(blocked.notes, "Licence unverified.");
  assert.equal(parsed.rows[0].line, 6);
});

test("missing markers or a changed header are reported", () => {
  assert.match(messages("# Status\n")[0], /markers/);
  assert.match(
    messages(`${LEDGER_START}\n| ID | State |\n|---|---|\n| F01 | DONE |\n${LEDGER_END}`)[0],
    /header must be/,
  );
});

test("states, impacts, IDs, commits and evidence must be well formed", () => {
  const found = messages(
    ledger(
      "| F01 | A | FINISHED | — | — | — | none | — |",
      "| F02 | B | DONE | `a2d5b50` | `6e6a44b` | — | gate | — |",
      "| f03 | C | DONE | — | — | — | none | — |",
      "| F04 | D | IN_PROGRESS | abc | — | #1 | none | Left. |",
      "| F05 | E | IN_PROGRESS | — | — | content/x.json | none | Left. |",
    ),
  );
  assert.ok(found.some((message) => /state "FINISHED"/.test(message)));
  assert.ok(found.some((message) => /release impact "gate"/.test(message)));
  assert.ok(found.some((message) => /ID "f03"/.test(message)));
  assert.ok(found.some((message) => /F04: first commit must be/.test(message)));
  assert.ok(found.some((message) => /evidence item "content\/x.json"/.test(message)));
});

test("completed states need both commits; open states cannot claim completion", () => {
  const found = messages(
    ledger(
      "| F01 | A | DONE | — | — | #82 | none | — |",
      "| F02 | B | MACHINE_PASS | `a2d5b50` | — | #82 | none | — |",
      "| F03 | C | IN_PROGRESS | `a2d5b50` | `6e6a44b` | #82 | none | Left. |",
      "| F04 | D | NOT_STARTED | `a2d5b50` | — | — | none | — |",
    ),
  );
  assert.ok(found.includes("F01: DONE needs a first commit"));
  assert.ok(found.includes("F01: DONE needs a completion commit"));
  assert.ok(found.includes("F02: MACHINE_PASS needs a completion commit"));
  assert.ok(found.includes("F03: IN_PROGRESS cannot have a completion commit"));
  assert.ok(found.includes("F04: NOT_STARTED cannot have a first commit"));
});

test("started rows need evidence, and unfinished rows need a note", () => {
  const found = messages(
    ledger(
      "| F01 | A | IN_PROGRESS | — | — | — | none | — |",
      "| F02 | B | BLOCKED | — | — | #9 | release-gate | — |",
      "| F03 | C | DEFERRED | — | — | #9 | scope | — |",
    ),
  );
  assert.ok(found.includes("F01: IN_PROGRESS needs evidence"));
  assert.ok(found.some((message) => message.startsWith("F01: IN_PROGRESS needs a note")));
  assert.ok(found.some((message) => message.startsWith("F02: BLOCKED needs a note")));
  assert.ok(found.some((message) => message.startsWith("F03: DEFERRED needs a note")));
});

test("duplicate and missing required IDs are reported", () => {
  const found = messages(
    ledger(
      "| F01 | A | NOT_STARTED | — | — | — | none | — |",
      "| F01 | B | NOT_STARTED | — | — | — | none | — |",
    ),
    ["F01", "F12"],
  );
  assert.ok(found.some((message) => /F01: duplicate ID/.test(message)));
  assert.ok(found.includes("F12: required ledger row is missing"));
});

test("the summary counts states and lists what the canary and release wait on", () => {
  const { rows } = parseStatusLedger(
    ledger(
      "| A | Gate | BLOCKED | — | — | #1 | release-gate | Rights. |",
      "| B | Unit | MACHINE_PASS | `a2d5b50` | `6e6a44b` | #2 | release-gate | — |",
      "| C | UX | NOT_STARTED | — | — | — | canary-gate | — |",
      "| D | Done | DONE | `a2d5b50` | `6e6a44b` | #3 | release-gate | — |",
      "| E | Scope | NOT_STARTED | — | — | — | scope | — |",
    ),
  );
  const summary = summarizeStatusLedger(rows);
  assert.equal(summary.byState.NOT_STARTED, 2);
  assert.equal(summary.byState.DONE, 1);
  assert.deepEqual(summary.canaryBlockers, ["A", "C"]);
  assert.deepEqual(summary.releaseBlockers, ["A", "B"]);
});
