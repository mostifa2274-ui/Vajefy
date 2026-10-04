import fs from "node:fs";
import path from "node:path";
import type { Pilot } from "../src/lib/learn/content.ts";

type CurriculumEntry = { id: string; prerequisites: string[] };
type Unit = {
  id: string;
  titleEn: string;
  titleFa: string;
  status: "calibration" | "planned" | "active" | "complete";
  objectiveEn: string;
  objectiveFa: string;
  entries: CurriculumEntry[];
};
type Curriculum = {
  version: number;
  level: "A1";
  /** Monotonic CI ratchet for curriculum coverage. */
  assignedMinimum?: number;
  units: Unit[];
  calibrationSlice: { unit: string; entries: string[] };
};
type Plan = { level: string; batches: { id: string; entries: { id: string; headword: string }[] }[] };
type AudioReport = { flagged?: { sense: string }[] };

const ROOT = process.cwd();
const CURRICULUM = path.join(ROOT, "content", "curriculum", "A1.json");
const PLAN = path.join(ROOT, "content", "plans", "A1.json");
const PILOT = path.join(ROOT, "content", "compiled", "enhanced.json");
const AUDIO_REPORT = path.join(ROOT, "content", "pilot", "audio-report.json");

function read<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

const curriculum = read<Curriculum>(CURRICULUM);
const plan = read<Plan>(PLAN);
const pilot = read<Pilot>(PILOT);
const audioReport = fs.existsSync(AUDIO_REPORT) ? read<AudioReport>(AUDIO_REPORT) : {};
const failures: string[] = [];

if (curriculum.version !== 1) failures.push("content/curriculum/A1.json: version must be 1");
if (curriculum.level !== "A1" || plan.level !== "A1") failures.push("curriculum and plan must both be A1");

const plannedRows = plan.batches.flatMap((batch) => batch.entries.map((entry) => ({ ...entry, batch: batch.id })));
const planned = new Map(plannedRows.map((entry) => [entry.id, entry]));
const compiled = new Map(pilot.entries.map((entry) => [entry.id, entry]));
const flagged = new Set((audioReport.flagged ?? []).map((row) => row.sense));
const unitIds = new Set<string>();
const assigned = new Map<string, string>();
const introduced = new Set<string>();

for (const unit of curriculum.units) {
  if (!/^\d{2}-[a-z0-9-]+$/.test(unit.id)) failures.push(`${unit.id}: unit id must start with a two-digit order`);
  if (unitIds.has(unit.id)) failures.push(`${unit.id}: duplicate unit id`);
  unitIds.add(unit.id);
  if (!unit.titleEn.trim() || !unit.titleFa.trim() || !unit.objectiveEn.trim() || !unit.objectiveFa.trim()) {
    failures.push(`${unit.id}: titles and objectives are required in both languages`);
  }

  for (const item of unit.entries) {
    if (!planned.has(item.id)) failures.push(`${unit.id}: unknown A1 entry ${item.id}`);
    const other = assigned.get(item.id);
    if (other) failures.push(`${item.id}: assigned to both ${other} and ${unit.id}`);
    else assigned.set(item.id, unit.id);

    const prereqs = new Set<string>();
    for (const prerequisite of item.prerequisites) {
      if (prereqs.has(prerequisite)) failures.push(`${item.id}: duplicate prerequisite ${prerequisite}`);
      prereqs.add(prerequisite);
      if (!planned.has(prerequisite)) failures.push(`${item.id}: unknown prerequisite ${prerequisite}`);
      if (!introduced.has(prerequisite)) {
        failures.push(`${item.id}: prerequisite ${prerequisite} must appear earlier in the curriculum`);
      }
    }
    introduced.add(item.id);
  }
}

