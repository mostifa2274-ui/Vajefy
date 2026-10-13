import { z } from "zod";

export const CEFRJ_CURRICULUM_STATUS = "STAGING_ONLY_UNREVIEWED_CURRICULUM_PROPOSAL" as const;

const text = z.string().trim().min(1);
const placed = z.object({ headword: text, id: text, prerequisites: z.array(text) }).strict();
/**
 * A retained entry taught earlier: it moves to an earlier unit, after that
 * unit's NEW start entries, or directly after `after`, a retained entry of
 * that unit. `dropPrerequisites` names the prerequisites it no longer waits
 * for (thematic ones that would now come after it).
 */
const promotion = z.object({ id: text, unit: text, after: text.optional(), dropPrerequisites: z.array(text) }).strict();
export const cefrjCurriculumAssignments = z.object({
  schemaVersion: z.literal(1),
  status: z.literal(CEFRJ_CURRICULUM_STATUS),
  description: text,
  units: z.array(z.object({ unit: text, start: z.array(placed), end: z.array(placed) }).strict()).min(1),
  promotions: z.array(promotion).optional(),
}).strict();
export type CefrjCurriculumAssignments = z.infer<typeof cefrjCurriculumAssignments>;

export type CurriculumEntry = { id: string; prerequisites: string[] };
export type CurriculumUnit = {
  id: string; titleEn: string; titleFa: string; status: string;
  objectiveEn: string; objectiveFa: string; targetEntries: number; entries: CurriculumEntry[];
};
export type Curriculum = {
  version: number; level: string; assignedMinimum?: number; units: CurriculumUnit[];
  calibrationSlice: { unit: string; entries: string[] };
};
/** A NEW headword's drafted entry, from the lessons-new-*.json batches. */
export type DraftedEntry = { headword: string; id: string };
/** A current A1 entry that CEFR-J places above A1 (`movedUp` in the A1 selection). */
export type MovedUpEntry = { entryId: string; headword: string; cefrjLevel: string };

export type StagedCurriculum = {
  curriculum: Curriculum;
  removed: { id: string; headword: string; fromUnit: string; toLevel: string }[];
  droppedPrerequisites: { id: string; prerequisite: string; reason?: "promoted" }[];
  promoted: { id: string; fromUnit: string; toUnit: string }[];
  counts: {
    units: number; entries: number; retained: number; added: number; removed: number;
    promoted: number; droppedPrerequisites: number;
  };
};

/**
 * Compose the staged CEFR-J A1 curriculum: keep every current A1 entry that
 * CEFR-J also grades A1, in its unit and order unless the assignments promote
 * it to an earlier unit; remove the entries it places higher; and add each
 * drafted NEW entry where the assignments put it. Entry
 * IDs never change, so learner progress keyed by ID is untouched.
 * Structural checks only: passing is not pedagogical or semantic approval.
 */
