/**
 * The implementation status ledger in `docs/A1_PLAN_STATUS.md` (plan §31).
 *
 * The ledger is a Markdown table between two marker comments. Each row is one
 * task with an ID, a state, the commits that started and completed it, the
 * evidence that shows it, and what it means for release. This module parses
 * the table and checks its internal consistency; `scripts/plan-status.ts`
 * adds the checks that need the file system, git and other records.
 */

export const LEDGER_START = "<!-- status-ledger:start -->";
export const LEDGER_END = "<!-- status-ledger:end -->";

export const LEDGER_STATES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "BLOCKED",
  "MACHINE_PASS",
  "CANARY",
  "DONE",
  "DEFERRED",
  "REMOVED",
] as const;
export type LedgerState = (typeof LEDGER_STATES)[number];

export const RELEASE_IMPACTS = [
  "release-gate",
  "canary-gate",
  "scope",
  "none",
] as const;
export type ReleaseImpact = (typeof RELEASE_IMPACTS)[number];

export const LEDGER_COLUMNS = [
  "ID",
  "Task",
  "State",
  "First commit",
  "Completion commit",
  "Evidence",
  "Release impact",
  "Notes",
] as const;

/** States that claim the work is finished and must name where it finished. */
const COMPLETED: ReadonlySet<LedgerState> = new Set([
  "MACHINE_PASS",
  "CANARY",
  "DONE",
]);

/** States that say work is unfinished and must say what remains or blocks it. */
const NEEDS_NOTE: ReadonlySet<LedgerState> = new Set([
  "IN_PROGRESS",
  "BLOCKED",
  "DEFERRED",
  "REMOVED",
]);

const ID = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const COMMIT = /^`([0-9a-f]{7,40})`$/;
const NONE = "—";
const PR = /^#\d+$/;
const PATH = /^`([^`]+)`$/;

export type LedgerRow = {
  line: number;
  id: string;
  task: string;
  state: LedgerState;
  firstCommit: string | null;
  completionCommit: string | null;
  pullRequests: number[];
  paths: string[];
  impact: ReleaseImpact;
  notes: string;
};

export type LedgerProblem = { line: number; message: string };

export type ParsedLedger = { rows: LedgerRow[]; problems: LedgerProblem[] };

function cells(line: string): string[] {
  const trimmed = line.trim();
  return trimmed
    .slice(1, trimmed.endsWith("|") ? -1 : undefined)
    .split("|")
    .map((cell) => cell.trim());
}

function commitCell(
  value: string,
  line: number,
  column: string,
  problems: LedgerProblem[],
): string | null {
  if (value === NONE) return null;
  const match = COMMIT.exec(value);
  if (!match) {
    problems.push({
      line,
      message: `${column} must be ${NONE} or a backticked commit hash (7-40 hex), got "${value}"`,
    });
    return null;
  }
  return match[1];
}

/** Parses the ledger table. Problems are reported with their line in the file. */
export function parseStatusLedger(markdown: string): ParsedLedger {
  const lines = markdown.split("\n");
  const problems: LedgerProblem[] = [];
  const start = lines.findIndex((line) => line.trim() === LEDGER_START);
  const end = lines.findIndex((line) => line.trim() === LEDGER_END);
  if (start < 0 || end < 0 || end < start) {
    return {
      rows: [],
      problems: [
        {
          line: 0,
          message: `ledger markers ${LEDGER_START} and ${LEDGER_END} are missing or out of order`,
        },
      ],
    };
  }

  const table = lines
    .slice(start + 1, end)
    .map((text, index) => ({ text, line: start + 2 + index }))
    .filter(({ text }) => text.trim().startsWith("|"));
  if (table.length < 2) {
    problems.push({ line: start + 1, message: "ledger table is empty" });
    return { rows: [], problems };
  }

  const header = cells(table[0].text);
  if (header.join("|") !== LEDGER_COLUMNS.join("|")) {
    problems.push({
      line: table[0].line,
      message: `ledger header must be: ${LEDGER_COLUMNS.join(" | ")}`,
    });
    return { rows: [], problems };
  }

  const rows: LedgerRow[] = [];
  for (const { text, line } of table.slice(2)) {
    const values = cells(text);
    if (values.length !== LEDGER_COLUMNS.length) {
      problems.push({
        line,
        message: `row has ${values.length} cells; expected ${LEDGER_COLUMNS.length}`,
      });
      continue;
    }
    const [id, task, state, first, completion, evidence, impact, notes] =
      values;
    if (!ID.test(id)) {
      problems.push({ line, message: `ID "${id}" must be uppercase words joined by hyphens` });
      continue;
    }
    if (!(LEDGER_STATES as readonly string[]).includes(state)) {
      problems.push({
        line,
        message: `${id}: state "${state}" is not one of ${LEDGER_STATES.join(", ")}`,
      });
      continue;
    }
    if (!(RELEASE_IMPACTS as readonly string[]).includes(impact)) {
      problems.push({
        line,
        message: `${id}: release impact "${impact}" is not one of ${RELEASE_IMPACTS.join(", ")}`,
      });
      continue;
    }

    const pullRequests: number[] = [];
    const paths: string[] = [];
    if (evidence !== NONE) {
      for (const item of evidence.split(";").map((part) => part.trim())) {
        const path = PATH.exec(item);
        if (PR.test(item)) pullRequests.push(Number(item.slice(1)));
        else if (path) paths.push(path[1]);
        else {
          problems.push({
            line,
            message: `${id}: evidence item "${item}" must be a pull request (#12) or a backticked path, separated by ";"`,
          });
        }
      }
    }

    rows.push({
      line,
      id,
      task,
      state: state as LedgerState,
      firstCommit: commitCell(first, line, `${id}: first commit`, problems),
      completionCommit: commitCell(
        completion,
        line,
        `${id}: completion commit`,
        problems,
      ),
      pullRequests,
      paths,
      impact: impact as ReleaseImpact,
      notes: notes === NONE ? "" : notes,
    });
  }
  return { rows, problems };
}

