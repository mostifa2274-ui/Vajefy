/**
 * Whole-app level placement (owner decisions, 2026-10-10): every word that CEFR-J 1.5
 * (A1–B2) or the Octanove profile (C1–C2) lists is placed at the lowest level either
 * gives it. The app's levels become A1, A2, B1, B2, C1 and C2: B2 and B2+ merge into
 * one B2, and C2 is added. No current word drops out: a word in neither list keeps
 * its current level, with B2+ read as B2.
 *
 * The current catalogue is compared, never used to select. Nothing here clears
 * rights, assesses a sense or approves an entry.
 */
import {
  matchKey,
  withVariants,
  type CefrjRow,
  type NgslTier,
} from "./rights-cefrj-selection";

export const LEVEL_SELECTION_STATUS =
  "STAGING_ONLY_LEVEL_RULE_APPLIED_NOT_RIGHTS_CLEARED" as const;
export const TARGET_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type TargetLevel = typeof TARGET_LEVELS[number];
export type CurrentLevel = "A1" | "A2" | "B1" | "B2" | "B2x" | "C1";

export type LevelledRow = CefrjRow & { source: "CEFR-J" | "Octanove" };
export type LevelEntry = { id: string; level: CurrentLevel; headword: string };

export type PlacedWord = {
  wordId: string;
  headword: string;
  forms: string[];
  level: TargetLevel;
  source: "CEFR-J" | "Octanove";
  partsOfSpeech: string[];
  ngsl: { tier: NgslTier; lemma: string | null; rank: number | null };
  /** TAUGHT: a current entry covers this spelling (at any level). NEW: none does. */
  status: "TAUGHT" | "NEW";
  entryIds: string[];
};
export type PlacedEntry = {
  entryId: string;
  headword: string;
  currentLevel: CurrentLevel;
  newLevel: TargetLevel;
  /** SAME: stays at its level (B2+ reads as B2). MOVED: another level.
   * OWNER_KEPT: in neither list; kept at its current level by the owner's decision. */
  status: "SAME" | "MOVED" | "OWNER_KEPT";
};

const asTarget = (l: CurrentLevel): TargetLevel => (l === "B2x" ? "B2" : l);
const rankOf = (l: string) => TARGET_LEVELS.indexOf(l as TargetLevel);

