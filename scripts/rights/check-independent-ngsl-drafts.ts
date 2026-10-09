import fs from "node:fs";
import path from "node:path";
import {
  auditUnreviewedNgslDrafts,
  type NgslDraftManifest,
} from "../../src/lib/learn/rights-independent-ngsl-drafts";
import type { IndependentNgslSelection } from "../../src/lib/learn/rights-independent-ngsl";

const ROOT = process.cwd();
function read<T>(p: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8")) as T;
}
const selection = read<IndependentNgslSelection>(
  "content/rights-staging/ngsl-1.2/independent-first-900-selection.json",
);
const drafts = read<NgslDraftManifest>(
  "content/rights-staging/ngsl-1.2/independent-first-20-drafts.json",
);
const nextDrafts = read<NgslDraftManifest>(
  "content/rights-staging/ngsl-1.2/independent-ranks-21-40-drafts.json",
);


const inheritedEnglish: string[] = [];
const inheritedPersian: string[] = [];
const en = new Set(["en", "text", "prompt", "frame", "answer", "wrong", "right", "pattern"]);
const fa = new Set(["fa", "gloss", "meaning", "why", "wrongFa", "rightFa", "note"]);
function harvest(value: unknown) {
  if (Array.isArray(value)) {
    value.forEach(harvest);
  } else if (value && typeof value === "object") {
    for (const [key, next] of Object.entries(value)) {
      if (typeof next === "string") {
        if (en.has(key)) inheritedEnglish.push(next);
        if (fa.has(key)) inheritedPersian.push(next);
      } else harvest(next);
    }
  }
}
const dir = path.join(ROOT, "content", "pilot", "entries");
for (const file of fs.readdirSync(dir).filter(x => x.endsWith(".json")).sort()) {
  harvest(read<unknown>("content/pilot/entries/" + file));
}
for (const file of ["scenes.json", "contrasts.json"]) {
  harvest(read<unknown>("content/pilot/" + file));
}
const issues = auditUnreviewedNgslDrafts(
  drafts, selection, inheritedEnglish, inheritedPersian,
);
// Rank 21–40 is *not* a new selection. Audit against the exact pinned
// second contiguous slice, then against inherited texts and earlier
// independent drafts. A changed source rank, forged approval, or missing
// lesson must fail rather than silently excluding the new batch.
if (selection.entries.length !== 900 ||
    nextDrafts.lessons?.length !== 20 ||
    nextDrafts.lessons[0]?.sourceRank !== 21 ||
    nextDrafts.lessons[19]?.sourceRank !== 40) {
  issues.push("NGSL follow-up batch must cover exactly ranks 21–40");
}
const firstDraftEnglish = drafts.lessons.flatMap(x => x.examples.map(e => e.en));
const firstDraftPersian = drafts.lessons.flatMap(x => x.examples.map(e => e.fa));
issues.push(...auditUnreviewedNgslDrafts(
  nextDrafts,
  { ...selection, entries: selection.entries.slice(20, 40) },
  [...inheritedEnglish, ...firstDraftEnglish],
  [...inheritedPersian, ...firstDraftPersian],
).map(issue => "NGSL ranks 21-40: " + issue));

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({
    status: drafts.status,
    sourceCandidates: selection.entries.length,
    drafts: drafts.lessons.length + nextDrafts.lessons.length,
    firstBatch: drafts.lessons.length,
    secondBatch: nextDrafts.lessons.length,
    independentlyReviewed: 0,
    rightsCleared: 0,
    publicRelease: 0,
    inheritedEnglishFields: inheritedEnglish.length,
    inheritedPersianFields: inheritedPersian.length,
    issues,
  }, null, 2));
} else {
  console.log("NGSL original lesson staging: " + (issues.length ? "FAIL" : "PASS") +
    " (40 unreviewed bilingual drafts in two source-pinned batches; 0 semantic approvals; 0 rights clearances; 0 public releases).");
  for (const issue of issues) console.error("! " + issue);
}
if (issues.length) process.exitCode = 1;
