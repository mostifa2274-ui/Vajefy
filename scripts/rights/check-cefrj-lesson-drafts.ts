import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  auditCefrjLessonDrafts, CEFRJ_A1_SELECTION_FILE, CEFRJ_LEVEL_SELECTION_FILE,
  type CefrjLessonDraftManifest,
} from "../../src/lib/learn/rights-cefrj-lesson-drafts";
import type { SelectedRecord } from "../../src/lib/learn/rights-cefrj-selection";
import type { PlacedWord } from "../../src/lib/learn/rights-level-selection";

const root = process.cwd();
const readText = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const a1Text = readText(CEFRJ_A1_SELECTION_FILE);
const levelText = readText(CEFRJ_LEVEL_SELECTION_FILE);
const a1 = JSON.parse(a1Text) as { selected: SelectedRecord[]; rightsCleared: number; lessonsApproved: number };
const levels = JSON.parse(levelText) as { words: PlacedWord[]; rightsCleared: number; entriesApproved: number };
if (a1.rightsCleared !== 0 || a1.lessonsApproved !== 0 || levels.rightsCleared !== 0 || levels.entriesApproved !== 0) {
  throw new Error("CEFR-J lesson draft checker requires the unapproved source-selection state");
}
const dir = "content/rights-staging/a1-rebuild";
const files = fs.readdirSync(path.join(root, dir)).filter(x => x.startsWith("lessons-new-")).sort();
if (!files.length) throw new Error("No CEFR-J A1 full-lesson draft batch found");
const catalogue = ["lex-a1.json", "lex-a2.json", "lex-b1.json", "lex-b2.json", "lex-b2x.json", "lex-c1.json"]
  .flatMap(file => JSON.parse(readText("public/data/" + file)) as { id: string; pos: string; ex: string; tr: string; fa: string }[]);
const identities = catalogue.map(x => ({ id: x.id, partsOfSpeech: x.pos }));
const inheritedEnglish: string[] = [];
const inheritedPersian: string[] = [];
const en = new Set(["en", "ex", "text", "prompt", "frame", "answer", "wrong", "right", "pattern"]);
const fa = new Set(["fa", "tr", "gloss", "meaning", "why", "wrongFa", "rightFa", "note"]);
function harvest(value: unknown): void {
  if (Array.isArray(value)) value.forEach(harvest);
  else if (value && typeof value === "object") {
    for (const [key, next] of Object.entries(value)) {
      if (typeof next === "string") {
        if (en.has(key)) inheritedEnglish.push(next);
        if (fa.has(key)) inheritedPersian.push(next);
      } else harvest(next);
    }
  }
}
for (const file of fs.readdirSync(path.join(root, "content/pilot/entries")).filter(x => x.endsWith(".json"))) {
  harvest(JSON.parse(readText("content/pilot/entries/" + file)));
}
for (const file of ["scenes.json", "contrasts.json"]) harvest(JSON.parse(readText("content/pilot/" + file)));
harvest(catalogue);

const issues: string[] = [];
let expected = 1;
let count = 0;
const usedIds = new Set<string>();
for (const file of files) {
  const match = /^lessons-new-(\d{3})-(\d{3})\.json$/.exec(file);
  if (!match || Number(match[1]) !== expected || Number(match[2]) < Number(match[1])) {
    issues.push(file + ": missing or malformed new-headword window; expected " + expected);
    continue;
  }
  const batch = JSON.parse(readText(dir + "/" + file)) as CefrjLessonDraftManifest;
  if (batch.window?.firstNewHeadword !== Number(match[1]) || batch.window?.lastNewHeadword !== Number(match[2])) {
    issues.push(file + ": filename does not match its source window");
  }
  issues.push(...auditCefrjLessonDrafts(batch, {
    selected: a1.selected, words: levels.words, identities,
    selectionSha256: sha256(a1Text), levelSelectionSha256: sha256(levelText),
    inheritedEnglish, inheritedPersian,
  }).map(x => file + ": " + x));
  for (const draft of batch.lessons ?? []) {
    if (usedIds.has(draft.entry.id)) issues.push(file + ": duplicate entry ID across batches " + draft.entry.id);
    usedIds.add(draft.entry.id);
    for (const s of draft.entry.senses) {
      inheritedEnglish.push(...s.examples.map(x => x.en));
      inheritedPersian.push(...s.examples.map(x => x.fa));
    }
  }
  expected = Number(match[2]) + 1;
  count += batch.lessons?.length ?? 0;
}
const total = new Set(a1.selected.filter(x => x.courseStatus === "NEW").map(x => x.cefrjHeadword)).size;
console.log("CEFR-J full A1 lesson drafts: " + (issues.length ? "FAIL" : "PASS") + " (" + count + "/" + total +
  " new headwords drafted; 0 independent approvals, 0 audio certificates, 0 rights clearances, 0 public releases).");
for (const issue of issues) console.error("! " + issue);
if (issues.length) process.exitCode = 1;
