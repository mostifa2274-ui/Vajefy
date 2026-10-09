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
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({
    status: drafts.status,
    sourceCandidates: selection.entries.length,
    drafts: drafts.lessons.length,
    independentlyReviewed: 0,
    rightsCleared: 0,
    publicRelease: 0,
    inheritedEnglishFields: inheritedEnglish.length,
    inheritedPersianFields: inheritedPersian.length,
    issues,
  }, null, 2));
} else {
  console.log("NGSL original lesson staging: " + (issues.length ? "FAIL" : "PASS") +
    " (20 unreviewed bilingual drafts; 0 semantic approvals; 0 rights clearances; 0 public releases).");
  for (const issue of issues) console.error("! " + issue);
}
if (issues.length) process.exitCode = 1;
