/**
 * Builds or checks the A1 rebuild selection: every CEFR-J 1.5 A1 headword,
 * mapped to pinned NGSL 1.2 lists and compared with the current catalogue.
 *
 *   --write   regenerate content/rights-staging/a1-rebuild/cefrj-a1-selection.{json,csv}
 *   (default) fail if the committed files differ from a fresh build
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  buildCefrjSelection,
  CEFRJ_SELECTION_STATUS,
  readCefrjRows,
  readNgslList,
  type CatalogueEntry,
} from "../../src/lib/learn/rights-cefrj-selection";

const ROOT = process.cwd();
const rel = (p: string) => path.join(ROOT, p);
const OUT_JSON = "content/rights-staging/a1-rebuild/cefrj-a1-selection.json";
const OUT_CSV = "content/rights-staging/a1-rebuild/cefrj-a1-selection.csv";
const UPSTREAM_COMMIT = "d4e45b75b38f27b30dfc5c44d8c571aec7e7092f";
const SOURCES = [
  {
    file: "content/rights-staging/cefrj-1.5/cefrj-vocabulary-profile-1.5.csv",
    url: "https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/" + UPSTREAM_COMMIT + "/cefrj-vocabulary-profile-1.5.csv",
    gitBlob: "e89799a7f91a8ae5540e722874edf9158ef8685b",
  },
  {
    file: "content/rights-staging/cefrj-1.5/olp-en-cefrj-README.md",
    url: "https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/" + UPSTREAM_COMMIT + "/README.md",
    gitBlob: "9989d0ff550ca22471e10fbba1b36bb281143e9d",
  },
  { file: "content/rights-staging/ngsl-1.2/core.csv", url: "https://www.newgeneralservicelist.com/s/NGSL_12_stats.csv", gitBlob: "b8705be6c208bbee4450a208eb39a5be4dea8f63" },
  { file: "content/rights-staging/ngsl-1.2/supplementary.csv", url: "https://www.newgeneralservicelist.com/s/SUP_lemmatized.csv", gitBlob: "34c8d351411ee2bd53ade193a9308c0326b7c7e3" },
  { file: "content/rights-staging/ngsl-1.2/frequency-extension-31k.csv", url: "https://www.newgeneralservicelist.com/s/NGSLwithSFI-31K.xlsx", gitBlob: "469e1e6922c5ff8bf15b5cc040c0d7d1f2e537ef" },
] as const;

function fail(message: string): never { throw new Error("CEFR-J A1 selection: " + message); }
function gitBlob(buf: Buffer): string {
  return createHash("sha1").update("blob " + buf.length + "\0").update(buf).digest("hex");
}
const text = new Map<string, string>();
for (const s of SOURCES) {
  const buf = fs.readFileSync(rel(s.file));
  if (gitBlob(buf) !== s.gitBlob) fail("pinned source changed: " + s.file + " (actual " + gitBlob(buf) + ")");
  text.set(s.file, buf.toString("utf8"));
}
const readme = text.get(SOURCES[1].file)!;
if (!readme.includes("can be used for research and commercial purposes with no charge, provided that you cite the dataset properly")) {
  fail("the pinned terms-of-use statement is missing from the upstream README");
}

const catalogue: CatalogueEntry[] = fs.readdirSync(rel("content/pilot/entries")).filter((f) => f.endsWith(".json")).sort()
  .flatMap((f) => (JSON.parse(fs.readFileSync(rel("content/pilot/entries/" + f), "utf8")) as { id: string; headword: string }[])
    .map(({ id, headword }) => ({ id, headword })));
if (catalogue.length !== 900) fail("expected the 900-entry A1 catalogue, found " + catalogue.length);

const cefrj = readCefrjRows(text.get(SOURCES[0].file)!);
if (cefrj.length !== 7799) fail("expected 7,799 CEFR-J rows, found " + cefrj.length);
const result = buildCefrjSelection({
  cefrj,
  ngslCore: readNgslList(text.get(SOURCES[2].file)!, true),
  ngslSupplement: readNgslList(text.get(SOURCES[3].file)!, false),
  ngslExtension: readNgslList(text.get(SOURCES[4].file)!, true),
  catalogue,
});

const doc = {
  schemaVersion: 1,
  status: CEFRJ_SELECTION_STATUS,
  rule: "Every headword that the CEFR-J Wordlist 1.5 grades A1 (any part of speech) is selected. NGSL 1.2 supplies frequency order and attribution only. The current catalogue is compared, never used to select.",
  ownerDecision: {
    decidedOn: "2026-10-10",
    decision: "All CEFR-J A1 (~1,060)",
    unfreezeUnits1to3: true,
    record: "docs/A1_CEFRJ_REBUILD.md",
  },
  sources: SOURCES.map((s) => ({ file: s.file, url: s.url, gitBlob: s.gitBlob })),
  citation: [
    "The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies. Retrieved from https://github.com/openlanguageprofiles/olp-en-cefrj (commit " + UPSTREAM_COMMIT + ").",
    "Browne, C., Culligan, B. & Phillips, J. (2013). The New General Service List 1.2. CC BY-SA 4.0. https://www.newgeneralservicelist.com/",
  ],
  counts: result.counts,
  rightsCleared: 0,
  lessonsApproved: 0,
  selected: result.selected,
  retired: result.retired,
};
const json = JSON.stringify(doc, null, 2) + "\n";
const cell = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csv = ["selection_id,cefrj_headword,a1_pos,ngsl_tier,ngsl_lemma,ngsl_rank,course_status,entry_ids"]
  .concat(result.selected.map((s) => [s.selectionId, s.cefrjHeadword, s.a1PartsOfSpeech.join("|"), s.ngsl.tier,
    s.ngsl.lemma, s.ngsl.rank, s.courseStatus, s.entryIds.join("|")].map(cell).join(",")))
  .concat(result.retired.map((r) => ["", r.headword, "", "", "", "", "RETIRED_" + r.bestCefrjLevel, r.entryId].map(cell).join(",")))
  .join("\n") + "\n";

if (process.argv.includes("--write")) {
  fs.writeFileSync(rel(OUT_JSON), json);
  fs.writeFileSync(rel(OUT_CSV), csv);
  console.log("Wrote " + OUT_JSON + " and " + OUT_CSV + ".");
} else {
  for (const [file, body] of [[OUT_JSON, json], [OUT_CSV, csv]] as const) {
    if (!fs.existsSync(rel(file)) || fs.readFileSync(rel(file), "utf8") !== body) {
      fail(file + " is out of date; run npm run assurance:a1:cefrj -- --write");
    }
  }
}
const c = result.counts;
console.log(
  "CEFR-J A1 selection: " + c.selected + " headwords (" + c.retained + " retained, " + c.new + " new); " +
  c.retiredEntries + " current entries retire. NGSL: " + c.byNgslTier.NGSL_1_2_CORE + " core, " +
  c.byNgslTier.NGSL_1_2_SUPPLEMENT + " supplement, " + c.byNgslTier.NGSL_SFI_31K_EXTENSION + " 31k extension, " +
  c.byNgslTier.NO_NGSL_MATCH + " unmatched. 0 rights cleared.",
);
