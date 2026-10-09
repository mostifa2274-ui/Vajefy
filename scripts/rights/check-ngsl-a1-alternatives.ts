import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "content", "rights-staging", "ngsl-1.2");
const MANIFEST = path.join(DIR, "a1-900-alternatives.json");
const CSV = path.join(DIR, "a1-900-alternatives.csv");
type Row = {
  entryId: string; legacyHeadword: string;
  sourceTier: "NGSL_1_2_CORE" | "NGSL_1_2_SUPPLEMENT" | "NGSL_SFI_31K_EXTENSION" | "NO_NGSL_SOURCE_MATCH";
  ngslLemma: string | null; frequencyRank: number | null;
  mappingKind: "EXACT_HEADWORD" | "PARTIAL_MULTI_FORM" | "RELATED_LEMMA_ONLY" |
    "GRAMMATICAL_FORM" | "BRITISH_US_VARIANT" | "PHRASE_COMPONENT_ONLY" | "NO_SOURCE_MATCH";
  matchStatus: string; rightsStatus: string; requiresIndependentLessonRebuild: boolean;
  proposedReplacement?: { ngslLemma: string; coreRank: number; relation: string; approval: string };
};
type Source = { file: string; url: string; upstreamGitBlob: string };
type Mapping = {
  schemaVersion: 1; license: string; sources: Source[];
  counts: Record<string, number>; replacementProposals: number; entries: Row[];
};
const expectedBlobs = new Map([
  ["core.csv", "b8705be6c208eb39a5be4dea8f63"],
  ["supplementary.csv", "34c8d351411ee2bd53ade193a9308c0326b7c7e3"],
  ["frequency-extension-31k.csv", "469e1e6922c5ff8bf15b5cc040c0d7d1f2e537ef"],
  ["CC-BY-SA-4.0-LICENSE.txt", "2d58298e6eda10e7204abb52722efbc840db2390"],
]);
const normalize = (s: string) => s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, "")
  .replace(/\s*\([^)]*\)/g, "").trim().toLowerCase().normalize("NFKC");
function fail(message: string): never { throw new Error("NGSL A1 rights staging: " + message); }
function sha1Blob(buf: Buffer) {
  const h = createHash("sha1");
  h.update("blob " + buf.length + "\0");
  h.update(buf);
  return h.digest("hex");
}
function csvMap(text: string, header: boolean): Map<string, { lemma: string; rank: number | null }> {
  const entries = text.trim().split(/\r?\n/).slice(header ? 1 : 0);
  const data = new Map<string, { lemma: string; rank: number | null }>();
  for (const row of entries) {
    const [lemma, rawRank] = row.split(",");
    if (!lemma) fail("Empty lemma in source snapshot");
    const key = normalize(lemma);
    if (data.has(key)) fail("Duplicate normalized source lemma: " + lemma);
    const rank = rawRank ? Number(rawRank) : null;
    if (rawRank && (!Number.isInteger(rank) || rank! <= 0)) fail("Malformed upstream rank: " + row);
    data.set(key, { lemma: lemma.trim(), rank });
  }
  return data;
}
function escapeCell(value: string | number | null): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
const mapping = JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as Mapping;
if (mapping.schemaVersion !== 1 || mapping.license !== "CC BY-SA 4.0") fail("Invalid staging metadata");
if (mapping.sources.length !== expectedBlobs.size) fail("Missing upstream source or license");
const seen = new Set<string>();
const textByFile = new Map<string, string>();
for (const source of mapping.sources) {
  const name = path.basename(source.file);
  const expected = expectedBlobs.get(name);
  if (!expected || seen.has(name) || !source.file.startsWith("content/rights-staging/ngsl-1.2/")) {
    fail("Unrecognized or duplicated licensed source: " + source.file);
  }
  seen.add(name);
  if (source.upstreamGitBlob !== expected || !source.url.startsWith("https://")) {
    fail("Source citation/blob was replaced: " + name);
  }
  const buffer = fs.readFileSync(path.join(ROOT, source.file));
  if (sha1Blob(buffer) !== expected) fail("Pinned upstream Git blob mismatch: " + name);
  textByFile.set(name, buffer.toString("utf8"));
}
const tiers = [
  csvMap(textByFile.get("core.csv")!, true),
  csvMap(textByFile.get("supplementary.csv")!, false),
  csvMap(textByFile.get("frequency-extension-31k.csv")!, true),
];
if (tiers[0]!.size !== 2809 || tiers[1]!.size !== 52 || tiers[2]!.size !== 31239) {
  fail("NGSL 1.2 snapshot counts changed");
}
if (!textByFile.get("CC-BY-SA-4.0-LICENSE.txt")!.includes("Attribution-ShareAlike 4.0")) {
  fail("Required CC BY-SA 4.0 license text missing");
}
const sourceTier = ["NGSL_1_2_CORE", "NGSL_1_2_SUPPLEMENT", "NGSL_SFI_31K_EXTENSION"];
const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, "public", "data", "lex-a1.json"), "utf8")) as
  { id: string; w: string }[];
