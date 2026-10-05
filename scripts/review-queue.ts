import fs from "node:fs";
import path from "node:path";
import type { Pilot, Review } from "../src/lib/learn/content.ts";
import { review } from "../src/lib/learn/content.ts";

/**
 * Read-only editorial queue for version-bound A1 review.
 *
 * Examples:
 *   npm run content:review-queue
 *   npm run content:review-queue -- --scope pilot
 *   npm run content:review-queue -- --scope all-a1 --json
 *   npm run content:review-queue -- --unit 08-work-study
 *   npm run content:review-queue -- --scope calibration --limit 10
 *
 * This command never writes review.json and never changes release state.
 */

const ROOT = process.cwd();
const COMPILED = path.join(ROOT, "content", "compiled", "enhanced.json");
const LEDGER = path.join(ROOT, "content", "pilot", "review.json");
const AUDIO_REPORT = path.join(ROOT, "content", "pilot", "audio-report.json");
const PILOT_SELECTION = path.join(ROOT, "content", "pilot-a1.json");
const A1_PLAN = path.join(ROOT, "content", "plans", "A1.json");
const A1_CURRICULUM = path.join(ROOT, "content", "curriculum", "A1.json");

const SCOPES = ["calibration", "pilot", "all-a1"] as const;
type Scope = (typeof SCOPES)[number];
type QueueScope = Scope | `unit:${string}`;

type LedgerState = "missing" | "current" | "stale";

type AudioFlag = {
  sense: string;
  accent: "gb" | "us";
  kind: string;
  text: string;
  file: string;
  issues: string[];
};

type AudioReport = {
  flagged?: AudioFlag[];
};

type PilotSelection = {
  entries: { id: string }[];
};

type A1Plan = {
  level: string;
  batches: { id: string; entries: { id: string }[] }[];
};

type Curriculum = {
  level: string;
  calibrationSlice: { entries: string[] };
  units: { id: string; entries: { id: string }[] }[];
};

type ReviewRow = {
  order: number;
  id: string;
  headword: string;
  version: string;
  /** Exact provenance token required for approved/changes decisions. */
  approvalToken: string;
  released: boolean;
  curriculumUnit: string | null;
  ledgerState: LedgerState;
  ledgerVersion: string | null;
  currentReview: Review | null;
  staleReview: Review | null;
  bilingual: Review["bilingual"] | "pending";
  pronunciation: Review["pronunciation"] | "pending";
  audio: {
    requiredClips: number;
    presentClips: number;
    missingClips: number;
    complete: boolean;
  };
  flags: AudioFlag[];
  nextActions: string[];
};

type Queue = {
  scope: QueueScope;
  generatedFrom: {
    contentVersion: string;
    selectionEntries: number;
  };
  evidenceBoundary: {
    reviewAuthority: string;
    audioMeaning: string;
    flagMeaning: string;
  };
  summary: {
    entries: number;
    released: number;
    ledgerMissing: number;
    ledgerCurrent: number;
    ledgerStale: number;
    bilingualApproved: number;
    pronunciationApproved: number;
    fullyApproved: number;
    audioComplete: number;
    flaggedEntries: number;
    flaggedClips: number;
  };
  entries: ReviewRow[];
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
  fail("--unit cannot be combined with --scope; choose one review selection");
}
const rawScope = explicitScope ?? "calibration";
if (!SCOPES.includes(rawScope as Scope)) {
  fail(`--scope must be one of ${SCOPES.join(", ")}`);
}
const scope = rawScope as Scope;

const rawLimit = option("--limit");
const limit =
  rawLimit === undefined
    ? undefined
    : Number.isInteger(Number(rawLimit)) && Number(rawLimit) > 0
      ? Number(rawLimit)
      : fail("--limit must be a positive integer");

const pilot = read<Pilot>(COMPILED);
const curriculum = read<Curriculum>(A1_CURRICULUM);
const pilotSelection = read<PilotSelection>(PILOT_SELECTION);
const plan = read<A1Plan>(A1_PLAN);
const audioReport = fs.existsSync(AUDIO_REPORT)
  ? read<AudioReport>(AUDIO_REPORT)
  : { flagged: [] };

const ledgerRaw = fs.existsSync(LEDGER)
  ? read<Record<string, unknown>>(LEDGER)
  : {};