/** Rules that need only the table itself. */
export function checkStatusLedger(
  rows: LedgerRow[],
  requiredIds: readonly string[] = [],
): LedgerProblem[] {
  const problems: LedgerProblem[] = [];
  const seen = new Map<string, number>();
  for (const row of rows) {
    const where = row.line;
    const earlier = seen.get(row.id);
    if (earlier !== undefined) {
      problems.push({ line: where, message: `${row.id}: duplicate ID (first on line ${earlier})` });
    }
    seen.set(row.id, where);

    if (!row.task) problems.push({ line: where, message: `${row.id}: task is empty` });

    if (COMPLETED.has(row.state)) {
      if (!row.firstCommit) {
        problems.push({ line: where, message: `${row.id}: ${row.state} needs a first commit` });
      }
      if (!row.completionCommit) {
        problems.push({ line: where, message: `${row.id}: ${row.state} needs a completion commit` });
      }
    } else if (row.completionCommit && row.state !== "REMOVED") {
      problems.push({
        line: where,
        message: `${row.id}: ${row.state} cannot have a completion commit`,
      });
    }

    if (row.state === "NOT_STARTED") {
      if (row.firstCommit) {
        problems.push({ line: where, message: `${row.id}: NOT_STARTED cannot have a first commit` });
      }
    } else if (!row.pullRequests.length && !row.paths.length) {
      problems.push({ line: where, message: `${row.id}: ${row.state} needs evidence` });
    }

    if (NEEDS_NOTE.has(row.state) && !row.notes) {
      problems.push({
        line: where,
        message: `${row.id}: ${row.state} needs a note saying what remains, blocks or replaced it`,
      });
    }
  }
  for (const id of requiredIds) {
    if (!seen.has(id)) problems.push({ line: 0, message: `${id}: required ledger row is missing` });
  }
  return problems;
}

export type LedgerSummary = {
  byState: Record<LedgerState, number>;
  /** Release-gate rows that are not DONE: public release (R4) waits on them. */
  releaseBlockers: string[];
  /** Canary-gate rows that are neither MACHINE_PASS, CANARY nor DONE. */
  canaryBlockers: string[];
};

export function summarizeStatusLedger(rows: LedgerRow[]): LedgerSummary {
  const byState = Object.fromEntries(
    LEDGER_STATES.map((state) => [state, 0]),
  ) as Record<LedgerState, number>;
  for (const row of rows) byState[row.state] += 1;
  return {
    byState,
    releaseBlockers: rows
      .filter((row) => row.impact === "release-gate" && row.state !== "DONE")
      .map((row) => row.id),
    canaryBlockers: rows
      .filter(
        (row) =>
          (row.impact === "canary-gate" || row.impact === "release-gate") &&
          !COMPLETED.has(row.state),
      )
      .map((row) => row.id),
  };
}
