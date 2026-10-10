/**
 * The A1 rebuild selection (owner decision, 2026-10-10): every headword that the
 * CEFR-J Wordlist 1.5 grades A1, mapped to NGSL 1.2 for frequency order and
 * attribution, and compared with the current catalogue.
 *
 * The selection is decided by CEFR-J alone. The current catalogue is read only
 * to report which selected words already have lessons (RETAINED), which still
 * need lessons (NEW) and which current entries leave the course (RETIRED).
 * Nothing here clears rights, assesses a sense or approves a lesson.
 */
export const CEFRJ_SELECTION_STATUS =
  "STAGING_ONLY_SELECTION_RULE_APPLIED_NOT_RIGHTS_CLEARED" as const;

export type CefrjRow = { headword: string; pos: string; level: string };
export type NgslTier = "NGSL_1_2_CORE" | "NGSL_1_2_SUPPLEMENT" | "NGSL_SFI_31K_EXTENSION" | "NO_NGSL_MATCH";
export type CatalogueEntry = { id: string; headword: string };

export type SelectedHeadword = {
  selectionId: string;
  cefrjHeadword: string;
  forms: string[];
  a1PartsOfSpeech: string[];
  ngsl: { tier: NgslTier; lemma: string | null; rank: number | null };
  courseStatus: "RETAINED" | "NEW";
  entryIds: string[];
};
export type RetiredEntry = {
  entryId: string;
  headword: string;
  bestCefrjLevel: "A2" | "B1" | "B2" | "NOT_IN_CEFRJ";
};
export type CefrjSelection = {
  selected: SelectedHeadword[];
  retired: RetiredEntry[];
  counts: { selected: number; retained: number; new: number; retiredEntries: number; byNgslTier: Record<NgslTier, number> };
};

const LEVELS = ["A1", "A2", "B1", "B2"] as const;
/** British and US spellings are the same word for matching purposes. */
const SPELLING_VARIANTS: Record<string, string> = {
  colour: "color", centre: "center", favourite: "favorite", grey: "gray",
  neighbour: "neighbor", theatre: "theater", metre: "meter", kilometre: "kilometer",
  programme: "program", practise: "practice", aeroplane: "airplane", dialogue: "dialog",
  travelling: "traveling", cancelled: "canceled", jewellery: "jewelry", pyjamas: "pajamas",
};
const VARIANT_OF = new Map<string, string>();
for (const [gb, us] of Object.entries(SPELLING_VARIANTS)) { VARIANT_OF.set(gb, us); VARIANT_OF.set(us, gb); }

/** Lower-cases, folds curly apostrophes and drops sense labels such as "last¹ (final)". */
export function normalizeHeadword(value: string): string {
  return value.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, "").normalize("NFKC").replace(/\s*\([^)]*\)/g, "")
    .replace(/[’‘]/g, "'").trim().toLowerCase();
}
function withVariants(forms: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const f of forms) { out.add(f); const v = VARIANT_OF.get(f); if (v) out.add(v); }
  return out;
}

/** RFC 4180 CSV with quoted fields, as published by Open Language Profiles. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = ""; rows.push(row); row = [];
    } else cell += ch;
  }
  if (quoted) throw new Error("CEFR-J CSV: unterminated quoted field");
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

export function readCefrjRows(text: string): CefrjRow[] {
  const [header, ...body] = parseCsv(text.replace(/^\uFEFF/, ""));
  if (!header || header[0] !== "headword" || header[1] !== "pos" || header[2] !== "CEFR") {
    throw new Error("CEFR-J CSV: unexpected header");
  }
  return body.map((r, i) => {
    const [headword = "", pos = "", level = ""] = r;
    if (!headword.trim() || !pos.trim()) throw new Error("CEFR-J CSV: empty headword or POS at row " + (i + 2));
    if (!(LEVELS as readonly string[]).includes(level)) throw new Error("CEFR-J CSV: unknown level " + level + " at row " + (i + 2));
    return { headword: headword.trim(), pos: pos.trim(), level };
  });
}

/** `word,rank` (core and extension) or one word per line (supplement). */
export function readNgslList(text: string, ranked: boolean): Map<string, number | null> {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = new Map<string, number | null>();
  for (const line of ranked ? lines.slice(1) : lines) {
    const [word = "", rank] = line.split(",");
    const key = normalizeHeadword(word);
    if (!key) throw new Error("NGSL list: empty word");
    if (!out.has(key)) out.set(key, ranked ? Number(rank) : null);
  }
  return out;
}

function formsOf(cefrjHeadword: string): string[] {
  return [...new Set(cefrjHeadword.split("/").map(normalizeHeadword).filter(Boolean))];
}

