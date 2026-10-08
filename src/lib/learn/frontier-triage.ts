import type { CheckItem } from "./content";
import { taskSupportIssues } from "./task-support";

export type FrontierTriageFinding = {
  code: string;
  where: string;
  frontier?: {
    token: string;
    frontier: number;
    frontierEntryId?: string;
    dependencyId?: string;
  };
};

export type FrontierTriageCase = {
  token: string;
  source: string;
  unit: string;
  taskIndex: number;
  taskId: string;
  question: string;
  classification: "frozen-pilot" | "gloss-candidate" | "requires-reword-or-review";
  reasons: string[];
};

export type FrontierTriageReport = {
  schemaVersion: 1;
  total: number;
  frozenPilot: number;
  glossCandidates: number;
  needsReview: number;
  tokens: Array<{
    token: string;
    occurrences: number;
    frozenPilot: number;
    glossCandidates: number;
    needsReview: number;
    cases: FrontierTriageCase[];
  }>;
};

export function buildFrontierTriage(
  findings: readonly FrontierTriageFinding[],
  sourceChecks: ReadonlyMap<string, readonly CheckItem[]>,
  orderedUnits: readonly { id: string; entryIds: readonly string[] }[],
): FrontierTriageReport {
  const unitByEntry = new Map<string, { id: string; frozen: boolean }>();
  for (const [unitIndex, unit] of orderedUnits.entries()) {
    for (const id of unit.entryIds) {
      if (unitByEntry.has(id)) throw new Error("Duplicate curriculum entry: " + id);
      unitByEntry.set(id, { id: unit.id, frozen: unitIndex < 3 });
    }
  }

  const cases: FrontierTriageCase[] = [];
  for (const finding of findings) {
    if (
      finding.code !== "FRONTIER_TASK_VOCABULARY" &&
      finding.code !== "FRONTIER_SCENE_VOCABULARY"
    ) continue;
    // A known later A1 word belongs to prerequisite planning, not to this queue.
    if (finding.frontier?.dependencyId) continue;

    const match = /^(.*)\.check\[(\d+)\]$/.exec(finding.where);
    if (!match || !finding.frontier?.token || !finding.frontier.frontierEntryId) {
      throw new Error("Frontier case lacks exact task/entry metadata: " + finding.where);
    }
    const source = match[1]!;
    const index = Number(match[2]);
    const checks = sourceChecks.get(source);
    const item = checks?.[index];
    if (!item) throw new Error("Frontier source task not found: " + finding.where);
    const unit = unitByEntry.get(finding.frontier.frontierEntryId);
    if (!unit) throw new Error("Frontier curriculum anchor missing: " + finding.where);

    const reasons = unit.frozen ? ["frozen Units 1–3: needs a separate study/audio scope decision"] : [];
    const alreadySix = (item.support?.length ?? 0) >= 6;
    if (alreadySix) reasons.push("support already has the schema maximum of six glosses");
    if (!unit.frozen && !alreadySix) {
      // Dummy Persian passes the shape check; this is a structural suggestion,
      // never a claim that a translation was verified or approved.
      reasons.push(
        ...taskSupportIssues({
          ...item,
          support: [...(item.support ?? []), { en: finding.frontier.token, fa: "نمونه" }],
        }),
      );
    }

    const classification: FrontierTriageCase["classification"] = unit.frozen
      ? "frozen-pilot"
      : reasons.length ? "requires-reword-or-review" : "gloss-candidate";
    cases.push({
      token: finding.frontier.token,
      source,
      unit: unit.id,
      taskIndex: index,
      taskId: item.id,
      question:
        item.type === "cloze" ? item.text
        : item.type === "produce" ? item.frame
        : [item.prompt, ...item.options.map(option => option.text)].join(" | "),
      classification,
      reasons,
    });
  }

  const groups = new Map<string, FrontierTriageCase[]>();
  for (const item of cases) {
    const group = groups.get(item.token) ?? [];
    group.push(item);
    groups.set(item.token, group);
  }
  const count = (values: readonly FrontierTriageCase[], kind: FrontierTriageCase["classification"]) =>
    values.filter(value => value.classification === kind).length;
  const tokens = [...groups].map(([token, values]) => ({
    token,
    occurrences: values.length,
    frozenPilot: count(values, "frozen-pilot"),
    glossCandidates: count(values, "gloss-candidate"),
    needsReview: count(values, "requires-reword-or-review"),
    cases: values.sort(
      (a, b) => a.unit.localeCompare(b.unit) ||
        a.source.localeCompare(b.source) || a.taskIndex - b.taskIndex,
    ),
  })).sort((a, b) =>
    b.glossCandidates - a.glossCandidates ||
    b.occurrences - a.occurrences ||
    a.token.localeCompare(b.token),
  );

  const report: FrontierTriageReport = {
    schemaVersion: 1,
    total: cases.length,
    frozenPilot: count(cases, "frozen-pilot"),
    glossCandidates: count(cases, "gloss-candidate"),
    needsReview: count(cases, "requires-reword-or-review"),
    tokens,
  };
  if (report.total !== report.frozenPilot + report.glossCandidates + report.needsReview) {
    throw new Error("Frontier triage accounting mismatch");
  }
  return report;
}
