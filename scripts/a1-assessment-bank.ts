import fs from "node:fs";
import path from "node:path";
import type { CheckItem, Pilot } from "../src/lib/learn/content.ts";

/**
 * Read-only, version-bound A1 held-out assessment bank.
 *
 * Examples:
 *   npm run content:assessment-bank
 *   npm run content:assessment-bank -- --scope study --json
 *   npm run content:assessment-bank -- --unit 08-work-study --json
 *   npm run content:assessment-bank -- --scope all-a1 --check
 *
 * The bank never writes learner data, review decisions, or release state.
 * It exposes the exact final authored check that the app reserves from normal
 * teaching/practice for delayed assessment.
 */

const ROOT = process.cwd();
const COMPILED = path.join(ROOT, "content", "compiled", "enhanced.json");
const CURRICULUM = path.join(ROOT, "content", "curriculum", "A1.json");
const PILOT_SELECTION = path.join(ROOT, "content", "pilot-a1.json");
const STUDY = path.join(ROOT, "content", "study-a1.json");
const A1_PLAN = path.join(ROOT, "content", "plans", "A1.json");

const SCOPES = ["calibration", "study", "pilot", "all-a1"] as const;
type Scope = (typeof SCOPES)[number];
type BankScope = Scope | `unit:${string}`;

type Curriculum = {
  level: string;
  calibrationSlice: { entries: string[] };
  units: {
    id: string;
    titleEn: string;
    titleFa: string;
    entries: { id: string }[];
  }[];
};

type PilotSelection = { entries: { id: string }[] };
type A1Plan = {
  level: string;
  batches: { id: string; entries: { id: string }[] }[];
};

type BankRow = {
  order: number;
  entryId: string;
  headword: string;
  entryVersion: string;
  curriculumUnit: string | null;
  senseId: string;
  senseOrder: number;
  pos: string;
  gloss: string;
  assessmentToken: string | null;
  ready: boolean;
  authoredChecks: number;
  teachingCheckIds: string[];
  heldOut: CheckItem | null;
};

