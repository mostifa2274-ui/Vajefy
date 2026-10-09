import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "content/rights-staging/ngsl-1.2");
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8")) as unknown;
const blobSha1 = (content: Buffer) => createHash("sha1")
  .update("blob " + content.length + "\0").update(content).digest("hex");
const normalize = (v: string) => v.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, "")
  .toLowerCase().normalize("NFKC").replace(/\s*\([^)]*\)/g, "").trim();
const pins = {
  "core.csv": "b8705be6c208bbee4450a208eb39a5be4dea8f63",
  "supplementary.csv": "34c8d351411ee2bd53ade193a9308c0326b7c7e3",
  "frequency-extension-31k.csv": "469e1e6922c5ff8bf15b5cc040c0d7d1f2e537ef",
  "CC-BY-SA-4.0-LICENSE.txt": "2d58298e6eda10e7204abb52722efbc840db2390",
};
for (const [name, sha] of Object.entries(pins)) {
  const bytes = fs.readFileSync(path.join(DIR, name));
  if (blobSha1(bytes) !== sha) throw new Error("Unpinned licensed NGSL input: " + name);
}
type SourceTier = "NGSL_1_2_CORE" | "NGSL_1_2_SUPPLEMENT" | "NGSL_SFI_31K_EXTENSION" | "NO_DIRECT_SOURCE_LEMMA";
type SourceEntry = { lemma: string; rank: number | null };
const sources = new Map<string, { tier: SourceTier; source: SourceEntry }>();
function ingest(file: string, tier: SourceTier, header: boolean) {
  const lines = fs.readFileSync(path.join(DIR, file), "utf8").trim().split(/\r?\n/);
  for (const line of lines.slice(header ? 1 : 0)) {
    const [lemma, rawRank] = line.split(",");
    if (!lemma) throw new Error("Incomplete open source row " + file);
    const key = normalize(lemma);
    const rank = rawRank ? Number(rawRank) : null;
    if (rawRank && (!Number.isInteger(rank) || rank! <= 0)) throw new Error("Bad NGSL rank: " + lemma);
    if (!sources.has(key)) sources.set(key, { tier, source: { lemma, rank } });
  }
}
ingest("core.csv", "NGSL_1_2_CORE", true);
ingest("supplementary.csv", "NGSL_1_2_SUPPLEMENT", false);
ingest("frequency-extension-31k.csv", "NGSL_SFI_31K_EXTENSION", true);
const sourceA1 = read("content/rights-staging/ngsl-1.2/a1-900-alternatives.json") as {
  entries: { entryId: string; legacyHeadword: string; sourceTier: string;
             ngslLemma: string | null; frequencyRank: number | null;
             mappingKind: string; rightsStatus: string }[];
};
const a1 = new Map(sourceA1.entries.map(x => [x.entryId, x]));
if (a1.size !== 900) throw new Error("Missing approved-as-staging-only 900-row A1 alternatives");
type Row = {
  entryId: string;
  level: string;
  legacyHeadword: string;
  sourceTier: SourceTier;
  sourceLemma: string | null;
  rank: number | null;
  matchMethod: string;
  confidence: "SOURCE_LEMMA_ONLY_NOT_SENSE_OR_POS";
  editorialStatus: "UNREVIEWED_NOT_SEMANTICALLY_APPROVED";
  rightsStatus: "NOT_CLEARED";
  requiresIndependentRebuild: true;
};
const catalogue = read("public/data/meta.json") as {
  levels: { id: string; file: string; count: number }[];
};
const rows: Row[] = [], byLevel: Record<string, number> = {};
const identifiers = new Set<string>();
function selectionFor(word: string): {
  tier: SourceTier; lemma: string | null; rank: number | null; method: string;
} {
  const cleaned = normalize(word);
  const pieces = cleaned.split(/\s*[,;/]\s*/).filter(Boolean);
  const alternatives = pieces.length > 1 ? pieces : [cleaned];
  for (const form of alternatives) {
    const match = sources.get(form);
    if (match) {
      return {
        tier: match.tier,
        lemma: match.source.lemma,
        rank: match.source.rank,
        method: alternatives.length > 1 ? "PARTIAL_MULTI_FORM" :
          normalize(word) !== word.trim().toLowerCase().normalize("NFKC")
            ? "HEADWORD_NORMALIZED_REQUIRES_REVIEW"
            : "EXACT_HEADWORD_FORM_ONLY",
      };
    }
  }
  return { tier: "NO_DIRECT_SOURCE_LEMMA", lemma: null, rank: null, method: "NO_DIRECT_MATCH" };
}
for (const level of catalogue.levels) {
  const items = read("public/data/" + level.file);
  if (!Array.isArray(items) || items.length !== level.count) {
    throw new Error("Stale catalogue size: " + level.id);
  }
  byLevel[level.id] = items.length;
  for (const item of items) {
    const v = item as { id: string; w: string };
    if (!v.id.startsWith("lex:" + level.id + ":") || identifiers.has(v.id) ||
        typeof v.w !== "string" || !v.w.trim()) throw new Error("Invalid legacy row " + v.id);
    identifiers.add(v.id);
    const previous = a1.get(v.id);
    if (level.id === "A1" && (!previous || previous.legacyHeadword !== v.w)) {
      throw new Error("A1 linked proposal missing or stale: " + v.id);
    }
    const match = previous
      ? {
          tier: previous.sourceTier === "NO_NGSL_SOURCE_MATCH" ?
            "NO_DIRECT_SOURCE_LEMMA" : previous.sourceTier,
          lemma: previous.ngslLemma, rank: previous.frequencyRank,
          method: previous.mappingKind,
        }
      : selectionFor(v.w);
    if (previous && previous.rightsStatus !== "NOT_CLEARED") {
      throw new Error("A1 source candidate was inappropriately approved: " + v.id);
    }
    if (!["NGSL_1_2_CORE", "NGSL_1_2_SUPPLEMENT", "NGSL_SFI_31K_EXTENSION", "NO_DIRECT_SOURCE_LEMMA"].includes(match.tier)) {
      throw new Error("Unknown source tier: " + v.id);
    }
    if (match.lemma !== null) {
      const ref = sources.get(normalize(match.lemma));
      if (!ref || ref.tier !== match.tier || ref.source.lemma !== match.lemma ||
          ref.source.rank !== match.rank) throw new Error("Forged source lemma/rank: " + v.id);
    } else if (match.tier !== "NO_DIRECT_SOURCE_LEMMA" || match.rank !== null) {
      throw new Error("Inconsistent missing source lemma: " + v.id);
    }
    rows.push({
      entryId: v.id, level: level.id, legacyHeadword: v.w,
      sourceTier: match.tier as SourceTier,
      sourceLemma: match.lemma, rank: match.rank, matchMethod: match.method,
      confidence: "SOURCE_LEMMA_ONLY_NOT_SENSE_OR_POS",
      editorialStatus: "UNREVIEWED_NOT_SEMANTICALLY_APPROVED",
      rightsStatus: "NOT_CLEARED", requiresIndependentRebuild: true,
    });
  }
}
if (rows.length !== 5322 || Object.keys(byLevel).join(",") !== "A1,A2,B1,B2,B2x,C1") {
  throw new Error("Incomplete Oxford 3000/5000 legacy mapping; expected 5322.");
}
const counts: Record<string, number> = {},methods: Record<string,number> = {};
for (const row of rows) {
  counts[row.sourceTier] = (counts[row.sourceTier] ?? 0) + 1;
  methods[row.matchMethod] = (methods[row.matchMethod] ?? 0) + 1;
}
const summary = {
  schemaVersion: 1,
  reportKind: "FULL_5322_LEGACY_OXFORD_ALTERNATIVE_SOURCE_CANDIDATES",
  source: "Pinned NGSL 1.2 core/supplement and its wider SFI 31k source",
  sourceLicense: "CC BY-SA 4.0; preserve notices, attribution and ShareAlike duties",
  linkedA1Proposal: "content/rights-staging/ngsl-1.2/a1-900-alternatives.json",
  licensedMaterialDoesNotRelicenseOxford: true,
  oxfordSubsetMembership: "UNVERIFIED_PER_RECORD_NOT_INFERRED_FROM_CEFR",
  quality: "UNREVIEWED_HEADWORD_MATCH_NOT_POS_SENSE_OR_TRANSLATION",
  rights: "NOT_CLEARED",
  total: rows.length, byLevel, sourceTierCounts: counts, matchingMethodCounts: methods,
  independentlyApproved: 0,
  note: "Retains existing technical IDs only for staging. Requires independently licensed reconstruction, qualified sense/CEFR/Persian review, and exact asset-level rights evidence. Does not copy NGSL glosses or presume that existing examples/translations are NGSL licensed.",
};
const escape = (v: string | number | null) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
};
const header = [
  "entry_id","level","legacy_headword","licensed_source_tier","candidate_lemma",
  "source_frequency_rank","match_method","sense_pos_review","editorial_status",
  "rights_status","independent_rebuild_required",
].join(",");
const csv = [header,...rows.map(v=>[
  v.entryId,v.level,v.legacyHeadword,v.sourceTier,v.sourceLemma,v.rank,v.matchMethod,
  v.confidence,v.editorialStatus,v.rightsStatus,String(v.requiresIndependentRebuild),
].map(x=>escape(x)).join(","))].join("\n")+"\n";
const outputs: [string,string][] = [
  ["full-5322-alternatives.csv",csv],
  ["full-5322-alternatives.json",JSON.stringify({ ...summary,entries:rows},null,2)+"\n"],
  ["full-5322-summary.json",JSON.stringify(summary,null,2)+"\n"],
];
for (const [name,contents] of outputs) {
  const f=path.join(DIR,name);
  if (process.argv.includes("--write")) fs.writeFileSync(f,contents);
  else if (!fs.existsSync(f)||fs.readFileSync(f,"utf8")!==contents) {
    throw new Error("Stale/missing full NGSL alternatives report: " + name);
  }
}
console.log("Full NGSL candidates: "+rows.length+" mapped; tiers "+JSON.stringify(counts)+"; zero approvals.");
