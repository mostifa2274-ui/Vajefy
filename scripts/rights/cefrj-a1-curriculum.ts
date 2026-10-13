import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  buildCefrjA1Curriculum, CEFRJ_CURRICULUM_STATUS,
  type Curriculum, type DraftedEntry, type MovedUpEntry,
} from "../../src/lib/learn/rights-cefrj-curriculum";

/**
 * Compose the staged CEFR-J A1 curriculum (rebuild phase 3) from the live A1
 * curriculum, the A1 selection's moved-up entries, the drafted NEW lessons and
 * the unit assignments, and write it to
 * content/rights-staging/a1-rebuild/curriculum-a1-cefrj.json. With --check,
 * fail when the committed file is stale. It does not change the live course.
 */
const root = process.cwd();
const dir = "content/rights-staging/a1-rebuild";
const OUT = `${dir}/curriculum-a1-cefrj.json`;
const sources = {
  curriculum: "content/curriculum/A1.json",
  selection: `${dir}/cefrj-a1-selection.json`,
  assignments: `${dir}/curriculum-assignments.json`,
};
const readText = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const texts = Object.fromEntries(Object.entries(sources).map(([k, f]) => [k, readText(f)])) as Record<keyof typeof sources, string>;
const selection = JSON.parse(texts.selection) as { movedUp: MovedUpEntry[]; rightsCleared: number; lessonsApproved: number };
if (selection.rightsCleared !== 0 || selection.lessonsApproved !== 0) {
  throw new Error("The staged curriculum builder requires the unapproved source-selection state");
}
const batches = fs.readdirSync(path.join(root, dir)).filter(x => /^lessons-new-\d{3}-\d{3}\.json$/.test(x)).sort();
const drafted: DraftedEntry[] = [];
const draftHashes: Record<string, string> = {};
for (const file of batches) {
  const text = readText(`${dir}/${file}`);
  draftHashes[file] = sha256(text);
  const batch = JSON.parse(text) as { lessons: { sourceHeadword: string; entry: { id: string } }[] };
  for (const lesson of batch.lessons) drafted.push({ headword: lesson.sourceHeadword, id: lesson.entry.id });
}

const { staged, issues } = buildCefrjA1Curriculum({
  current: JSON.parse(texts.curriculum) as Curriculum,
  assignments: JSON.parse(texts.assignments),
  drafted,
  movedUp: selection.movedUp,
});

if (staged) {
  const output = {
    schemaVersion: 1,
    status: CEFRJ_CURRICULUM_STATUS,
    description: "Staged A1 curriculum for the CEFR-J rebuild. Current A1 entries that CEFR-J grades A1 keep their ID and, unless curriculum-assignments.json promotes them to an earlier unit, their unit and order; the 166 that it places higher are removed with their destination level; the 338 drafted NEW entries are added where curriculum-assignments.json puts them. Prerequisites that pointed to removed entries, or that a promoted entry no longer waits for, are dropped and listed. Not live: the app still uses content/curriculum/A1.json.",
    sources: {
      ...Object.fromEntries(Object.entries(sources).map(([k, f]) => [k, { file: f, sha256: sha256(texts[k as keyof typeof sources]) }])),
      lessonDrafts: draftHashes,
    },
    curriculumApproved: false,
    liveInApp: false,
    counts: staged.counts,
    removed: staged.removed,
    droppedPrerequisites: staged.droppedPrerequisites,
    promoted: staged.promoted,
    curriculum: staged.curriculum,
  };
  const text = JSON.stringify(output, null, 2) + "\n";
  const current = fs.existsSync(path.join(root, OUT)) ? readText(OUT) : "";
  if (process.argv.includes("--check")) {
    if (current !== text) issues.push(`${OUT} is stale; run npm run assurance:a1:cefrj:curriculum -- --write`);
  } else if (process.argv.includes("--write")) {
    // Keep the last valid staged curriculum when an input is wrong.
    if (issues.length) issues.push(`${OUT} was not written because of the issues above`);
    else fs.writeFileSync(path.join(root, OUT), text);
  }
  const c = staged.counts;
  console.log(`CEFR-J A1 staged curriculum: ${issues.length ? "FAIL" : "PASS"} (${c.entries} entries in ${c.units} units: ` +
    `${c.retained} retained, ${c.added} added, ${c.removed} moved above A1, ${c.promoted} promoted, ` +
    `${c.droppedPrerequisites} prerequisites dropped; ` +
    "not live, 0 curriculum approvals).");
}
for (const issue of issues) console.error("! " + issue);
if (issues.length) process.exitCode = 1;
