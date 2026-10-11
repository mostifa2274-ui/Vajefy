/**
 * Builds or checks the whole-app level placement: every CEFR-J 1.5 (A1–B2) and
 * Octanove 1.0 (C1–C2) word at its lowest level, compared with all six current
 * level lists.
 *
 *   --write   regenerate content/rights-staging/level-rebuild/level-selection.json
 *   (default) fail if the committed file differs from a fresh build
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { readCefrjRows, readNgslList } from "../../src/lib/learn/rights-cefrj-selection";
import {
  buildLevelSelection,
  correctPartsOfSpeech,
  LEVEL_SELECTION_STATUS,
  type CurrentLevel,
  type LevelEntry,
} from "../../src/lib/learn/rights-level-selection";

const ROOT = process.cwd();
const rel = (p: string) => path.join(ROOT, p);
const OUT = "content/rights-staging/level-rebuild/level-selection.json";
const UPSTREAM = "https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/d4e45b75b38f27b30dfc5c44d8c571aec7e7092f/";
const SOURCES = [
  { file: "content/rights-staging/cefrj-1.5/cefrj-vocabulary-profile-1.5.csv", url: UPSTREAM + "cefrj-vocabulary-profile-1.5.csv", gitBlob: "e89799a7f91a8ae5540e722874edf9158ef8685b" },
  { file: "content/rights-staging/cefrj-1.5/octanove-vocabulary-profile-c1c2-1.0.csv", url: UPSTREAM + "octanove-vocabulary-profile-c1c2-1.0.csv", gitBlob: "3a0505e98c9a6ef92be32466e43de4b7f14683d0" },
  { file: "content/rights-staging/cefrj-1.5/olp-en-cefrj-README.md", url: UPSTREAM + "README.md", gitBlob: "9989d0ff550ca22471e10fbba1b36bb281143e9d" },
  { file: "content/rights-staging/ngsl-1.2/core.csv", url: "https://www.newgeneralservicelist.com/s/NGSL_12_stats.csv", gitBlob: "b8705be6c208bbee4450a208eb39a5be4dea8f63" },
  { file: "content/rights-staging/ngsl-1.2/supplementary.csv", url: "https://www.newgeneralservicelist.com/s/SUP_lemmatized.csv", gitBlob: "34c8d351411ee2bd53ade193a9308c0326b7c7e3" },
  { file: "content/rights-staging/ngsl-1.2/frequency-extension-31k.csv", url: "https://www.newgeneralservicelist.com/s/NGSLwithSFI-31K.xlsx", gitBlob: "469e1e6922c5ff8bf15b5cc040c0d7d1f2e537ef" },
] as const;
const LEVEL_FILES: [CurrentLevel, string][] = [
  ["A1", "lex-a1.json"], ["A2", "lex-a2.json"], ["B1", "lex-b1.json"],
  ["B2", "lex-b2.json"], ["B2x", "lex-b2x.json"], ["C1", "lex-c1.json"],
];

function fail(message: string): never { throw new Error("Level selection: " + message); }
const gitBlob = (buf: Buffer) => createHash("sha1").update("blob " + buf.length + "\0").update(buf).digest("hex");
const text = new Map<string, string>();
for (const s of SOURCES) {
  const buf = fs.readFileSync(rel(s.file));
  if (gitBlob(buf) !== s.gitBlob) fail("pinned source changed: " + s.file + " (actual " + gitBlob(buf) + ")");
  text.set(s.file, buf.toString("utf8"));
}
const readme = text.get(SOURCES[2].file)!;
for (const term of [
  "can be used for research and commercial purposes with no charge, provided that you cite the dataset properly",
  "Octanove Vocabulary Profile for C1/C2 levels can be used under a [Creative Commons Attribution-ShareAlike 4.0 International License]",
]) if (!readme.includes(term)) fail("pinned terms of use missing from the upstream README: " + term.slice(0, 50));

const catalogue: LevelEntry[] = LEVEL_FILES.flatMap(([level, file]) =>
  (JSON.parse(fs.readFileSync(rel("public/data/" + file), "utf8")) as { id: string; w: string }[])
    .map((e) => ({ id: e.id, level, headword: e.w })));
if (catalogue.length !== 5322) fail("expected the 5,322-entry catalogue, found " + catalogue.length);

const cefrj = readCefrjRows(text.get(SOURCES[0].file)!).map((r) => ({ ...r, source: "CEFR-J" as const }));
const octanove = readCefrjRows(text.get(SOURCES[1].file)!, ["C1", "C2"], true).map((r) => ({ ...r, source: "Octanove" as const }));
if (cefrj.length !== 7799 || octanove.length !== 2136) fail("unexpected row counts " + cefrj.length + "/" + octanove.length);
const corrected = correctPartsOfSpeech([...cefrj, ...octanove]);
const result = buildLevelSelection({
  rows: corrected.rows,
  ngslCore: readNgslList(text.get(SOURCES[3].file)!, true),
  ngslSupplement: readNgslList(text.get(SOURCES[4].file)!, false),
  ngslExtension: readNgslList(text.get(SOURCES[5].file)!, true),
  catalogue,
});

const doc = {
  schemaVersion: 1,
  status: LEVEL_SELECTION_STATUS,
  rule: "Every word in CEFR-J 1.5 (A1–B2) and Octanove 1.0 (C1–C2) is placed at the lowest level either list gives it. Levels: A1, A2, B1, B2, C1, C2 (B2 and B2+ merge; C2 is added). A current entry in neither list keeps its current level (B2+ reads as B2). NGSL 1.2 supplies frequency order and attribution only.",
  ownerDecision: {
    decidedOn: "2026-10-10",
    instruction: "Do for all words in the app",
    answers: {
      levelSize: "All listed words no drop out",
      b2AndB2Plus: "Merge into one B2",
      c2: "Add a C2 level",
    },
    record: "docs/A1_CEFRJ_REBUILD.md",
  },
  sources: SOURCES.map((s) => ({ file: s.file, url: s.url, gitBlob: s.gitBlob })),
  licences: {
    "CEFR-J": "Free for research and commercial use with citation (upstream README).",
    Octanove: "CC BY-SA 4.0 (upstream README); ShareAlike applies to derivatives of the list.",
    NGSL: "CC BY-SA 4.0.",
  },
  citation: [
    "The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies. Retrieved from https://github.com/openlanguageprofiles/olp-en-cefrj.",
    "Octanove Vocabulary Profile C1/C2 1.0, Octanove Labs. CC BY-SA 4.0. Retrieved from https://github.com/openlanguageprofiles/olp-en-cefrj.",
    "Browne, C., Culligan, B. & Phillips, J. (2013). The New General Service List 1.2. CC BY-SA 4.0.",
  ],
  partOfSpeechCorrections: corrected.corrections,
  counts: result.counts,
  rightsCleared: 0,
  entriesApproved: 0,
  words: result.words,
  entries: result.entries,
};
// One record per line keeps the file small and its diffs readable.
const { words, entries, ...head } = doc;
const lines = (items: unknown[]) => items.map((x) => "  " + JSON.stringify(x)).join(",\n");
const json = JSON.stringify(head, null, 2).replace(/\n}$/, "") +
  ',\n "words": [\n' + lines(words) + '\n ],\n "entries": [\n' + lines(entries) + "\n ]\n}\n";
JSON.parse(json);
if (process.argv.includes("--write")) {
  fs.writeFileSync(rel(OUT), json);
  console.log("Wrote " + OUT + ".");
} else if (!fs.existsSync(rel(OUT)) || fs.readFileSync(rel(OUT), "utf8") !== json) {
  fail(OUT + " is out of date; run npm run assurance:levels -- --write");
}
const c = result.counts;
console.log(
  "Level placement: " + c.words + " listed words (" + c.newWords + " not yet in the app). Current entries: " +
  c.same + " stay, " + c.moved + " move level, " + c.ownerKept + " owner-kept outside the lists. " +
  Object.entries(c.byLevel).map(([l, v]) => l + " " + v.words + "w/" + v.entriesAfter + "e").join(", ") + ". 0 rights cleared.",
);
