import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { provenanceBlockers, provenanceManifest } from "../src/lib/learn/assurance";
import { loadCurrentRightsAudit } from "./rights-lineage-audit";
import {
  checkStatusLedger,
  LEDGER_STATES,
  parseStatusLedger,
  summarizeStatusLedger,
  type LedgerProblem,
  type LedgerRow,
} from "../src/lib/learn/status-ledger";

/**
 * Checks the status ledger in docs/A1_PLAN_STATUS.md (plan §31).
 *
 *   --check            exit non-zero on any problem (CI)
 *   --require-history  fail when git history is too shallow to verify commits
 *   --json             print the parsed ledger and summary
 */

const ROOT = process.cwd();
const LEDGER_FILE = path.join(ROOT, "docs", "A1_PLAN_STATUS.md");
const PROVENANCE_FILE = path.join(ROOT, "content", "assurance", "provenance.json");
const PROGRESS_FILE = path.join(ROOT, "content", "assurance", "progress.json");
const QUALIFIED_FILE = path.join(
  ROOT,
  "content",
  "assurance",
  "semantic",
  "calibration",
  "qualified.json",
);

/** The first implementation package (plan §41) and the Gate 0 legal blocker. */
const REQUIRED_IDS = [
  ...Array.from({ length: 12 }, (_, index) => `F${String(index + 1).padStart(2, "0")}`),
  "GATE0-RIGHTS",
  "P2-CALIBRATION",
];
const SEMANTIC_ROLES = ["english", "persian", "pedagogical", "adversarial"];
const COMPLETED = new Set(["MACHINE_PASS", "CANARY", "DONE"]);

function git(args: string[]): { ok: boolean; out: string } {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  return { ok: result.status === 0, out: (result.stdout ?? "").trim() };
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

const parsed = parseStatusLedger(fs.readFileSync(LEDGER_FILE, "utf8"));
const rows = parsed.rows;
const problems: LedgerProblem[] = [
  ...parsed.problems,
  ...checkStatusLedger(rows, REQUIRED_IDS),
];
const byId = new Map<string, LedgerRow>(rows.map((row) => [row.id, row]));

function fail(row: LedgerRow | undefined, message: string) {
  problems.push({ line: row?.line ?? 0, message });
}

// Evidence paths must exist in the repository.
for (const row of rows) {
  for (const file of row.paths) {
    if (!fs.existsSync(path.join(ROOT, file))) {
      fail(row, `${row.id}: evidence path does not exist: ${file}`);
    }
  }
}

// Commits must exist and be part of the history being checked.
const shallow = git(["rev-parse", "--is-shallow-repository"]);
const historyAvailable = shallow.ok && shallow.out === "false";
let historyNote = "";
if (historyAvailable) {
  for (const row of rows) {
    for (const [label, commit] of [
      ["first commit", row.firstCommit],
      ["completion commit", row.completionCommit],
    ] as const) {
      if (!commit) continue;
      if (!git(["cat-file", "-e", `${commit}^{commit}`]).ok) {
        fail(row, `${row.id}: ${label} ${commit} is not a commit in this repository`);
      } else if (!git(["merge-base", "--is-ancestor", commit, "HEAD"]).ok) {
        fail(row, `${row.id}: ${label} ${commit} is not in the history of HEAD`);
      }
    }
    if (row.firstCommit && row.completionCommit) {
      const ordered = git([
        "merge-base",
        "--is-ancestor",
        row.firstCommit,
        row.completionCommit,
      ]);
      if (!ordered.ok) {
        fail(row, `${row.id}: first commit ${row.firstCommit} is not an ancestor of completion commit ${row.completionCommit}`);
      }
    }
  }
} else if (process.argv.includes("--require-history")) {
  problems.push({
    line: 0,
    message: "git history is shallow or unavailable; ledger commits cannot be verified (check out with fetch-depth: 0)",
  });
} else {
  historyNote = " Commits not verified: shallow or missing git history.";
}

// Gate 0: the rights row is BLOCKED exactly while provenance has blockers.
const gate = byId.get("GATE0-RIGHTS");
const manifest = provenanceManifest.safeParse(readJson<unknown>(PROVENANCE_FILE));
if (!manifest.success) {
  fail(gate, "GATE0-RIGHTS: content/assurance/provenance.json is invalid; run npm run assurance:provenance");
} else if (gate) {
  const lineage = loadCurrentRightsAudit();
  const blockers = [
    ...provenanceBlockers(manifest.data),
    ...lineage.structuralIssues.map(issue => "rights-lineage:" + issue),
    ...lineage.blockers,
  ];
  if (blockers.length && gate.state !== "BLOCKED") {
    fail(gate, `GATE0-RIGHTS: provenance has ${blockers.length} blocker(s), so the state must be BLOCKED, not ${gate.state}`);
  }
  if (!blockers.length && gate.state === "BLOCKED") {
    fail(gate, "GATE0-RIGHTS: provenance has no blockers; record the clearing commit and evidence instead of BLOCKED");
  }
}

// Every blocker in the autonomous-assurance progress record has a BLOCKED row.
const progress = readJson<{ blockers?: { id: string; status: string }[] }>(PROGRESS_FILE);
for (const blocker of progress.blockers ?? []) {
  if (blocker.status !== "BLOCKED") continue;
  const id = blocker.id.toUpperCase();
  const row = byId.get(id);
  if (!row) fail(undefined, `${id}: content/assurance/progress.json lists blocker ${blocker.id} but the ledger has no ${id} row`);
  else if (row.state !== "BLOCKED") {
    fail(row, `${id}: content/assurance/progress.json lists it as BLOCKED but the ledger says ${row.state}`);
  }
}

// Judge calibration cannot be claimed complete while any role is unqualified.
const calibration = byId.get("P2-CALIBRATION");
const qualified = readJson<{ roles?: Record<string, { status?: string }> }>(QUALIFIED_FILE);
const qualifiedRoles = SEMANTIC_ROLES.filter(
  (role) => qualified.roles?.[role]?.status === "QUALIFIED",
);
if (calibration && COMPLETED.has(calibration.state) && qualifiedRoles.length < SEMANTIC_ROLES.length) {
  fail(calibration, `P2-CALIBRATION: ${calibration.state} needs all ${SEMANTIC_ROLES.length} judge roles qualified; ${qualifiedRoles.length} are`);
}

const summary = summarizeStatusLedger(rows);
problems.sort((a, b) => a.line - b.line);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ rows, summary, qualifiedRoles, problems }, null, 2));
} else {
  const counts = LEDGER_STATES.filter((state) => summary.byState[state])
    .map((state) => `${summary.byState[state]} ${state}`)
    .join(", ");
  console.log(`Status ledger: ${rows.length} task(s): ${counts}.${historyNote}`);
  const open = rows.filter((row) => row.state === "IN_PROGRESS" || row.state === "BLOCKED");
  for (const row of open) console.log(`- ${row.state} ${row.id}: ${row.task}`);
  console.log(
    `Canary waits on: ${summary.canaryBlockers.join(", ") || "nothing"}. Public release waits on: ${summary.releaseBlockers.join(", ") || "nothing"}.`,
  );
  for (const problem of problems) {
    console.error(`! docs/A1_PLAN_STATUS.md${problem.line ? `:${problem.line}` : ""} ${problem.message}`);
  }
}

if (process.argv.includes("--check") && problems.length) {
  console.error(`Status ledger is inconsistent: ${problems.length} problem(s).`);
  process.exit(1);
}
