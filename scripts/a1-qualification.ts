import fs from "node:fs";
import path from "node:path";
import type { Pilot, Review } from "../src/lib/learn/content.ts";
import { review } from "../src/lib/learn/content.ts";

/**
 * Read-only A1 unit qualification report.
 *
 * Examples:
 *   npm run content:qualification
 *   npm run content:qualification -- --unit 01-introductions
 *   npm run content:qualification -- --json
 *   npm run content:qualification -- --unit 01-introductions --require-ready
 *   npm run content:qualification -- --unit 01-introductions --require-qualified
 *
 * "Ready" means repository evidence is structurally ready for a human review.
 * "Qualified" additionally requires explicit current bilingual + pronunciation
 * approvals for every entry. This command never writes approvals or release
 * state.
 */

const ROOT = process.cwd();
const COMPILED = path.join(ROOT, "content", "compiled", "enhanced.json");
const CURRICULUM = path.join(ROOT, "content", "curriculum", "A1.json");
const LEDGER = path.join(ROOT, "content", "pilot", "review.json");
const AUDIO_REPORT = path.join(ROOT, "content", "pilot", "audio-report.json");

type Curriculum = {
  level: string;
  units: {
    id: string;
    titleEn: string;
    titleFa: string;
    status: string;
    targetEntries: number;
    entries: { id: string }[];
  }[];
};

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

type LedgerState = "missing" | "current" | "stale";

type UnitQualification = {
  id: string;
  titleEn: string;
  titleFa: string;
  status: string;
  targetEntries: number;
  assignedEntries: number;
  evidence: {
    content: {
      presentEntries: number;
      missingEntries: string[];
      complete: boolean;
    };
    heldOutAssessment: {
      totalSenses: number;
      readySenses: number;
      missingSenses: string[];
      readyEntries: number;
      complete: boolean;
    };
    audio: {
      completeEntries: number;
      incompleteEntries: string[];
      flaggedEntries: number;
      flaggedClips: number;
      complete: boolean;
    };
    review: {
      ledgerMissing: number;
      ledgerCurrent: number;
      ledgerStale: number;
      bilingualApproved: number;
      pronunciationApproved: number;
      fullyApproved: number;
    };
    release: {
      releasedEntries: number;
      unreleasedEntries: string[];
      complete: boolean;
    };
  };
  machineReadyForReview: boolean;
  releaseQualified: boolean;
  fullyReleased: boolean;
  blockers: string[];
  nextActions: string[];
};

