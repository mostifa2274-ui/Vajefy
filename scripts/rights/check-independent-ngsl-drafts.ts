import fs from "node:fs";
import path from "node:path";
import {
  auditUnreviewedNgslDrafts,
  ngslDraftBatchFiles,
  type NgslDraftManifest,
} from "../../src/lib/learn/rights-independent-ngsl-drafts";
import type { IndependentNgslSelection } from "../../src/lib/learn/rights-independent-ngsl";
import { readVerifiedNgslSelection } from "./pinned-ngsl-source";

const ROOT = process.cwd();
function read<T>(p: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8")) as T;
}
const selection = readVerifiedNgslSelection(ROOT);
const dirOfDrafts = "content/rights-staging/ngsl-1.2";
const sequence = ngslDraftBatchFiles(
  fs.readdirSync(path.join(ROOT, dirOfDrafts)),
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
// The filename sequence is the sole roster. There is no manual per-batch
// allowlist that could silently forget a new file or skip ranks in the middle.
const issues = [...sequence.issues];
const reviewedBatches: { filename: string; count: number; ranks: string }[] = [];
const previousEnglish: string[] = [];
const previousPersian: string[] = [];
for (const [index, filename] of sequence.filenames.entries()) {
  const begin = index * 20 + 1;
  const end = begin + 19;
  if (end > selection.entries.length) {
    issues.push("NGSL draft batch extends beyond the 900-source selection: " + filename);
    continue;
  }
  const batch = read<NgslDraftManifest>(dirOfDrafts + "/" + filename);
  if (batch.lessons?.[0]?.sourceRank !== begin ||
      batch.lessons?.at(-1)?.sourceRank !== end) {
    issues.push(filename + ": must cover exact rank interval " + begin + "-" + end);
  }
  const scopedSource: IndependentNgslSelection = {
    ...selection, entries: selection.entries.slice(begin - 1, end),
  };
  issues.push(...auditUnreviewedNgslDrafts(
    batch, scopedSource,
    [...inheritedEnglish, ...previousEnglish],
    [...inheritedPersian, ...previousPersian],
  ).map(issue => filename + ": " + issue));
  previousEnglish.push(...(batch.lessons ?? []).flatMap(x => x.examples?.map(y => y.en) ?? []));
  previousPersian.push(...(batch.lessons ?? []).flatMap(x => x.examples?.map(y => y.fa) ?? []));
  reviewedBatches.push({ filename, count: batch.lessons?.length ?? 0, ranks: begin + "-" + end });
}
const totalDrafts = reviewedBatches.reduce((n, b) => n + b.count, 0);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({
    status: "STAGING_ONLY_AI_AUTHORED_LESSONS_NOT_INDEPENDENTLY_VERIFIED",
    sourceCandidates: selection.entries.length,
    drafts: totalDrafts,
    batches: reviewedBatches,
    independentlyReviewed: 0,
    rightsCleared: 0,
    publicRelease: 0,
    inheritedEnglishFields: inheritedEnglish.length,
    inheritedPersianFields: inheritedPersian.length,
    issues,
  }, null, 2));
} else {
  console.log("NGSL original lesson staging: " + (issues.length ? "FAIL" : "PASS") +
    " (" + totalDrafts + " unreviewed bilingual drafts in " +
    reviewedBatches.length + " contiguous source-pinned batches; " +
    "0 semantic approvals; 0 rights clearances; 0 public releases).");
  for (const issue of issues) console.error("! " + issue);
}
if (issues.length) process.exitCode = 1;