type Bank = {
  scope: BankScope;
  generatedFrom: {
    contentVersion: string;
    selectedEntries: number;
    selectedSenses: number;
  };
  evidenceBoundary: {
    reservationRule: string;
    armMeaning: string;
    missingMeaning: string;
    reviewMeaning: string;
  };
  summary: {
    entries: number;
    senses: number;
    readySenses: number;
    missingSenses: number;
    choice: number;
    cloze: number;
    produce: number;
  };
  missing: { entryId: string; senseId: string; authoredChecks: number }[];
  rows: BankRow[];
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

const explicitScope = option("--scope");
const rawUnit = option("--unit");
if (rawUnit && explicitScope) {
  fail("--unit cannot be combined with --scope; choose one assessment selection");
}
const rawScope = explicitScope ?? "calibration";
if (!SCOPES.includes(rawScope as Scope)) {
  fail(`--scope must be one of ${SCOPES.join(", ")}`);
}
const scope = rawScope as Scope;

const outputModes = ["--check", "--json"].filter(has);
if (outputModes.length > 1) {
  fail(`choose only one output mode: ${outputModes.join(", ")}`);
}

const pilot = read<Pilot>(COMPILED);
const curriculum = read<Curriculum>(CURRICULUM);
const pilotSelection = read<PilotSelection>(PILOT_SELECTION);
const plan = read<A1Plan>(A1_PLAN);

if (curriculum.level !== "A1") fail("content/curriculum/A1.json must be A1");
if (plan.level !== "A1") fail("content/plans/A1.json must be A1");

const byId = new Map(pilot.entries.map((entry) => [entry.id, entry]));
const unitById = new Map(curriculum.units.map((unit) => [unit.id, unit]));
const unitByEntry = new Map<string, string>();
for (const unit of curriculum.units) {
  for (const item of unit.entries) {
    if (unitByEntry.has(item.id)) {
      fail(`duplicate curriculum assignment for ${item.id}`);
    }
    unitByEntry.set(item.id, unit.id);
  }
}

/**
 * The study's word set (content/study-a1.json): its units' entries in
 * curriculum order. The units must open the curriculum, in order.
 */
function studyIds(): string[] {
  if (!fs.existsSync(STUDY)) fail("content/study-a1.json is missing");
  const study = read<{ level?: string; units?: unknown }>(STUDY);
  const units = Array.isArray(study.units) ? study.units : [];
  if (study.level !== "A1") fail("content/study-a1.json must be A1");
  if (!units.length) fail("content/study-a1.json must list at least one unit");
  units.forEach((id, index) => {
    if (curriculum.units[index]?.id !== id) {
      fail(
        `content/study-a1.json units must be the first curriculum units, in order; expected ${curriculum.units[index]?.id ?? "no further unit"} at position ${index + 1}, found ${String(id)}`,
      );
    }
  });
  return curriculum.units.slice(0, units.length).flatMap((unit) => unit.entries.map((entry) => entry.id));
}

const selectedUnit = rawUnit ? unitById.get(rawUnit) : undefined;
if (rawUnit && !selectedUnit) {
  fail(
    `unknown curriculum unit ${rawUnit}; choose one of ${curriculum.units
      .map((unit) => unit.id)
      .join(", ")}`,
  );
}

const bankScope: BankScope = rawUnit ? `unit:${rawUnit}` : scope;
const selectedIds = rawUnit
  ? selectedUnit!.entries.map((entry) => entry.id)
  : scope === "calibration"
    ? curriculum.calibrationSlice.entries
    : scope === "study"
      ? studyIds()
      : scope === "pilot"
        ? pilotSelection.entries.map((entry) => entry.id)
        : curriculum.units.flatMap((unit) => unit.entries.map((entry) => entry.id));

const duplicates = selectedIds.filter(
  (id, index) => selectedIds.indexOf(id) !== index,
);
if (duplicates.length) {
  fail(
    `${bankScope} selection contains duplicate ids: ${[
      ...new Set(duplicates),
    ].join(", ")}`,
  );
}

const plannedIds = plan.batches.flatMap((batch) =>
  batch.entries.map((entry) => entry.id),
);
if (!rawUnit && scope === "all-a1") {
  const selectedSet = new Set(selectedIds);
  const planSet = new Set(plannedIds);
  const missingFromCurriculum = plannedIds.filter((id) => !selectedSet.has(id));
  const unknownInCurriculum = selectedIds.filter((id) => !planSet.has(id));
  if (
    selectedIds.length !== plannedIds.length ||
    missingFromCurriculum.length ||
    unknownInCurriculum.length
  ) {
    fail(
      `all-a1 assessment bank must exactly match the A1 plan; ${missingFromCurriculum.length} missing and ${unknownInCurriculum.length} unknown curriculum id(s)`,
    );
  }
}

const missingContent = selectedIds.filter((id) => !byId.has(id));
if (missingContent.length) {
  fail(
    `${bankScope} selection contains ${missingContent.length} id(s) without compiled content: ${missingContent
      .slice(0, 10)
      .join(", ")}`,
  );
}

const rows: BankRow[] = [];
const missing: Bank["missing"] = [];
let rowOrder = 0;
for (const entryId of selectedIds) {
  const entry = byId.get(entryId)!;
  entry.senses.forEach((sense, senseIndex) => {
    const heldOut = sense.check.at(-1) ?? null;
    const ready = sense.check.length >= 3 && Boolean(heldOut);
    if (!ready) {
      missing.push({
        entryId: entry.id,
        senseId: sense.id,
        authoredChecks: sense.check.length,
      });
    }
    rowOrder += 1;
    rows.push({
      order: rowOrder,
      entryId: entry.id,
      headword: entry.headword,
      entryVersion: entry.version,
      curriculumUnit: unitByEntry.get(entry.id) ?? null,
      senseId: sense.id,
      senseOrder: senseIndex + 1,
      pos: sense.pos,
      gloss: sense.gloss,
      assessmentToken: heldOut
        ? `${entry.id}@${entry.version}/${sense.id}/${heldOut.id}`
        : null,
      ready,
      authoredChecks: sense.check.length,
      teachingCheckIds: sense.check.slice(0, -1).map((item) => item.id),
      heldOut,
    });
  });
}

const tokens = rows.flatMap((row) =>
  row.assessmentToken ? [row.assessmentToken] : [],
);
const duplicateTokens = tokens.filter(
  (token, index) => tokens.indexOf(token) !== index,
);
if (duplicateTokens.length) {
  fail(
    `assessment bank contains duplicate version-bound token(s): ${[
      ...new Set(duplicateTokens),
    ].join(", ")}`,
  );
}

for (const row of rows) {
  if (
    row.heldOut &&
    row.teachingCheckIds.includes(row.heldOut.id)
  ) {
    fail(
      `held-out item leaked into teaching ids: ${row.entryId}/${row.senseId}/${row.heldOut.id}`,
    );
  }
}

const typeCount = (type: CheckItem["type"]) =>
  rows.filter((row) => row.heldOut?.type === type).length;

const bank: Bank = {
  scope: bankScope,
  generatedFrom: {
    contentVersion: pilot.version,
    selectedEntries: selectedIds.length,
    selectedSenses: rows.length,
  },
  evidenceBoundary: {
    reservationRule:
      "The final authored check of each current A1 sense is reserved from normal teaching/practice and is the use item for delayed assessment.",
    armMeaning:
      "The bank is arm-invariant: enhanced and comparison study arms use the same version-bound held-out item source for the delayed use measure.",
    missingMeaning:
      "If a reserved item is unavailable or already exposed, assessment evidence is missing; it must not be replaced by an easier recognition item.",
    reviewMeaning:
      "Bank completeness is machine evidence only; it is not bilingual/pronunciation approval and does not prove learner effectiveness.",
  },
  summary: {
    entries: selectedIds.length,
    senses: rows.length,
    readySenses: rows.length - missing.length,
    missingSenses: missing.length,
    choice: typeCount("choice"),
    cloze: typeCount("cloze"),
    produce: typeCount("produce"),
  },
  missing,
  rows,
};

if (has("--check")) {
  if (bank.summary.missingSenses > 0) {
    fail(
      `A1 assessment bank incomplete: ${bank.summary.missingSenses}/${bank.summary.senses} selected sense(s) lack a reservable third authored check`,
    );
  }
  console.log(
    `A1 assessment bank OK: ${bankScope} ${bank.summary.entries} entries, ${bank.summary.senses} senses, all version-bound held-out items ready (choice ${bank.summary.choice}, cloze ${bank.summary.cloze}, produce ${bank.summary.produce}).`,
  );
  process.exit(0);
}

if (has("--json")) {
  console.log(JSON.stringify(bank, null, 2));
  process.exit(0);
}

console.log(
  `A1 assessment bank — ${bankScope} — content ${bank.generatedFrom.contentVersion}`,
);
console.log(
  `${bank.summary.entries} entries / ${bank.summary.senses} senses — ${bank.summary.readySenses} ready, ${bank.summary.missingSenses} missing`,
);
console.log(
  `held-out types: choice ${bank.summary.choice}, cloze ${bank.summary.cloze}, produce ${bank.summary.produce}`,
);
console.log("");
for (const row of rows) {
  console.log(
    [
      String(row.order).padStart(4, " "),
      row.entryId,
      row.senseId,
      row.heldOut?.type ?? "MISSING",
      row.heldOut?.id ?? "MISSING",
      row.assessmentToken ?? "MISSING",
    ].join("\t"),
  );
}