const roster = new Map(catalogue.map(item => [item.id, item.w]));
if (catalogue.length !== 900 || roster.size !== 900 || mapping.entries.length !== 900) {
  fail("900-item catalogue coverage changed");
}
const replacements = new Map([
  ["lex:A1:cd", "music"],
  ["lex:A1:dvd", "video"],
  ["lex:A1:oh", "well"],
]);
if (mapping.replacementProposals !== 3) fail("Missing explicit editorial replacement proposals");
const visited = new Set<string>();
const counts: Record<string, number> = {};
for (const row of mapping.entries) {
  if (visited.has(row.entryId) || roster.get(row.entryId) !== row.legacyHeadword) {
    fail("Missing, duplicated or stale catalogue entry: " + row.entryId);
  }
  visited.add(row.entryId);
  if (row.rightsStatus !== "NOT_CLEARED" ||
      row.matchStatus !== "UNREVIEWED_SOURCE_CANDIDATE" ||
      row.requiresIndependentLessonRebuild !== true) {
    fail("Source matching is not rights clearance: " + row.entryId);
  }
  let expectedTier: string = "NO_NGSL_SOURCE_MATCH";
  let source: { lemma: string; rank: number | null } | null = null;
  if (row.ngslLemma !== null) {
    for (let i = 0; i < tiers.length; i++) {
      const match = tiers[i]!.get(normalize(row.ngslLemma));
      if (match) { expectedTier = sourceTier[i]!; source = match; break; }
    }
    if (!source || expectedTier !== row.sourceTier ||
        source.lemma !== row.ngslLemma || source.rank !== row.frequencyRank) {
      fail("Rank, lemma or source tier is not supported by pinned NGSL data: " + row.entryId);
    }
    const forms = normalize(row.legacyHeadword).split(/\s*[,;/]\s*/);
    const direct = forms.includes(normalize(row.ngslLemma));
    if (direct !== ["EXACT_HEADWORD", "PARTIAL_MULTI_FORM"].includes(row.mappingKind)) {
      fail("Exact/related-lemma classification is false: " + row.entryId);
    }
    if (row.mappingKind === "PARTIAL_MULTI_FORM" && forms.length < 2) {
      fail("False multi-form claim: " + row.entryId);
    }
  } else if (row.sourceTier !== "NO_NGSL_SOURCE_MATCH" ||
             row.mappingKind !== "NO_SOURCE_MATCH" ||
             row.frequencyRank !== null) {
    fail("Invented non-NGSL evidence: " + row.entryId);
  }
  const proposed = replacements.get(row.entryId);
  if (proposed) {
    const sourceWord = tiers[0]!.get(proposed);
    const replacement = row.proposedReplacement;
    if (row.sourceTier !== "NO_NGSL_SOURCE_MATCH" || !sourceWord ||
        replacement?.ngslLemma !== sourceWord.lemma ||
        replacement.coreRank !== sourceWord.rank ||
        replacement.relation !== "DIFFERENT_LEARNING_TARGET_NOT_A_TRANSLATION_OR_SYNONYM" ||
        replacement.approval !== "REQUIRES_INDEPENDENT_CURRICULUM_AND_LESSON_REWRITE") {
      fail("Unverified or missing independent-topic replacement: " + row.entryId);
    }
  } else if (row.proposedReplacement !== undefined) {
    fail("Unapproved replacement inserted into ordinary source-matching item: " + row.entryId);
  }
  counts[row.mappingKind] = (counts[row.mappingKind] ?? 0) + 1;
  counts[row.sourceTier] = (counts[row.sourceTier] ?? 0) + 1;
}
if (visited.size !== 900 || [...roster.keys()].some(id => !visited.has(id))) {
  fail("At least one catalogue entry lacks a source alternative decision");
}
if (JSON.stringify(counts) !== JSON.stringify(mapping.counts)) {
  // Count keys are intentionally compared as a set, not insertion order.
  if (Object.keys(counts).length !== Object.keys(mapping.counts).length ||
      Object.entries(counts).some(([key,value])=>mapping.counts[key]!==value)) {
    fail("Recorded candidate/coverage totals do not match actual mapping");
  }
}
const header = [
  "entry_id","legacy_headword","ngsl_source_tier","ngsl_lemma",
  "ngsl_frequency_rank","mapping_kind","status","rights_status",
  "replacement_ngsl_core_word","replacement_ngsl_core_rank","replacement_review_status",
].join(",");
const expectedCsv = [header, ...mapping.entries.map(row =>
  [row.entryId,row.legacyHeadword,row.sourceTier,row.ngslLemma,
   row.frequencyRank,row.mappingKind,row.matchStatus,row.rightsStatus,
   row.proposedReplacement?.ngslLemma ?? "",row.proposedReplacement?.coreRank ?? "",
   row.proposedReplacement?.approval ?? ""]
    .map(escapeCell).join(","),
)].join("\n") + "\n";
if (fs.readFileSync(CSV, "utf8") !== expectedCsv) {
  fail("900-row CSV report is stale or does not match vetted JSON");
}
if (counts.NO_SOURCE_MATCH !== 3 ||
    counts.EXACT_HEADWORD !== 837 ||
    counts.PARTIAL_MULTI_FORM !== 1) {
  fail("Staged NGSL A1 mapping accounting unexpectedly changed");
}
console.log(
  "NGSL A1 alternatives: PASS (900/900 entries; " +
  (counts.EXACT_HEADWORD! + counts.PARTIAL_MULTI_FORM!) +
  " direct, " + (900 - counts.NO_SOURCE_MATCH! - counts.EXACT_HEADWORD! - counts.PARTIAL_MULTI_FORM!) +
  " unreviewed related-lemma suggestions; " + counts.NO_SOURCE_MATCH +
  " without an NGSL source; 0 rights cleared).",
);
