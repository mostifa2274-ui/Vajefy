import fs from "node:fs";
import path from "node:path";
import type { Pilot } from "../src/lib/learn/content";
import {
  arbitrateSemanticJudgments,
  semanticEvidenceBundle,
  semanticJudgeRecord,
  semanticRubricManifest,
  type SemanticJudgeRecord,
} from "../src/lib/learn/assurance";
import { semanticInputHash, semanticTargetInput } from "./semantic-input";

const ROOT = process.cwd();
const COMPILED = path.join(ROOT, "content", "compiled", "enhanced.json");
const CURRICULUM = path.join(ROOT, "content", "curriculum", "A1.json");
const RUBRICS = path.join(ROOT, "content", "assurance", "semantic-rubrics.json");
const EVIDENCE_DIR = path.join(ROOT, "content", "assurance", "semantic");

type Curriculum = {
  units: { id: string; entries: { id: string }[] }[];
};

type TargetReport = {
  targetId: string;
  entryId: string;
  contentVersion: string;
  inputHash: string;
  status: "PASS" | "FAIL" | "UNCERTAIN" | "DISAGREEMENT" | "QUARANTINED";
  blockers: string[];
  vetoes: string[];
  judgments: number;
};

function read<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function option(flag: string): string | undefined {
  const at = process.argv.indexOf(flag);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

function has(flag: string): boolean {
  return process.argv.includes(flag);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const unitId = option("--unit") ?? "01-introductions";
const pilot = read<Pilot>(COMPILED);
const curriculum = read<Curriculum>(CURRICULUM);
const rubricParse = semanticRubricManifest.safeParse(read<unknown>(RUBRICS));
if (!rubricParse.success) {
  fail(
    `Invalid semantic rubric manifest: ${rubricParse.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ")}`,
  );
}
const rubrics = rubricParse.data;

const unit = curriculum.units.find((candidate) => candidate.id === unitId);
if (!unit) fail(`Unknown A1 unit: ${unitId}`);

const entryById = new Map(pilot.entries.map((entry) => [entry.id, entry]));
const selectedEntries = unit.entries.map(({ id }) => {
  const entry = entryById.get(id);
  if (!entry) fail(`${unitId}: missing compiled entry ${id}`);
  return entry;
});

const targets = selectedEntries.flatMap((entry) =>
  entry.senses.map((sense) => ({
    targetId: sense.id,
    entryId: entry.id,
    contentVersion: entry.version,
    inputHash: semanticInputHash(semanticTargetInput(entry, sense, unitId)),
  })),
);
const targetIds = new Set(targets.map((target) => target.targetId));

const evidenceFile = path.join(EVIDENCE_DIR, `${unitId}.json`);
let generationContextKey = "source-authoring:historical-unknown";
let judgments: SemanticJudgeRecord[] = [];
const evidenceProblems: string[] = [];

if (fs.existsSync(evidenceFile)) {
  const parsed = semanticEvidenceBundle.safeParse(read<unknown>(evidenceFile));
  if (!parsed.success) {
    fail(
      `${path.relative(ROOT, evidenceFile)} is invalid: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  if (parsed.data.unitId !== unitId) {
    fail(
      `${path.relative(ROOT, evidenceFile)} names unit ${parsed.data.unitId}, expected ${unitId}`,
    );
  }
  generationContextKey = parsed.data.generationContextKey;
  judgments = parsed.data.judgments;

  for (const judgment of judgments) {
    if (!targetIds.has(judgment.targetId)) {
      evidenceProblems.push(`unknown-target:${judgment.targetId}`);
    }
    const reparsed = semanticJudgeRecord.safeParse(judgment);
    if (!reparsed.success) {
      evidenceProblems.push(`invalid-judgment:${judgment.targetId}`);
    }
  }
}

const byTarget = new Map<string, SemanticJudgeRecord[]>();
for (const judgment of judgments) {
  const list = byTarget.get(judgment.targetId) ?? [];
  list.push(judgment);
  byTarget.set(judgment.targetId, list);
}

const reportTargets: TargetReport[] = targets.map((target) => {
  const records = byTarget.get(target.targetId) ?? [];
  const stale: string[] = [];

  for (const record of records) {
    if (record.contentVersion !== target.contentVersion) {
      stale.push(`stale-content-version:${record.role}`);
    }
    if (record.inputHash !== target.inputHash) {
      stale.push(`stale-input-hash:${record.role}`);
    }
  }

  const arbitration = arbitrateSemanticJudgments(
    records,
    rubrics,
    generationContextKey,
  );

  return {
    ...target,
    status: stale.length ? "QUARANTINED" : arbitration.status,
    blockers: [...stale, ...arbitration.blockers],
    vetoes: arbitration.vetoes,
    judgments: records.length,
  };
});

const summary = {
  unitId,
  entries: selectedEntries.length,
  senses: reportTargets.length,
  judgments: judgments.length,
  pass: reportTargets.filter((target) => target.status === "PASS").length,
  fail: reportTargets.filter((target) => target.status === "FAIL").length,
  uncertain: reportTargets.filter((target) => target.status === "UNCERTAIN")
    .length,
  disagreement: reportTargets.filter(
    (target) => target.status === "DISAGREEMENT",
  ).length,
  quarantined: reportTargets.filter(
    (target) => target.status === "QUARANTINED",
  ).length,
  evidenceFile: fs.existsSync(evidenceFile)
    ? path.relative(ROOT, evidenceFile)
    : null,
  evidenceProblems,
};

if (has("--json")) {
  console.log(JSON.stringify({ summary, targets: reportTargets }, null, 2));
} else {
  console.log(
    `Semantic assurance [${unitId}]: ${summary.entries} entries / ${summary.senses} senses; PASS ${summary.pass}, FAIL ${summary.fail}, UNCERTAIN ${summary.uncertain}, DISAGREEMENT ${summary.disagreement}, QUARANTINED ${summary.quarantined}; ${summary.judgments} judgment record(s).`,
  );
  if (!summary.evidenceFile) {
    console.log(
      `Evidence: none committed yet at ${path.relative(ROOT, evidenceFile)}; missing evidence stays quarantined.`,
    );
  }
  if (summary.evidenceProblems.length) {
    for (const problem of summary.evidenceProblems) console.log(`! ${problem}`);
  }
}

if (has("--check") && summary.evidenceProblems.length) {
  fail(
    `Semantic assurance evidence has ${summary.evidenceProblems.length} structural problem(s).`,
  );
}

if (has("--check")) {
  const stale = reportTargets.flatMap((target) =>
    target.blockers
      .filter(
        (blocker) =>
          blocker.startsWith("stale-") ||
          blocker === "target-mismatch" ||
          blocker === "content-version-mismatch" ||
          blocker === "input-hash-mismatch" ||
          blocker === "judge-context-not-independent" ||
          blocker === "judge-context-matches-generator" ||
          blocker.startsWith("duplicate-role:") ||
          blocker.startsWith("stale-rubric:") ||
          blocker.startsWith("stale-prompt:") ||
          blocker.startsWith("missing-criteria:") ||
          blocker.startsWith("unknown-criteria:"),
      )
      .map((blocker) => `${target.targetId}:${blocker}`),
  );
  if (stale.length) {
    fail(
      `Semantic assurance evidence is inconsistent with current content/rubrics:\n- ${stale.join("\n- ")}`,
    );
  }
}

if (has("--require-pass")) {
  const blocked = reportTargets.filter((target) => target.status !== "PASS");
  if (blocked.length) {
    fail(
      `Semantic assurance is not complete: ${blocked.length}/${reportTargets.length} sense(s) are not PASS. Missing or uncertain evidence cannot be promoted automatically.`,
    );
  }
}
