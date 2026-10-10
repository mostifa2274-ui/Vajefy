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
export type CatalogueEntry = { id: string; headword: string; partsOfSpeech: string[] };

export type SelectedRecord = {
  selectionId: string;
  cefrjHeadword: string;
  pos: string;
  forms: string[];
  ngsl: { tier: NgslTier; lemma: string | null; rank: number | null };
  /** RETAINED: a kept lesson teaches this spelling. NEW: no lesson teaches it. */
  courseStatus: "RETAINED" | "NEW";
  /**
   * Whether a kept lesson teaches this part of speech. CEFR-J labels are not always
   * the catalogue's (it files *hello* as a noun), so false means "review in phase 2",
   * not "missing".
   */
  posTaught: boolean;
  entryIds: string[];
};
export type RetiredEntry = {
  entryId: string;
  headword: string;
  bestCefrjLevel: "A2" | "B1" | "B2" | "NOT_IN_CEFRJ";
};
export type CefrjSelection = {
  selected: SelectedRecord[];
  retired: RetiredEntry[];
  counts: {
    records: number; headwords: number; retained: number; new: number; posNotTaught: number;
    retiredEntries: number; byNgslTier: Record<NgslTier, number>;
  };
};

const LEVELS = ["A1", "A2", "B1", "B2"] as const;
/** CEFR-J part-of-speech labels and the catalogue labels that teach the same use. */
const POS_MATCH: Record<string, string[]> = {
  noun: ["noun"], verb: ["verb"], adjective: ["adjective"], adverb: ["adverb"],
  pronoun: ["pronoun"], preposition: ["preposition"], conjunction: ["conjunction"],
  determiner: ["determiner", "article"], number: ["number", "determiner"],
  "modal auxiliary": ["modal"], "be-verb": ["verb"], "do-verb": ["verb"], "have-verb": ["verb"],
  interjection: ["exclamation"], "infinitive-to": ["particle"],
};
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
/**
 * The matching key keeps capitals when the spelling has them, so the month *May*
 * and the title *Miss* never match the modal *may* or the verb *miss*.
 */
export function matchKey(value: string): string {
  const folded = value.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, "").normalize("NFKC").replace(/\s*\([^)]*\)/g, "")
    .replace(/[’‘]/g, "'").trim();
  return /[A-Z]/.test(folded) ? folded : folded.toLowerCase();
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
  return [...new Set(cefrjHeadword.split("/").map(matchKey).filter(Boolean))];
}

export function buildCefrjSelection(input: {
  cefrj: CefrjRow[];
  ngslCore: Map<string, number | null>;
  ngslSupplement: Map<string, number | null>;
  ngslExtension: Map<string, number | null>;
  catalogue: CatalogueEntry[];
}): CefrjSelection {
  // One record per distinct CEFR-J (headword, part of speech); duplicates keep the lowest level.
  const records = new Map<string, CefrjRow>();
  for (const row of input.cefrj) {
    const key = row.headword + "\u0000" + row.pos;
    const prev = records.get(key);
    if (!prev || LEVELS.indexOf(row.level as typeof LEVELS[number]) < LEVELS.indexOf(prev.level as typeof LEVELS[number])) records.set(key, row);
  }
  for (const row of records.values()) {
    if (!POS_MATCH[row.pos]) throw new Error("CEFR-J part of speech has no catalogue mapping: " + row.pos);
  }

  const ngslFor = (forms: string[]): SelectedRecord["ngsl"] => {
    const all = [...withVariants(forms.map((f) => f.toLowerCase()))];
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

  // Index every CEFR-J form (with spelling variants) to the records that contain it.
  const recordsByForm = new Map<string, string[]>();
  for (const [key, row] of records) {
    for (const f of withVariants(formsOf(row.headword))) recordsByForm.set(f, [...(recordsByForm.get(f) ?? []), key]);
  }
  const entryForms = (headword: string) => withVariants(headword.split(",").map(matchKey).filter(Boolean));
  const teaches = (entry: CatalogueEntry, row: CefrjRow) =>
    entry.partsOfSpeech.some((p) => POS_MATCH[row.pos]!.includes(p));

  // A lesson stays when CEFR-J grades its spelling (capitals kept) A1 in any part of
  // speech; part of speech only reports which A1 uses a kept lesson already covers.
  const isA1 = (k: string) => records.get(k)!.level === "A1";
  const kept = new Map<string, CatalogueEntry[]>(); // record key -> kept entries with that spelling
  const retired: RetiredEntry[] = [];
  for (const entry of input.catalogue) {
    const matched = new Set<string>();
    for (const f of entryForms(entry.headword)) for (const k of recordsByForm.get(f) ?? []) matched.add(k);
    if ([...matched].some(isA1)) {
      for (const k of matched) kept.set(k, [...(kept.get(k) ?? []), entry]);
    } else {
      const levels = [...matched].map((k) => records.get(k)!.level);
      const best = LEVELS.find((l) => levels.includes(l));
      retired.push({
        entryId: entry.id, headword: entry.headword,
        bestCefrjLevel: (best ?? "NOT_IN_CEFRJ") as RetiredEntry["bestCefrjLevel"],
      });
    }
  }

  const tierOrder: NgslTier[] = ["NGSL_1_2_CORE", "NGSL_1_2_SUPPLEMENT", "NGSL_SFI_31K_EXTENSION", "NO_NGSL_MATCH"];
  const unsorted = [...records].filter(([k]) => isA1(k)).map(([key, row]) => {
    const forms = formsOf(row.headword);
    const entries = kept.get(key) ?? [];
    return {
      cefrjHeadword: row.headword, pos: row.pos, forms,
      ngsl: ngslFor(forms),
      courseStatus: entries.length > 0 ? "RETAINED" as const : "NEW" as const,
      posTaught: entries.some((e) => teaches(e, row)),
      entryIds: [...new Set(entries.map((e) => e.id))].sort(),
    };
  });
  unsorted.sort((a, b) =>
    tierOrder.indexOf(a.ngsl.tier) - tierOrder.indexOf(b.ngsl.tier) ||
    (a.ngsl.rank ?? Number.MAX_SAFE_INTEGER) - (b.ngsl.rank ?? Number.MAX_SAFE_INTEGER) ||
    a.cefrjHeadword.localeCompare(b.cefrjHeadword, "en") || a.pos.localeCompare(b.pos, "en"));
  const selected: SelectedRecord[] = unsorted.map((s, i) => ({
    selectionId: "cefrj-a1:" + String(i + 1).padStart(4, "0"), ...s,
  }));

  const byNgslTier = Object.fromEntries(tierOrder.map((t) => [t, selected.filter((s) => s.ngsl.tier === t).length])) as Record<NgslTier, number>;
  return {
    selected,
    retired: retired.sort((a, b) => a.entryId.localeCompare(b.entryId)),
    counts: {
      records: selected.length,
      headwords: new Set(selected.map((s) => s.cefrjHeadword)).size,
      retained: new Set(selected.filter((s) => s.courseStatus === "RETAINED").map((s) => s.cefrjHeadword)).size,
      new: new Set(selected.filter((s) => s.courseStatus === "NEW").map((s) => s.cefrjHeadword)).size,
      posNotTaught: selected.filter((s) => s.courseStatus === "RETAINED" && !s.posTaught).length,
      retiredEntries: retired.length,
      byNgslTier,
    },
  };
}