const calibrationUnit = curriculum.units.find((unit) => unit.id === curriculum.calibrationSlice.unit);
if (!calibrationUnit) failures.push(`calibration unit ${curriculum.calibrationSlice.unit} does not exist`);
const calibrationIds = curriculum.calibrationSlice.entries;
if (calibrationIds.length !== 20) failures.push(`calibration slice must contain exactly 20 entries, found ${calibrationIds.length}`);
if (new Set(calibrationIds).size !== calibrationIds.length) failures.push("calibration slice contains duplicate entries");
if (calibrationUnit) {
  const unitEntries = calibrationUnit.entries.map((entry) => entry.id);
  if (JSON.stringify(unitEntries) !== JSON.stringify(calibrationIds)) {
    failures.push("calibration slice order must exactly match its unit entries");
  }
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

const calibration = calibrationIds.flatMap((id) => {
  const entry = compiled.get(id);
  if (!entry) {
    failures.push(`${id}: calibration entry has no enhanced content`);
    return [];
  }
  for (const sense of entry.senses) {
    if (sense.check.length < 3) {
      failures.push(`${sense.id}: calibration sense needs at least 3 checks (two lesson opportunities plus one held-out assessment)`);
    }
  }
  if (!audioComplete(entry)) failures.push(`${id}: calibration entry does not have complete current GB and US audio`);
  return [{
    id,
    headword: entry.headword,
    senses: entry.senses.length,
    version: entry.version,
    released: entry.released,
    fullAudio: audioComplete(entry),
    flaggedAudio: entry.senses.some((sense) => flagged.has(sense.id)),
    heldOutReady: entry.senses.every((sense) => sense.check.length >= 3),
  }];
});

const coverage = plannedRows.map((row) => {
  const entry = compiled.get(row.id);
  return {
    id: row.id,
    headword: row.headword,
    batch: row.batch,
    unit: assigned.get(row.id) ?? null,
    content: Boolean(entry),
    senses: entry?.senses.length ?? 0,
    released: entry?.released ?? false,
    fullAudio: entry ? audioComplete(entry) : false,
    flaggedAudio: entry?.senses.some((sense) => flagged.has(sense.id)) ?? false,
    heldOutReady: entry?.senses.every((sense) => sense.check.length >= 3) ?? false,
  };
});

const assignedMinimum = curriculum.assignedMinimum ?? 0;
const summary = {
  total: coverage.length,
  assignedMinimum,
  assigned: coverage.filter((row) => row.unit).length,
  unassigned: coverage.filter((row) => !row.unit).length,
  withContent: coverage.filter((row) => row.content).length,
  released: coverage.filter((row) => row.released).length,
  fullAudio: coverage.filter((row) => row.fullAudio).length,
  heldOutReady: coverage.filter((row) => row.heldOutReady).length,
  calibration: {
    entries: calibration.length,
    released: calibration.filter((row) => row.released).length,
    fullAudio: calibration.filter((row) => row.fullAudio).length,
    flaggedAudio: calibration.filter((row) => row.flaggedAudio).length,
    heldOutReady: calibration.filter((row) => row.heldOutReady).length,
  },
};

if (
  !Number.isInteger(assignedMinimum) ||
  assignedMinimum < 0 ||
  assignedMinimum > summary.total
) {
  failures.push(
    `assignedMinimum must be an integer from 0 to ${summary.total}`,
  );
} else if (summary.assigned < assignedMinimum) {
  failures.push(
    `A1 curriculum requires at least ${assignedMinimum} assigned entries, found ${summary.assigned}`,
  );
}

if (process.argv.includes("--complete") && summary.assigned !== summary.total) {
  failures.push(`A1 curriculum is not complete: ${summary.unassigned} of ${summary.total} entries remain unassigned`);
}

if (failures.length) {
  console.error(`A1 curriculum failed with ${failures.length} issue(s):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ summary, units: curriculum.units, calibration, coverage }, null, 2));
} else {
  console.log(
    `A1 curriculum OK: ${summary.assigned}/${summary.total} entries assigned (coverage ratchet ${summary.assignedMinimum}); ${summary.withContent} have enhanced content; ${summary.fullAudio} have complete audio; ${summary.heldOutReady} have >=3 checks per sense.`,
  );
  console.log(
    `Calibration slice: ${summary.calibration.entries}/20 structurally ready; ${summary.calibration.fullAudio}/20 full audio; ${summary.calibration.flaggedAudio} entries still have clips flagged for human listening; ${summary.calibration.released}/20 released.`,
  );
  if (summary.unassigned) console.log(`${summary.unassigned} A1 entries remain explicitly unassigned to curriculum units.`);
  if (summary.calibration.released < 20) {
    console.log("Human bilingual and pronunciation approvals are still required; this tool never creates them.");
  }
}