type Report = {
  scope: "all-a1" | `unit:${string}`;
  generatedFrom: {
    contentVersion: string;
    selectedUnits: number;
    selectedEntries: number;
  };
  evidenceBoundary: {
    machineReadyMeaning: string;
    releaseQualifiedMeaning: string;
    audioFlagMeaning: string;
    releasedMeaning: string;
  };
  summary: {
    units: number;
    entries: number;
    machineReadyUnits: number;
    releaseQualifiedUnits: number;
    fullyReleasedUnits: number;
    currentReviewEntries: number;
    fullyApprovedEntries: number;
    releasedEntries: number;
  };
  units: UnitQualification[];
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

const pilot = read<Pilot>(COMPILED);
const curriculum = read<Curriculum>(CURRICULUM);
const audioReport = fs.existsSync(AUDIO_REPORT)
  ? read<AudioReport>(AUDIO_REPORT)
  : { flagged: [] };

if (curriculum.level !== "A1") fail("content/curriculum/A1.json must be A1");

const rawLedger = fs.existsSync(LEDGER)
  ? read<Record<string, unknown>>(LEDGER)
  : {};
const ledger = new Map<string, Review>();
const invalidLedger: string[] = [];
for (const [id, raw] of Object.entries(rawLedger)) {
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

const flagsByEntry = new Map<string, AudioFlag[]>();
for (const flag of audioReport.flagged ?? []) {
  const entryId = senseToEntry.get(flag.sense);
  if (!entryId) continue;
  const list = flagsByEntry.get(entryId) ?? [];
  list.push(flag);
  flagsByEntry.set(entryId, list);
}

const rawUnit = option("--unit");
const unitById = new Map(curriculum.units.map((unit) => [unit.id, unit]));
if (rawUnit && !unitById.has(rawUnit)) {
  fail(
    `unknown curriculum unit ${rawUnit}; choose one of ${curriculum.units
      .map((unit) => unit.id)
      .join(", ")}`,
  );
}
const selectedUnits = rawUnit
  ? [unitById.get(rawUnit)!]
  : curriculum.units;
const scope: Report["scope"] = rawUnit ? `unit:${rawUnit}` : "all-a1";

function ledgerState(
  id: string,
  version: string,
): { state: LedgerState; current: Review | null } {
  const stored = ledger.get(id);
  if (!stored) return { state: "missing", current: null };
  if (stored.version !== version) return { state: "stale", current: null };
  return { state: "current", current: stored };
}

function audioComplete(entry: Pilot["entries"][number]): boolean {
  return entry.senses.every((sense) => {
    const clips = pilot.audio[sense.id];
    return (["gb", "us"] as const).every((accent) => {
      const recorded = clips?.[accent];
      return Boolean(
        recorded?.word &&
          recorded.examples.length === sense.examples.length &&
          recorded.examples.every(Boolean),
      );
    });
  });
}

const duplicateAssignments = new Set<string>();
const seenAssignments = new Set<string>();
for (const unit of curriculum.units) {
  for (const item of unit.entries) {
    if (seenAssignments.has(item.id)) duplicateAssignments.add(item.id);
    seenAssignments.add(item.id);
  }
}
if (duplicateAssignments.size) {
  fail(
    `qualification report cannot run with duplicate curriculum assignment(s): ${[
      ...duplicateAssignments,
    ].join(", ")}`,
  );
}

const units: UnitQualification[] = selectedUnits.map((unit) => {
  const ids = unit.entries.map((item) => item.id);
  const missingEntries = ids.filter((id) => !byId.has(id));
  const entries = ids.flatMap((id) => {
    const entry = byId.get(id);
    return entry ? [entry] : [];
  });

  const missingSenses = entries.flatMap((entry) =>
    entry.senses
      .filter((sense) => sense.check.length < 3)
      .map((sense) => sense.id),
  );
  const totalSenses = entries.reduce(
    (sum, entry) => sum + entry.senses.length,
    0,
  );
  const readySenses = totalSenses - missingSenses.length;
  const readyEntries = entries.filter((entry) =>
    entry.senses.every((sense) => sense.check.length >= 3),
  ).length;

  const incompleteAudioEntries = entries
    .filter((entry) => !audioComplete(entry))
    .map((entry) => entry.id);
  const completeAudioEntries = entries.length - incompleteAudioEntries.length;
  const flaggedEntries = entries.filter(
    (entry) => (flagsByEntry.get(entry.id) ?? []).length > 0,
  ).length;
  const flaggedClips = entries.reduce(
    (sum, entry) => sum + (flagsByEntry.get(entry.id) ?? []).length,
    0,
  );

  let ledgerMissing = 0;
  let ledgerCurrent = 0;
  let ledgerStale = 0;
  let bilingualApproved = 0;
  let pronunciationApproved = 0;
  let fullyApproved = 0;

  for (const entry of entries) {
    const current = ledgerState(entry.id, entry.version);
    if (current.state === "missing") ledgerMissing += 1;
    else if (current.state === "stale") ledgerStale += 1;
    else ledgerCurrent += 1;

    if (current.current?.bilingual === "approved") bilingualApproved += 1;
    if (current.current?.pronunciation === "approved")
      pronunciationApproved += 1;
    if (
      current.current?.bilingual === "approved" &&
      current.current?.pronunciation === "approved"
    ) {
      fullyApproved += 1;
    }
  }

  const releasedEntries = entries.filter((entry) => entry.released).length;
  const unreleasedEntries = entries
    .filter((entry) => !entry.released)
    .map((entry) => entry.id);

  const assignmentComplete =
    unit.entries.length === unit.targetEntries &&
    unit.targetEntries > 0;
  const contentComplete =
    missingEntries.length === 0 && entries.length === unit.entries.length;
  const heldOutComplete =
    missingSenses.length === 0 && totalSenses > 0;
  const audioIsComplete =
    incompleteAudioEntries.length === 0 && entries.length === unit.entries.length;
  const machineReadyForReview =
    assignmentComplete &&
    contentComplete &&
    heldOutComplete &&
    audioIsComplete;
  const humanReviewComplete =
    entries.length === unit.entries.length &&
    fullyApproved === unit.entries.length;
  const releaseQualified = machineReadyForReview && humanReviewComplete;
  const fullyReleased =
    entries.length === unit.entries.length &&
    releasedEntries === unit.entries.length;

  const blockers: string[] = [];
  if (!assignmentComplete)
    blockers.push(
      `assignment:${unit.entries.length}/${unit.targetEntries}`,
    );
  if (!contentComplete)
    blockers.push(`missing-content:${missingEntries.length}`);
  if (!heldOutComplete)
    blockers.push(`held-out-assessment:${missingSenses.length}`);
  if (!audioIsComplete)
    blockers.push(`audio-assets:${incompleteAudioEntries.length}`);
  if (bilingualApproved < unit.entries.length)
    blockers.push(
      `bilingual-review:${unit.entries.length - bilingualApproved}`,
    );
  if (pronunciationApproved < unit.entries.length)
    blockers.push(
      `pronunciation-review:${unit.entries.length - pronunciationApproved}`,
    );

  const nextActions: string[] = [];
  if (!assignmentComplete) nextActions.push("complete-unit-assignment");
  if (!contentComplete) nextActions.push("restore-enhanced-content");
  if (!heldOutComplete) nextActions.push("author-held-out-assessment");
  if (!audioIsComplete) nextActions.push("restore-current-audio");
  if (flaggedClips > 0 && pronunciationApproved < unit.entries.length)
    nextActions.push("listen-flagged-audio");
  if (bilingualApproved < unit.entries.length)
    nextActions.push("bilingual-review");
  if (pronunciationApproved < unit.entries.length)
    nextActions.push("pronunciation-review");
  if (releaseQualified && !fullyReleased)
    nextActions.push("rebuild-released-content");

  return {
    id: unit.id,
    titleEn: unit.titleEn,
    titleFa: unit.titleFa,
    status: unit.status,
    targetEntries: unit.targetEntries,
    assignedEntries: unit.entries.length,
    evidence: {
      content: {
        presentEntries: entries.length,
        missingEntries,
        complete: contentComplete,
      },
      heldOutAssessment: {
        totalSenses,
        readySenses,
        missingSenses,
        readyEntries,
        complete: heldOutComplete,
      },
      audio: {
        completeEntries: completeAudioEntries,
        incompleteEntries: incompleteAudioEntries,
        flaggedEntries,
        flaggedClips,
        complete: audioIsComplete,
      },
      review: {
        ledgerMissing,
        ledgerCurrent,
        ledgerStale,
        bilingualApproved,
        pronunciationApproved,
        fullyApproved,
      },
      release: {
        releasedEntries,
        unreleasedEntries,
        complete: fullyReleased,
      },
    },
    machineReadyForReview,
    releaseQualified,
    fullyReleased,
    blockers,
    nextActions,
  };
});

const summary: Report["summary"] = {
  units: units.length,
  entries: units.reduce((sum, unit) => sum + unit.assignedEntries, 0),
  machineReadyUnits: units.filter((unit) => unit.machineReadyForReview).length,
  releaseQualifiedUnits: units.filter((unit) => unit.releaseQualified).length,
  fullyReleasedUnits: units.filter((unit) => unit.fullyReleased).length,
  currentReviewEntries: units.reduce(
    (sum, unit) => sum + unit.evidence.review.ledgerCurrent,
    0,
  ),
  fullyApprovedEntries: units.reduce(
    (sum, unit) => sum + unit.evidence.review.fullyApproved,
    0,
  ),
  releasedEntries: units.reduce(
    (sum, unit) => sum + unit.evidence.release.releasedEntries,
    0,
  ),
};

const report: Report = {
  scope,
  generatedFrom: {
    contentVersion: pilot.version,
    selectedUnits: units.length,
    selectedEntries: summary.entries,
  },
  evidenceBoundary: {
    machineReadyMeaning:
      "Machine-ready means the unit target is filled, current enhanced content exists, every current sense has at least three authored checks so one can remain held out, and all current GB/US word/example audio assets exist. It is not human approval or learner-outcome evidence.",
    releaseQualifiedMeaning:
      "Release-qualified additionally requires explicit version-matched bilingual and pronunciation approvals for every entry. This command never creates those approvals.",
    audioFlagMeaning:
      "An automated audio flag requests human listening. It is reported but is not independently treated as approval or rejection; the explicit current pronunciation review remains authoritative.",
    releasedMeaning:
      "Released reports the current compiled build state. A release-qualified unit can still need a rebuild before all entries appear in the released channel.",
  },
  summary,
  units,
};

if (has("--check")) {
  console.log(
    `A1 qualification report OK: ${summary.entries} entries across ${summary.units} unit(s); ${summary.machineReadyUnits} machine-ready, ${summary.releaseQualifiedUnits} release-qualified, ${summary.fullyReleasedUnits} fully released.`,
  );
  process.exit(0);
}

if (has("--require-ready")) {
  const blocked = units.filter((unit) => !unit.machineReadyForReview);
  if (blocked.length) {
    fail(
      `A1 unit(s) not machine-ready for human review: ${blocked
        .map((unit) => `${unit.id} [${unit.blockers.join(", ")}]`)
        .join("; ")}`,
    );
  }
}

if (has("--require-qualified")) {
  const blocked = units.filter((unit) => !unit.releaseQualified);
  if (blocked.length) {
    fail(
      `A1 unit(s) not release-qualified: ${blocked
        .map((unit) => `${unit.id} [${unit.blockers.join(", ")}]`)
        .join("; ")}`,
    );
  }
}

if (has("--json")) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const header = [
  "Unit",
  "Assigned",
  "Content",
  "Held-out",
  "Audio",
  "Current review",
  "Fully approved",
  "Released",
  "Machine ready",
  "Qualified",
  "Next",
];
const rows = units.map((unit) => [
  unit.id,
  `${unit.assignedEntries}/${unit.targetEntries}`,
  `${unit.evidence.content.presentEntries}/${unit.assignedEntries}`,
  `${unit.evidence.heldOutAssessment.readySenses}/${unit.evidence.heldOutAssessment.totalSenses}`,
  `${unit.evidence.audio.completeEntries}/${unit.assignedEntries}`,
  `${unit.evidence.review.ledgerCurrent}/${unit.assignedEntries}`,
  `${unit.evidence.review.fullyApproved}/${unit.assignedEntries}`,
  `${unit.evidence.release.releasedEntries}/${unit.assignedEntries}`,
  unit.machineReadyForReview ? "yes" : "no",
  unit.releaseQualified ? "yes" : "no",
  unit.nextActions.join(","),
]);
const table = [header, ...rows];
const widths = header.map((_, column) =>
  Math.max(...table.map((row) => row[column]!.length)),
);
for (const row of table) {
  console.log(
    row.map((cell, column) => cell.padEnd(widths[column]!)).join("  "),
  );
}
console.log(
  `\n${scope}: ${summary.entries} entries; ${summary.machineReadyUnits}/${summary.units} unit(s) machine-ready; ${summary.releaseQualifiedUnits}/${summary.units} release-qualified; ${summary.fullyReleasedUnits}/${summary.units} fully released.`,
);
console.log(
  "Evidence boundary: automated readiness never substitutes for explicit version-matched bilingual and pronunciation review.",
);
