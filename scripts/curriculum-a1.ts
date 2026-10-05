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
  /** Final number of A1 entries this unit must contain when the curriculum is complete. */
  targetEntries: number;
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
const curriculumEntries = new Map<string, CurriculumEntry>();
const introductions = new Map<
  string,
  { unit: string; unitOrder: number; entryOrder: number; curriculumOrder: number }
>();
const introduced = new Set<string>();
let curriculumOrder = 0;

for (const [unitIndex, unit] of curriculum.units.entries()) {
  if (!/^\d{2}-[a-z0-9-]+$/.test(unit.id)) failures.push(`${unit.id}: unit id must start with a two-digit order`);
  if (unitIds.has(unit.id)) failures.push(`${unit.id}: duplicate unit id`);
  unitIds.add(unit.id);
  if (!unit.titleEn.trim() || !unit.titleFa.trim() || !unit.objectiveEn.trim() || !unit.objectiveFa.trim()) {
    failures.push(`${unit.id}: titles and objectives are required in both languages`);
  }
  if (!Number.isInteger(unit.targetEntries) || unit.targetEntries <= 0) {
    failures.push(`${unit.id}: targetEntries must be a positive integer`);
  } else if (unit.entries.length > unit.targetEntries) {
    failures.push(
      `${unit.id}: has ${unit.entries.length} entries but targetEntries is ${unit.targetEntries}`,
    );
  }
  if (unit.status === "complete" && unit.entries.length !== unit.targetEntries) {
    failures.push(
      `${unit.id}: status complete requires exactly ${unit.targetEntries} entries, found ${unit.entries.length}`,
    );
  }

  for (const [entryIndex, item] of unit.entries.entries()) {
    curriculumOrder += 1;
    if (!planned.has(item.id)) failures.push(`${unit.id}: unknown A1 entry ${item.id}`);
    const other = assigned.get(item.id);
    if (other) failures.push(`${item.id}: assigned to both ${other} and ${unit.id}`);
    else {
      assigned.set(item.id, unit.id);
      curriculumEntries.set(item.id, item);
      introductions.set(item.id, {
        unit: unit.id,
        unitOrder: unitIndex + 1,
        entryOrder: entryIndex + 1,
        curriculumOrder,
      });
    }

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
  if (calibrationUnit.targetEntries !== calibrationIds.length) {
    failures.push(
      `calibration unit targetEntries must equal the fixed slice length ${calibrationIds.length}, found ${calibrationUnit.targetEntries}`,
    );
  }
}

const targetTotal = curriculum.units.reduce(
  (sum, unit) =>
    sum +
    (Number.isInteger(unit.targetEntries) && unit.targetEntries > 0
      ? unit.targetEntries
      : 0),
  0,
);
if (targetTotal !== plannedRows.length) {
  failures.push(
    `A1 unit targetEntries must sum to the canonical plan size ${plannedRows.length}, found ${targetTotal}`,
  );
}

const unitTargets = curriculum.units.map((unit) => ({
  id: unit.id,
  status: unit.status,
  target: unit.targetEntries,
  assigned: unit.entries.length,
  remaining: Math.max(0, unit.targetEntries - unit.entries.length),
}));

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

const senseOwners = new Map<string, string>();
for (const entry of pilot.entries) {
  for (const sense of entry.senses) senseOwners.set(sense.id, entry.id);
}

function entryForTarget(target: string): string | null {
  return senseOwners.get(target) ?? (planned.has(target) ? target : null);
}

function listeningFor(
  sense: Pilot["entries"][number]["senses"][number],
  accent: "gb" | "us",
) {
  const recorded = pilot.audio[sense.id]?.[accent];
  const examples = sense.examples.length;
  const exampleClips = recorded?.examples.filter(Boolean).length ?? 0;
  return {
    word: Boolean(recorded?.word),
    exampleClips,
    examples,
    complete: Boolean(
      recorded?.word &&
      recorded.examples.length === examples &&
      recorded.examples.every(Boolean),
    ),
  };
}

function resourceRecyclesLater(
  targets: string[],
  senseId: string,
  introduction: { curriculumOrder: number } | null,
): boolean {
  if (!introduction || !targets.includes(senseId)) return false;
  return targets.some((target) => {
    const entryId = entryForTarget(target);
    const targetIntroduction = entryId ? introductions.get(entryId) : null;
    return Boolean(
      targetIntroduction &&
      targetIntroduction.curriculumOrder > introduction.curriculumOrder,
    );
  });
}

const senseCoverage = pilot.entries.filter((entry) => planned.has(entry.id)).flatMap((entry) =>
  entry.senses.map((sense) => {
    const introduction = introductions.get(entry.id) ?? null;
    const lessonChecks = sense.check.slice(0, -1).map(({ id, type }) => ({ id, type }));
    const heldOut = sense.check[sense.check.length - 1];
    const scenes = pilot.scenes
      .filter((scene) => scene.targets.includes(sense.id))
      .map((scene) => scene.id);
    const contrasts = pilot.contrasts
      .filter((contrast) => contrast.entries.includes(sense.id))
      .map((contrast) => contrast.id);
    const laterScenes = pilot.scenes
      .filter((scene) => resourceRecyclesLater(scene.targets, sense.id, introduction))
      .map((scene) => scene.id);
    const laterContrasts = pilot.contrasts
      .filter((contrast) => resourceRecyclesLater(contrast.entries, sense.id, introduction))
      .map((contrast) => contrast.id);
    const gb = listeningFor(sense, "gb");
    const us = listeningFor(sense, "us");
    const heldOutReady = sense.check.length >= 3;
    const productiveLessonCheck = lessonChecks.some(
      (check) => check.type === "cloze" || check.type === "produce",
    );
    const gaps: string[] = [];

    if (!introduction) gaps.push("not-introduced-in-curriculum");
    if (!gb.complete) gaps.push("incomplete-gb-audio");
    if (!us.complete) gaps.push("incomplete-us-audio");
    if (flagged.has(sense.id)) gaps.push("audio-awaiting-human-listening");
    if (!heldOutReady) gaps.push("insufficient-authored-checks");
    if (!productiveLessonCheck) gaps.push("no-productive-lesson-check");
    if (scenes.length === 0 && contrasts.length === 0) {
      gaps.push("no-scene-or-contrast-practice");
    }
    if (laterScenes.length === 0 && laterContrasts.length === 0) {
      gaps.push("no-later-recycling-candidate");
    }
    if (!entry.review) gaps.push("human-review-unrecorded");
    else {
      if (entry.review.bilingual !== "approved") {
        gaps.push(`bilingual-review-${entry.review.bilingual}`);
      }
      if (entry.review.pronunciation !== "approved") {
        gaps.push(`pronunciation-review-${entry.review.pronunciation}`);
      }
    }

    return {
      entryId: entry.id,
      headword: entry.headword,
      senseId: sense.id,
      pos: sense.pos,
      gloss: sense.gloss,
      batch: planned.get(entry.id)?.batch ?? null,
      introduction,
      learningDependencies: {
        prerequisiteEntries: curriculumEntries.get(entry.id)?.prerequisites ?? [],
        authoredGrammarPatterns: sense.grammar?.map((item) => item.pattern) ?? [],
      },
      listening: {
        gb,
        us,
        complete: gb.complete && us.complete,
        flaggedForHumanListening: flagged.has(sense.id),
      },
      contextualPractice: {
        lessonChecks,
        productiveLessonCheck,
        scenes,
        contrasts,
      },
      laterRecyclingCandidates: {
        basis: "later-introduced-co-target" as const,
        scenes: laterScenes,
        contrasts: laterContrasts,
      },
      assessment: {
        reservedCheck: heldOut ? { id: heldOut.id, type: heldOut.type } : null,
        authoredChecks: sense.check.length,
        lessonOpportunities: lessonChecks.length,
        heldOutReady,
      },
      content: {
        version: entry.version,
        released: entry.released,
        review: entry.review ?? null,
      },
      gaps,
    };
  }),
);

const assignedMinimum = curriculum.assignedMinimum ?? 0;
const summary = {
  total: coverage.length,
  targetTotal,
  targetRemaining: unitTargets.reduce((sum, unit) => sum + unit.remaining, 0),
  assignedMinimum,
  assigned: coverage.filter((row) => row.unit).length,
  unassigned: coverage.filter((row) => !row.unit).length,
  withContent: coverage.filter((row) => row.content).length,
  released: coverage.filter((row) => row.released).length,
  fullAudio: coverage.filter((row) => row.fullAudio).length,
  heldOutReady: coverage.filter((row) => row.heldOutReady).length,
  senses: {
    total: senseCoverage.length,
    introduced: senseCoverage.filter((row) => row.introduction).length,
    completeListeningAssets: senseCoverage.filter((row) => row.listening.complete).length,
    introducedWithCompleteListeningAssets: senseCoverage.filter(
      (row) => row.introduction && row.listening.complete,
    ).length,
    productiveLessonPractice: senseCoverage.filter(
      (row) => row.contextualPractice.productiveLessonCheck,
    ).length,
    introducedWithProductiveLessonPractice: senseCoverage.filter(
      (row) => row.introduction && row.contextualPractice.productiveLessonCheck,
    ).length,
    withContextualPractice: senseCoverage.filter(
      (row) =>
        row.contextualPractice.scenes.length > 0 ||
        row.contextualPractice.contrasts.length > 0,
    ).length,
    introducedWithContextualPractice: senseCoverage.filter(
      (row) =>
        row.introduction &&
        (row.contextualPractice.scenes.length > 0 ||
          row.contextualPractice.contrasts.length > 0),
    ).length,
    introducedWithLaterRecyclingCandidate: senseCoverage.filter(
      (row) =>
        row.introduction &&
        (row.laterRecyclingCandidates.scenes.length > 0 ||
          row.laterRecyclingCandidates.contrasts.length > 0),
    ).length,
    heldOutReady: senseCoverage.filter((row) => row.assessment.heldOutReady).length,
    introducedHeldOutReady: senseCoverage.filter(
      (row) => row.introduction && row.assessment.heldOutReady,
    ).length,
    released: senseCoverage.filter((row) => row.content.released).length,
    bilingualApproved: senseCoverage.filter(
      (row) => row.content.review?.bilingual === "approved",
    ).length,
    pronunciationApproved: senseCoverage.filter(
      (row) => row.content.review?.pronunciation === "approved",
    ).length,
    withoutReportedGaps: senseCoverage.filter((row) => row.gaps.length === 0).length,
  },
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

const balancedWaveFloor = new Map<number, number>([
  [240, 20],
  [460, 40],
  [680, 60],
  [900, 80],
]).get(assignedMinimum);

if (balancedWaveFloor) {
  for (const unit of unitTargets) {
    const floor = unit.id === curriculum.calibrationSlice.unit ? 20 : balancedWaveFloor;
    if (unit.assigned < floor) {
      failures.push(
        `${unit.id}: balanced A1 wave at ${assignedMinimum} requires at least ${floor} assigned entries, found ${unit.assigned}`,
      );
    }
  }
}

if (process.argv.includes("--complete")) {
  if (summary.assigned !== summary.total) {
    failures.push(
      `A1 curriculum is not complete: ${summary.unassigned} of ${summary.total} entries remain unassigned`,
    );
  }
  const incompleteUnits = unitTargets.filter(
    (unit) => unit.assigned !== unit.target,
  );
  if (incompleteUnits.length) {
    failures.push(
      `A1 curriculum unit targets are not complete: ${incompleteUnits
        .map((unit) => `${unit.id} ${unit.assigned}/${unit.target}`)
        .join(", ")}`,
    );
  }
}

if (failures.length) {
  console.error(`A1 curriculum failed with ${failures.length} issue(s):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({
    summary,
    evidenceBoundary: {
      structuralOnly: true,
      humanApprovalInferred: false,
      learnerEffectivenessInferred: false,
      resourceTimingInferred: false,
      senseIntroductionBasis: "entry",
      reviewScope: "entry",
      note: "This matrix reports repository evidence and explicit review state; it does not create human approval or learner-outcome evidence.",
    },
    units: curriculum.units,
    unitTargets,
    calibration,
    coverage,
    senseCoverage,
  }, null, 2));
} else {
  console.log(
    `A1 curriculum OK: ${summary.assigned}/${summary.total} entries assigned (coverage ratchet ${summary.assignedMinimum}); final unit targets ${summary.targetTotal}; ${summary.withContent} have enhanced content; ${summary.fullAudio} have complete audio; ${summary.heldOutReady} have >=3 checks per sense.`,
  );
  console.log(
    `Unit targets: ${unitTargets
      .map((unit) => `${unit.id} ${unit.assigned}/${unit.target}`)
      .join("; ")}. ${summary.targetRemaining} target slot(s) remain.`,
  );
  console.log(
    `Calibration slice: ${summary.calibration.entries}/20 structurally ready; ${summary.calibration.fullAudio}/20 full audio; ${summary.calibration.flaggedAudio} entries still have clips flagged for human listening; ${summary.calibration.released}/20 released.`,
  );
  console.log(
    `Sense evidence: ${summary.senses.introduced}/${summary.senses.total} introduced; ${summary.senses.introducedWithContextualPractice}/${summary.senses.introduced} introduced senses have a scene or contrast; ${summary.senses.introducedWithLaterRecyclingCandidate}/${summary.senses.introduced} have a later co-target recycling candidate; ${summary.senses.introducedHeldOutReady}/${summary.senses.introduced} have a reserved assessment after at least two lesson checks.`,
  );
  if (summary.unassigned) console.log(`${summary.unassigned} A1 entries remain explicitly unassigned to curriculum units.`);
  if (summary.calibration.released < 20) {
    console.log("Human bilingual and pronunciation approvals are still required; this tool never creates them.");
  }
}