export function buildCefrjSelection(input: {
  cefrj: CefrjRow[];
  ngslCore: Map<string, number | null>;
  ngslSupplement: Map<string, number | null>;
  ngslExtension: Map<string, number | null>;
  catalogue: CatalogueEntry[];
}): CefrjSelection {
  // One group per distinct CEFR-J headword string; its rows carry the POS and levels.
  const groups = new Map<string, CefrjRow[]>();
  for (const row of input.cefrj) groups.set(row.headword, [...(groups.get(row.headword) ?? []), row]);

  const ngslFor = (forms: string[]): SelectedHeadword["ngsl"] => {
    const all = [...withVariants(forms)];
    const core = all.filter((f) => input.ngslCore.has(f))
      .map((f) => ({ f, r: input.ngslCore.get(f)! })).sort((a, b) => (a.r ?? 0) - (b.r ?? 0))[0];
    if (core) return { tier: "NGSL_1_2_CORE", lemma: core.f, rank: core.r };
    const sup = all.find((f) => input.ngslSupplement.has(f));
    if (sup) return { tier: "NGSL_1_2_SUPPLEMENT", lemma: sup, rank: null };
    const ext = all.filter((f) => input.ngslExtension.has(f))
      .map((f) => ({ f, r: input.ngslExtension.get(f)! })).sort((a, b) => (a.r ?? 0) - (b.r ?? 0))[0];
    if (ext) return { tier: "NGSL_SFI_31K_EXTENSION", lemma: ext.f, rank: ext.r };
    return { tier: "NO_NGSL_MATCH", lemma: null, rank: null };
  };

  // Index every CEFR-J form (with spelling variants) to the groups that contain it.
  const groupsByForm = new Map<string, string[]>();
  for (const key of groups.keys()) {
    for (const f of withVariants(formsOf(key))) groupsByForm.set(f, [...(groupsByForm.get(f) ?? []), key]);
  }
  const entryForms = (headword: string) =>
    withVariants(headword.split(",").map(normalizeHeadword).filter(Boolean));

  const isA1 = (key: string) => groups.get(key)!.some((r) => r.level === "A1");
  const entriesByGroup = new Map<string, string[]>();
  const retired: RetiredEntry[] = [];
  for (const entry of input.catalogue) {
    const matched = new Set<string>();
    for (const f of entryForms(entry.headword)) for (const g of groupsByForm.get(f) ?? []) matched.add(g);
    const a1 = [...matched].filter(isA1);
    for (const g of a1) entriesByGroup.set(g, [...(entriesByGroup.get(g) ?? []), entry.id]);
    if (a1.length === 0) {
      const levels = [...matched].flatMap((g) => groups.get(g)!.map((r) => r.level));
      const best = LEVELS.find((l) => levels.includes(l));
      retired.push({
        entryId: entry.id, headword: entry.headword,
        bestCefrjLevel: (best ?? "NOT_IN_CEFRJ") as RetiredEntry["bestCefrjLevel"],
      });
    }
  }

  const tierOrder: NgslTier[] = ["NGSL_1_2_CORE", "NGSL_1_2_SUPPLEMENT", "NGSL_SFI_31K_EXTENSION", "NO_NGSL_MATCH"];
  const unsorted = [...groups.keys()].filter(isA1).map((key) => {
    const forms = formsOf(key);
    const entryIds = [...new Set(entriesByGroup.get(key) ?? [])].sort();
    return {
      cefrjHeadword: key, forms,
      a1PartsOfSpeech: [...new Set(groups.get(key)!.filter((r) => r.level === "A1").map((r) => r.pos))].sort(),
      ngsl: ngslFor(forms),
      courseStatus: entryIds.length > 0 ? "RETAINED" as const : "NEW" as const,
      entryIds,
    };
  });
  unsorted.sort((a, b) =>
    tierOrder.indexOf(a.ngsl.tier) - tierOrder.indexOf(b.ngsl.tier) ||
    (a.ngsl.rank ?? Number.MAX_SAFE_INTEGER) - (b.ngsl.rank ?? Number.MAX_SAFE_INTEGER) ||
    a.cefrjHeadword.localeCompare(b.cefrjHeadword, "en"));
  const selected: SelectedHeadword[] = unsorted.map((s, i) => ({
    selectionId: "cefrj-a1:" + String(i + 1).padStart(4, "0"), ...s,
  }));

  const byNgslTier = Object.fromEntries(tierOrder.map((t) => [t, selected.filter((s) => s.ngsl.tier === t).length])) as Record<NgslTier, number>;
  return {
    selected,
    retired: retired.sort((a, b) => a.entryId.localeCompare(b.entryId)),
    counts: {
      selected: selected.length,
      retained: selected.filter((s) => s.courseStatus === "RETAINED").length,
      new: selected.filter((s) => s.courseStatus === "NEW").length,
      retiredEntries: retired.length,
      byNgslTier,
    },
  };
}