const ledger = new Map<string, Review>();
const invalidLedger: string[] = [];
for (const [id, raw] of Object.entries(ledgerRaw)) {
  const parsed = review.safeParse(raw);
  if (parsed.success) ledger.set(id, parsed.data);
  else invalidLedger.push(id);
}
if (invalidLedger.length) {
  fail(
    `content/pilot/review.json contains invalid record(s): ${invalidLedger.join(", ")}`,
  );
}

const byId = new Map(pilot.entries.map((entry) => [entry.id, entry]));
const senseToEntry = new Map<string, string>();
for (const entry of pilot.entries) {
  for (const sense of entry.senses) senseToEntry.set(sense.id, entry.id);
}

const unitByEntry = new Map<string, string>();
const unitById = new Map(curriculum.units.map((unit) => [unit.id, unit]));
for (const unit of curriculum.units) {
  for (const entry of unit.entries) unitByEntry.set(entry.id, unit.id);
}

const selectedUnit = rawUnit ? unitById.get(rawUnit) : undefined;
if (rawUnit && !selectedUnit) {
  fail(
    `unknown curriculum unit ${rawUnit}; choose one of ${curriculum.units
      .map((unit) => unit.id)
      .join(", ")}`,
  );
}

const queueScope: QueueScope = rawUnit ? `unit:${rawUnit}` : scope;
const selectedIds = rawUnit
  ? selectedUnit!.entries.map((entry) => entry.id)
  : scope === "calibration"
    ? curriculum.calibrationSlice.entries
    : scope === "pilot"
      ? pilotSelection.entries.map((entry) => entry.id)
      : curriculum.units.flatMap((unit) => unit.entries.map((entry) => entry.id));

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
      `all-a1 review queue must exactly match the A1 plan; ${missingFromCurriculum.length} missing and ${unknownInCurriculum.length} unknown curriculum id(s)`,
    );
  }
}

const duplicates = selectedIds.filter(
  (id, index) => selectedIds.indexOf(id) !== index,
);
if (duplicates.length) {
  fail(
    `${queueScope} selection contains duplicate ids: ${[...new Set(duplicates)].join(", ")}`,
  );
}

const missingContent = selectedIds.filter((id) => !byId.has(id));
if (missingContent.length) {
  fail(
    `${queueScope} selection contains ${missingContent.length} id(s) without compiled content: ${missingContent
      .slice(0, 10)
      .join(", ")}${missingContent.length > 10 ? ", …" : ""}`,
  );
}

const flagsByEntry = new Map<string, AudioFlag[]>();
for (const flag of audioReport.flagged ?? []) {
  const entryId = senseToEntry.get(flag.sense);
  if (!entryId) continue;
  const list = flagsByEntry.get(entryId) ?? [];
  list.push(flag);
  flagsByEntry.set(entryId, list);
}

function audioCoverage(
  entry: Pilot["entries"][number],
): ReviewRow["audio"] {
  let requiredClips = 0;
  let presentClips = 0;
  for (const sense of entry.senses) {
    for (const accent of ["gb", "us"] as const) {
      const clips = pilot.audio[sense.id]?.[accent];
      requiredClips += 1 + sense.examples.length;
      if (clips?.word) presentClips += 1;
      presentClips += (clips?.examples ?? []).filter(Boolean).length;
    }
  }
  const missingClips = Math.max(0, requiredClips - presentClips);
  return {
    requiredClips,
    presentClips,
    missingClips,
    complete: missingClips === 0,
  };
}

function actionsFor(
  ledgerState: LedgerState,
  current: Review | null,
  audio: ReviewRow["audio"],
  flags: AudioFlag[],
): string[] {
  const actions: string[] = [];
  if (ledgerState === "stale") actions.push("re-review-current-version");
  if (!current || current.bilingual === "pending") actions.push("bilingual-review");
  if (current?.bilingual === "changes") actions.push("fix-bilingual-content");
  if (!audio.complete) actions.push("restore-current-audio");
  if (flags.length) actions.push("listen-flagged-audio");
  if (!current || current.pronunciation === "pending")
    actions.push("pronunciation-review");
  if (current?.pronunciation === "changes")
    actions.push("fix-pronunciation-content");
  return actions;
}