export function buildCefrjA1Curriculum(input: {
  current: Curriculum;
  assignments: unknown;
  drafted: DraftedEntry[];
  movedUp: MovedUpEntry[];
}): { staged: StagedCurriculum | null; issues: string[] } {
  const issues: string[] = [];
  const parsed = cefrjCurriculumAssignments.safeParse(input.assignments);
  if (!parsed.success) return { staged: null, issues: parsed.error.issues.map(x => x.path.join(".") + ": " + x.message) };
  const plan = parsed.data;
  const { current } = input;

  const leaving = new Map(input.movedUp.map(x => [x.entryId, x]));
  const currentIds = new Set(current.units.flatMap(u => u.entries.map(e => e.id)));
  for (const id of leaving.keys()) if (!currentIds.has(id)) issues.push(`${id}: moved-up entry is not in the current curriculum`);

  const drafted = new Map(input.drafted.map(x => [x.id, x]));
  if (drafted.size !== input.drafted.length) issues.push("drafted NEW entries repeat an entry ID");
  const placedIds = new Map<string, string>();
  const byUnit = new Map(plan.units.map(x => [x.unit, x]));
  if (byUnit.size !== plan.units.length) issues.push("a unit is listed twice in the assignments");
  for (const unit of plan.units) {
    if (!current.units.some(u => u.id === unit.unit)) issues.push(`${unit.unit}: assignments name an unknown unit`);
    if (unit.unit === current.calibrationSlice.unit && (unit.start.length || unit.end.length)) {
      issues.push(`${unit.unit}: the calibration unit is fixed and takes no new entries`);
    }
    for (const item of [...unit.start, ...unit.end]) {
      const draft = drafted.get(item.id);
      if (!draft) issues.push(`${item.id}: assigned entry is not a drafted NEW headword`);
      else if (draft.headword !== item.headword) issues.push(`${item.id}: headword ${item.headword} does not match draft ${draft.headword}`);
      if (currentIds.has(item.id)) issues.push(`${item.id}: a NEW entry must not reuse a current A1 curriculum ID`);
      if (placedIds.has(item.id)) issues.push(`${item.id}: assigned to both ${placedIds.get(item.id)} and ${unit.unit}`);
      placedIds.set(item.id, unit.unit);
    }
  }
  for (const id of drafted.keys()) if (!placedIds.has(id)) issues.push(`${id}: drafted NEW entry has no unit`);

  const unitIndex = new Map(current.units.map((u, i) => [u.id, i]));
  const homeUnit = new Map(current.units.flatMap(u => u.entries.map(e => [e.id, u.id] as const)));
  const promotions = new Map<string, { unit: string; after?: string; drop: Set<string> }>();
  for (const item of plan.promotions ?? []) {
    const from = homeUnit.get(item.id);
    const target = unitIndex.get(item.unit);
    if (promotions.has(item.id)) issues.push(`${item.id}: promoted twice`);
    if (!from || leaving.has(item.id)) issues.push(`${item.id}: only a retained current A1 entry can be promoted`);
    else if (target === undefined) issues.push(`${item.id}: promotion names an unknown unit ${item.unit}`);
    else if (item.unit === current.calibrationSlice.unit) issues.push(`${item.id}: the calibration unit is fixed and takes no promoted entries`);
    else if (target >= unitIndex.get(from)!) issues.push(`${item.id}: a promotion must move to an earlier unit than ${from}`);
    const entry = current.units.flatMap(u => u.entries).find(e => e.id === item.id);
    for (const p of item.dropPrerequisites) {
      if (!entry?.prerequisites.includes(p)) issues.push(`${item.id}: cannot drop ${p}, which is not its prerequisite`);
    }
    if (item.after !== undefined) {
      if (homeUnit.get(item.after) !== item.unit || leaving.has(item.after) || (plan.promotions ?? []).some(p => p.id === item.after)) {
        issues.push(`${item.id}: after ${item.after} must name a retained entry that stays in ${item.unit}`);
      }
    }
    promotions.set(item.id, { unit: item.unit, after: item.after, drop: new Set(item.dropPrerequisites) });
  }
  const promoted: StagedCurriculum["promoted"] = [];

  const removed: StagedCurriculum["removed"] = [];
  const droppedPrerequisites: StagedCurriculum["droppedPrerequisites"] = [];
  const introduced = new Set<string>();
  const known = new Set([...currentIds].filter(id => !leaving.has(id)).concat([...placedIds.keys()]));
  let retained = 0;
  let added = 0;
  const keptBy = new Map<string, CurriculumEntry[]>(current.units.map(u => [u.id, []]));
  const promotedTo = new Map<string, CurriculumEntry[]>(current.units.map(u => [u.id, []]));
  for (const unit of current.units) {
    for (const entry of unit.entries) {
      const move = leaving.get(entry.id);
      if (move) {
        removed.push({ id: entry.id, headword: move.headword, fromUnit: unit.id, toLevel: move.cefrjLevel });
        continue;
      }
      const promotion = promotions.get(entry.id);
      const prerequisites = entry.prerequisites.filter(p => {
        if (leaving.has(p)) {
          droppedPrerequisites.push({ id: entry.id, prerequisite: p });
          return false;
        }
        if (promotion?.drop.has(p)) {
          droppedPrerequisites.push({ id: entry.id, prerequisite: p, reason: "promoted" });
          return false;
        }
        return true;
      });
      if (promotion && unitIndex.has(promotion.unit)) {
        promoted.push({ id: entry.id, fromUnit: unit.id, toUnit: promotion.unit });
        promotedTo.get(promotion.unit)!.push({ id: entry.id, prerequisites });
      } else keptBy.get(unit.id)!.push({ id: entry.id, prerequisites });
      retained += 1;
    }
  }
  // Promoted entries keep the order the assignments list them in.
  const order = new Map((plan.promotions ?? []).map((p, i) => [p.id, i]));
  for (const list of promotedTo.values()) list.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  const units = current.units.map(unit => {
    const assigned = byUnit.get(unit.id);
    const fresh = (items: { id: string; prerequisites: string[] }[]) =>
      items.map(item => ({ id: item.id, prerequisites: [...item.prerequisites] }));
    // Promoted entries without an anchor open the unit; anchored ones follow their anchor.
    const middle: CurriculumEntry[] = promotedTo.get(unit.id)!.filter(e => !promotions.get(e.id)!.after);
    for (const entry of keptBy.get(unit.id)!) {
      middle.push(entry);
      middle.push(...promotedTo.get(unit.id)!.filter(e => promotions.get(e.id)!.after === entry.id));
    }
    const entries = [...fresh(assigned?.start ?? []), ...middle, ...fresh(assigned?.end ?? [])];
    added += (assigned?.start.length ?? 0) + (assigned?.end.length ?? 0);
    for (const entry of entries) {
      const seen = new Set<string>();
      for (const p of entry.prerequisites) {
        if (seen.has(p)) issues.push(`${entry.id}: duplicate prerequisite ${p}`);
        seen.add(p);
        if (!known.has(p)) issues.push(`${entry.id}: prerequisite ${p} is not in the staged A1 curriculum`);
        else if (!introduced.has(p)) issues.push(`${entry.id}: prerequisite ${p} must appear earlier`);
      }
      introduced.add(entry.id);
    }
    return { ...unit, targetEntries: entries.length, entries };
  });

  const calibration = units.find(u => u.id === current.calibrationSlice.unit);
  if (!calibration || JSON.stringify(calibration.entries.map(e => e.id)) !== JSON.stringify(current.calibrationSlice.entries)) {
    issues.push("the calibration slice must stay exactly as it is");
  }
  const total = units.reduce((n, u) => n + u.entries.length, 0);
  if (total !== currentIds.size - removed.length + placedIds.size) issues.push("staged entry count does not balance");
  if (removed.length !== leaving.size) issues.push(`expected ${leaving.size} removed entries, found ${removed.length}`);

  return {
    issues,
    staged: {
      curriculum: { version: current.version, level: current.level, units, calibrationSlice: current.calibrationSlice },
      removed,
      droppedPrerequisites,
      promoted,
      counts: {
        units: units.length, entries: total, retained, added, removed: removed.length,
        promoted: promoted.length, droppedPrerequisites: droppedPrerequisites.length,
      },
    },
  };
}
