import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  AI_AUTHORSHIP_REPORT, LIST_SOURCE, RIGHTS_PENDING,
  authoredFieldsOf, requireUncleared, selectionFieldsOf,
} from "../../src/lib/learn/rights-field-lineage";

const root = process.cwd();
const output = path.join(root, "content/rights-staging/legacy-full-lineage");
const data = path.join(root, "public/data");
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(root, f), "utf8")) as unknown;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const quote = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const COLUMN_NAMES = [
  "record_id", "corpus_level", "source_file", "legacy_headword_or_subject",
  "selection_fields", "reported_chatgpt_authored_fields", "record_sha256", "oxford_list_membership",
  "selection_provenance", "authorship_evidence", "redistribution_rights",
] as const;
type RecordRow = {
  recordId: string; level: string; sourceFile: string; subject: string;
  selectionFields: string[]; aiFields: string[]; sha256: string;
  selectionProvenance: typeof LIST_SOURCE;
  aiAuthorship: typeof AI_AUTHORSHIP_REPORT;
  rightsStatus: typeof RIGHTS_PENDING;
};
function mapRow(id: string, level: string, file: string, subject: string,
                dataRow: Record<string, unknown>, aiFields = authoredFieldsOf(dataRow)): RecordRow {
  if (!id || !subject || !/^[a-f0-9]{64}$/.test(hash(dataRow))) {
    throw new Error("Incomplete source catalogue row " + id);
  }
  const row: RecordRow = {
    recordId: id, level, sourceFile: file, subject,
    selectionFields: selectionFieldsOf(dataRow), aiFields,
    sha256: hash(dataRow), selectionProvenance: LIST_SOURCE,
    aiAuthorship: AI_AUTHORSHIP_REPORT, rightsStatus: RIGHTS_PENDING,
  };
  requireUncleared(row);
  return row;
}
function csv(rows: RecordRow[]): string {
  return [COLUMN_NAMES.join(","), ...rows.map(r => [
    r.recordId, r.level, r.sourceFile, r.subject,
    r.selectionFields.join("|"), r.aiFields.join("|"), r.sha256, "UNVERIFIED_PER_RECORD",
    r.selectionProvenance, r.aiAuthorship, r.rightsStatus,
  ].map(quote).join(","))].join("\n") + "\n";
}
const meta = read("public/data/meta.json") as {
  levels: { id: string; file: string; count: number }[];
  counts: Record<string, number>;
};
const lexical: RecordRow[] = [], supplemental: RecordRow[] = [], lessons: RecordRow[] = [];
const stableIds = new Set<string>();
for (const level of meta.levels) {
  const file = "public/data/" + level.file;
  const words = read(file);
  if (!Array.isArray(words) || words.length !== level.count) {
    throw new Error("Stale Oxford legacy catalogue count: " + level.id);
  }
  for (const item of words) {
    const row = item as Record<string, unknown>;
    const id = row.id, headword = row.w;
    if (typeof id !== "string" || !id.startsWith("lex:" + level.id + ":") ||
        typeof headword !== "string" || stableIds.has(id)) {
      throw new Error("Bad legacy word ID/headword " + id);
    }
    stableIds.add(id);
    lexical.push(mapRow(id, level.id, file, headword, row));
  }
}
const supplements: Record<string, { file: string; labelKeys: string[] }> = {
  occupations: { file: "occupations.json", labelKeys: ["w"] },
  phrasal: { file: "phrasal.json", labelKeys: ["w"] },
  collocations: { file: "collocations.json", labelKeys: ["w"] },
  prepositions: { file: "prepositions.json", labelKeys: ["w"] },
  antonyms: { file: "antonyms.json", labelKeys: ["a", "b"] },
  confusing: { file: "confusing.json", labelKeys: ["pair"] },
  patterns: { file: "verb-patterns.json", labelKeys: ["w"] },
  irregular: { file: "irregular.json", labelKeys: ["base"] },
  formation: { file: "formation.json", labelKeys: ["affix"] },
  synonyms: { file: "synonyms.json", labelKeys: ["group"] },
  families: { file: "families.json", labelKeys: ["root"] },
};
for (const [group, spec] of Object.entries(supplements)) {
  const file = "public/data/" + spec.file;
  const values = read(file);
  if (!Array.isArray(values) || values.length !== meta.counts[group]) {
    throw new Error("Stale supplemental item count: " + group);
  }
  for (const rowValue of values) {
    const row = rowValue as Record<string, unknown>;
    const id = row.id;
    const subject = spec.labelKeys.map(key => row[key]).filter(v => typeof v === "string").join(" / ");
    if (typeof id !== "string" || !id.trim() || !subject.trim() || stableIds.has(id)) {
      throw new Error("Missing/duplicate supplemental identity: " + group + "/" + id);
    }
    stableIds.add(id);
    supplemental.push(mapRow(id, "supplemental:" + group, file, subject, row));
  }
}
const entryDir = path.join(root, "content/pilot/entries");
let entryCount = 0, senseCount = 0;
const entryIds = new Set<string>(), senseIds = new Set<string>();
for (const basename of fs.readdirSync(entryDir).filter(x => x.endsWith(".json")).sort()) {
  const file = "content/pilot/entries/" + basename;
  const entries = read(file);
  if (!Array.isArray(entries)) throw new Error("Missing pilot entry array: " + file);
  for (const entryValue of entries) {
    const e = entryValue as Record<string, unknown>;
    if (typeof e.id !== "string" || !e.id.startsWith("lex:A1:") ||
        typeof e.headword !== "string" || entryIds.has(e.id)) {
      throw new Error("Invalid enhanced A1 entry " + e.id);
    }
    entryIds.add(e.id);
    entryCount++;
    if (!Array.isArray(e.senses)) throw new Error("Missing senses " + e.id);
    for (const value of e.senses) {
      const s = value as Record<string, unknown>;
      if (typeof s.id !== "string" || senseIds.has(s.id)) throw new Error("Duplicate sense " + s.id);
      senseIds.add(s.id);
      senseCount++;
      // Keep the content and its source selection separate. A user-reported
      // ChatGPT generator is not verified against historical prompt records.
      lessons.push(mapRow(s.id, "enhanced:A1:sense", file, e.headword, s));
    }
  }
}
for (const kind of ["scenes", "contrasts"] as const) {
  const file = "content/pilot/" + kind + ".json";
  const content = read(file);
  if (!Array.isArray(content)) throw new Error("Missing " + file);
  for (const value of content) {
    const row = value as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.title !== "string" ||
        senseIds.has(row.id)) throw new Error("Invalid authored content " + row.id);
    senseIds.add(row.id);
    lessons.push(mapRow(row.id, "enhanced:A1:" + kind, file, row.title, row));
  }
}
if (lexical.length !== 5322 || supplemental.length !== 2950 ||
    entryCount !== 900 || senseCount !== 1027 ||
    lessons.length !== 1027 + 14 + 16) {
  throw new Error("Full source audit unexpectedly incomplete: " +
    JSON.stringify({ lexical: lexical.length, supplemental: supplemental.length,
      entryCount, senseCount, lessons: lessons.length }));
}
if (meta.levels.map(v => v.id).join(",") !== "A1,A2,B1,B2,B2x,C1") {
  throw new Error("Unreviewed change to legacy level boundaries");
}
const stats = {
  schemaVersion: 1,
  scope: "FULL_LEGACY_OXFORD_3000_5000_VOCABULARY_AND_AUTHORED_MATERIAL_INVENTORY",
  sourceSelection: LIST_SOURCE,
  oxford3000VersusAdditional2000Membership: "UNVERIFIED_PER_RECORD",
  authorshipClaim: AI_AUTHORSHIP_REPORT,
  statement:
    "The user reports that examples, Persian translations and other instructional materials were created using ChatGPT.",
  evidenceType: "USER_STATEMENT_ONLY_NOT_VERIFIED_AGAINST_GENERATION_HISTORY",
  explanation:
    "Lexical selection/ordering, meanings, CEFR placement, copying, media and historical third-party inputs remain separate rights questions. AI output ownership does not license source selection. No automatic legal approval or public release.",
  sourceRights: RIGHTS_PENDING,
  lexicalCount: lexical.length,
  byLevel: Object.fromEntries(meta.levels.map(v => [
    v.id, lexical.filter(x => x.level === v.id).length,
  ])),
  supplementaryCount: supplemental.length,
  bySupplement: Object.fromEntries(Object.keys(supplements).map(k => [
    k, supplemental.filter(x => x.level === "supplemental:" + k).length,
  ])),
  enhancedA1Entries: entryCount,
  enhancedA1Senses: senseCount,
  enhancedScenes: 14,
  enhancedContrasts: 16,
  clearedRecords: 0,
  licensingEvidence:
    "content/assurance/provenance.json and content/assurance/rights-lineage.json",
};
const outputs = new Map<string, string>([
  ["vocabulary-5322.csv", csv(lexical)],
  ["supplementary-2950.csv", csv(supplemental)],
  ["teaching-a1-1057.csv", csv(lessons)],
  ["map-summary.json", JSON.stringify(stats, null, 2) + "\n"],
]);
const write = process.argv.includes("--write");
if (write) fs.mkdirSync(output, { recursive: true });
for (const [file, contents] of outputs) {
  const target = path.join(output, file);
  if (write) {
    fs.writeFileSync(target, contents);
  } else if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== contents) {
    throw new Error("Rights authorship map missing/stale: " + file + ". Run npm run assurance:rights:authorship -- --write");
  }
}
console.log("Rights authorship map: " + (write ? "WRITTEN" : "PASS") +
  " (5322 vocabulary; 2950 supplemental; 1027 A1 senses; 30 scenes/contrasts; zero legal approvals).");