const allRows: ReviewRow[] = selectedIds.map((id, index) => {
  const entry = byId.get(id)!;
  const stored = ledger.get(id) ?? null;
  const ledgerState: LedgerState =
    stored === null
      ? "missing"
      : stored.version === entry.version
        ? "current"
        : "stale";
  const currentReview = ledgerState === "current" ? stored : null;
  const staleReview = ledgerState === "stale" ? stored : null;
  const audio = audioCoverage(entry);
  const flags = flagsByEntry.get(id) ?? [];
  return {
    order: index + 1,
    id,
    headword: entry.headword,
    version: entry.version,
    approvalToken: `${id}@${entry.version}`,
    released: entry.released,
    curriculumUnit: unitByEntry.get(id) ?? null,
    ledgerState,
    ledgerVersion: stored?.version ?? null,
    currentReview,
    staleReview,
    bilingual: currentReview?.bilingual ?? "pending",
    pronunciation: currentReview?.pronunciation ?? "pending",
    audio,
    flags,
    nextActions: actionsFor(ledgerState, currentReview, audio, flags),
  };
});

const summary = {
  entries: allRows.length,
  released: allRows.filter((row) => row.released).length,
  ledgerMissing: allRows.filter((row) => row.ledgerState === "missing").length,
  ledgerCurrent: allRows.filter((row) => row.ledgerState === "current").length,
  ledgerStale: allRows.filter((row) => row.ledgerState === "stale").length,
  bilingualApproved: allRows.filter((row) => row.bilingual === "approved")
    .length,
  pronunciationApproved: allRows.filter(
    (row) => row.pronunciation === "approved",
  ).length,
  fullyApproved: allRows.filter(
    (row) =>
      row.bilingual === "approved" && row.pronunciation === "approved",
  ).length,
  audioComplete: allRows.filter((row) => row.audio.complete).length,
  flaggedEntries: allRows.filter((row) => row.flags.length > 0).length,
  flaggedClips: allRows.reduce((sum, row) => sum + row.flags.length, 0),
};

const queue: Queue = {
  scope: queueScope,
  generatedFrom: {
    contentVersion: pilot.version,
    selectionEntries: selectedIds.length,
  },
  evidenceBoundary: {
    reviewAuthority:
      "Only explicit version-matched records in content/pilot/review.json are approvals. This queue never creates or infers a review decision. Use each row's approvalToken when recording approved/changes decisions.",
    audioMeaning:
      "Complete audio means current files exist for every word and teaching example in both accents; it is not pronunciation approval.",
    flagMeaning:
      "An audio flag is a request for human listening, not an automatic failure or approval.",
  },
  summary,
  entries: limit ? allRows.slice(0, limit) : allRows,
};

if (has("--check")) {
  console.log(
    `Review queue OK: ${queueScope} ${summary.entries} entries; ${summary.audioComplete} full audio; ${summary.ledgerCurrent} current, ${summary.ledgerStale} stale and ${summary.ledgerMissing} missing review record(s).`,
  );
  process.exit(0);
}

if (has("--json")) {
  console.log(JSON.stringify(queue, null, 2));
  process.exit(0);
}

const rows = queue.entries.map((row) => [
  String(row.order),
  row.id,
  row.headword,
  row.version,
  row.ledgerState,
  row.bilingual,
  row.pronunciation,
  row.audio.complete
    ? `${row.audio.presentClips}/${row.audio.requiredClips}`
    : `${row.audio.presentClips}/${row.audio.requiredClips} !`,
  String(row.flags.length),
  row.released ? "yes" : "no",
  row.nextActions.join(","),
]);

const header = [
  "#",
  "Entry",
  "Headword",
  "Version",
  "Ledger",
  "Bilingual",
  "Pronunciation",
  "Audio",
  "Flags",
  "Released",
  "Next",
];
const table = [header, ...rows];
const widths = header.map((_, column) =>
  Math.max(...table.map((line) => line[column]!.length)),
);
for (const line of table) {
  console.log(
    line.map((cell, column) => cell.padEnd(widths[column]!)).join("  "),
  );
}
console.log(
  `\n${queueScope}: ${summary.entries} entries; ${summary.released} released; ${summary.ledgerCurrent} current, ${summary.ledgerStale} stale, ${summary.ledgerMissing} missing ledger record(s); ${summary.audioComplete} full audio; ${summary.flaggedClips} flagged clip(s) across ${summary.flaggedEntries} entries.`,
);
console.log(
  "Evidence boundary: this report is read-only. Only explicit version-matched human decisions in review.json can approve or release content.",
);
console.log(
  "For approved/changes decisions, pass the exact entry@version token shown by this queue and --reviewer; changes also require --notes.",
);