export function buildLevelSelection(input: {
  rows: LevelledRow[];
  ngslCore: Map<string, number | null>;
  ngslSupplement: Map<string, number | null>;
  ngslExtension: Map<string, number | null>;
  catalogue: LevelEntry[];
}) {
  for (const r of input.rows) {
    if (rankOf(r.level) < 0) throw new Error("Level list: unknown level " + r.level + " for " + r.headword);
  }
  // Group records into words: records that share a spelling (capitals kept, British and
  // US spellings joined) are one word.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p === x) return x;
    const root = find(p);
    parent.set(x, root);
    return root;
  };
  const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra); };
  const formsOfRow = (r: LevelledRow) => [...withVariants(r.headword.split("/").map(matchKey).filter(Boolean))];
  for (const r of input.rows) {
    const forms = formsOfRow(r);
    for (const f of forms) { if (!parent.has(f)) parent.set(f, f); union(forms[0]!, f); }
  }
  const groups = new Map<string, LevelledRow[]>();
  for (const r of input.rows) {
    const root = find(formsOfRow(r)[0]!);
    groups.set(root, [...(groups.get(root) ?? []), r]);
  }

  const ngslFor = (forms: string[]): PlacedWord["ngsl"] => {
    const all = [...withVariants(forms.map((f) => f.toLowerCase()))];
    const best = (m: Map<string, number | null>) => all.filter((f) => m.has(f))
      .map((f) => ({ f, r: m.get(f)! })).sort((a, b) => (a.r ?? 0) - (b.r ?? 0))[0];
    const core = best(input.ngslCore);
    if (core) return { tier: "NGSL_1_2_CORE", lemma: core.f, rank: core.r };
    const sup = all.find((f) => input.ngslSupplement.has(f));
    if (sup) return { tier: "NGSL_1_2_SUPPLEMENT", lemma: sup, rank: null };
    const ext = best(input.ngslExtension);
    if (ext) return { tier: "NGSL_SFI_31K_EXTENSION", lemma: ext.f, rank: ext.r };
    return { tier: "NO_NGSL_MATCH", lemma: null, rank: null };
  };

  type Word = Omit<PlacedWord, "wordId" | "status" | "entryIds">;
  const words = new Map<string, Word>();
  for (const [root, rows] of groups) {
    const lowest = rows.reduce((a, b) => (rankOf(b.level) < rankOf(a.level) ? b : a));
    const forms = [...new Set(rows.flatMap(formsOfRow))].sort();
    words.set(root, {
      headword: lowest.headword, forms, level: lowest.level as TargetLevel, source: lowest.source,
      partsOfSpeech: [...new Set(rows.filter((r) => r.level === lowest.level).map((r) => r.pos))].sort(),
      ngsl: ngslFor(forms),
    });
  }

  const entriesByWord = new Map<string, string[]>();
  const placedEntries: PlacedEntry[] = input.catalogue.map((entry) => {
    const roots = new Set<string>();
    for (const f of withVariants(entry.headword.split(",").map(matchKey).filter(Boolean))) {
      if (parent.has(f)) roots.add(find(f));
    }
    for (const r of roots) entriesByWord.set(r, [...(entriesByWord.get(r) ?? []), entry.id]);
    const levels = [...roots].map((r) => words.get(r)!.level).sort((a, b) => rankOf(a) - rankOf(b));
    const current = asTarget(entry.level);
    if (levels.length === 0) {
      return { entryId: entry.id, headword: entry.headword, currentLevel: entry.level, newLevel: current, status: "OWNER_KEPT" as const };
    }
    const newLevel = levels[0]!;
    return {
      entryId: entry.id, headword: entry.headword, currentLevel: entry.level, newLevel,
      status: newLevel === current ? "SAME" as const : "MOVED" as const,
    };
  });

  const tierOrder: NgslTier[] = ["NGSL_1_2_CORE", "NGSL_1_2_SUPPLEMENT", "NGSL_SFI_31K_EXTENSION", "NO_NGSL_MATCH"];
  const placed: PlacedWord[] = [...words].map(([root, w]) => {
    const entryIds = [...new Set(entriesByWord.get(root) ?? [])].sort();
    return { wordId: "", ...w, status: entryIds.length > 0 ? "TAUGHT" as const : "NEW" as const, entryIds };
  }).sort((a, b) =>
    rankOf(a.level) - rankOf(b.level) ||
    tierOrder.indexOf(a.ngsl.tier) - tierOrder.indexOf(b.ngsl.tier) ||
    (a.ngsl.rank ?? Number.MAX_SAFE_INTEGER) - (b.ngsl.rank ?? Number.MAX_SAFE_INTEGER) ||
    a.headword.localeCompare(b.headword, "en"));
  const perLevelSeq = new Map<string, number>();
  for (const w of placed) {
    const n = (perLevelSeq.get(w.level) ?? 0) + 1;
    perLevelSeq.set(w.level, n);
    w.wordId = "level:" + w.level + ":" + String(n).padStart(4, "0");
  }

  const byLevel = Object.fromEntries(TARGET_LEVELS.map((l) => {
    const ws = placed.filter((w) => w.level === l);
    const es = placedEntries.filter((e) => e.newLevel === l);
    return [l, {
      words: ws.length,
      taught: ws.filter((w) => w.status === "TAUGHT").length,
      new: ws.filter((w) => w.status === "NEW").length,
      ownerKeptEntries: es.filter((e) => e.status === "OWNER_KEPT").length,
      entriesAfter: es.length,
    }];
  })) as Record<TargetLevel, { words: number; taught: number; new: number; ownerKeptEntries: number; entriesAfter: number }>;
  const count = (s: PlacedEntry["status"]) => placedEntries.filter((e) => e.status === s).length;
  return {
    words: placed,
    entries: placedEntries.sort((a, b) => a.entryId.localeCompare(b.entryId)),
    counts: {
      words: placed.length,
      newWords: placed.filter((w) => w.status === "NEW").length,
      entries: placedEntries.length,
      same: count("SAME"), moved: count("MOVED"), ownerKept: count("OWNER_KEPT"),
      byLevel,
    },
  };
}
