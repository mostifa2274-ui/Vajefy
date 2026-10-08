import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  draftAudit,
  auditOewnSenseReferences,
  type OewnSenseReferenceManifest,
  type DraftManifest,
  type IndependentWordnetCandidate,
} from "../../src/lib/learn/rights-staging";

const ROOT = process.cwd();
const staging = path.join(ROOT, "content", "rights-staging");
const original = JSON.parse(fs.readFileSync(
  path.join(staging, "oewn-2025-candidates.json"), "utf8",
)) as {
  candidateCount: number;
  candidates: IndependentWordnetCandidate[];
  sourceArchiveSha256: string;
  status: string;
};
if (original.status !== "STAGING_ONLY_UNREVIEWED_NOT_RELEASE_CLEARED" ||
    original.candidateCount !== original.candidates.length) {
  throw new Error("The pinned WordNet candidate intake changed or is no longer staging-only.");
}

// Source excerpts must ship with the *exact* upstream legal notices.
// Git blob hash pins the verbatim LICENSE.md from OEWN tag 2025-edition.
const licenseFile = fs.readFileSync(path.join(staging, "OEWN-2025-LICENSE.md"));
const licenseGitBlob = createHash("sha1")
  .update("blob " + licenseFile.length + "\0")
  .update(licenseFile)
  .digest("hex");
if (licenseGitBlob !== "fe4d1dce8109caa7016fca97f48e49a9ced36ad4") {
  throw new Error("Pinned OEWN 2025/Princeton source licence notices are missing or altered.");
}

const data = JSON.parse(fs.readFileSync(
  path.join(staging, "independent-a1-editorial-drafts.json"), "utf8",
)) as DraftManifest;
const candidates = new Map(original.candidates.map(item =>
  [item.lemma + "|" + item.partOfSpeech, item] as const,
));
const inheritedEnglish: string[] = [];
const inheritedPersian: string[] = [];
const englishFields = new Set(["en", "text", "prompt", "frame", "answer", "wrong", "right", "pattern", "headword"]);
const persianFields = new Set(["fa", "gloss", "meaning", "why", "wrongFa", "rightFa", "note"]);
function harvest(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(harvest);
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === "string") {
        if (englishFields.has(key)) inheritedEnglish.push(item);
        if (persianFields.has(key)) inheritedPersian.push(item);
      } else harvest(item);
    }
  }
}

const dir = path.join(ROOT, "content", "pilot", "entries");
for (const file of fs.readdirSync(dir).filter(name => name.endsWith(".json")).sort()) {
  harvest(JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as unknown);
}
for (const file of ["scenes.json", "contrasts.json"]) {
  harvest(JSON.parse(fs.readFileSync(path.join(ROOT, "content", "pilot", file), "utf8")) as unknown);
}

const references = JSON.parse(fs.readFileSync(
  path.join(staging, "oewn-2025-sense-references.json"), "utf8",
)) as OewnSenseReferenceManifest;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const sourceErrors = auditOewnSenseReferences(
  references, original.candidates, original.sourceArchiveSha256, digest,
);
const errors = [
  ...sourceErrors,
  ...draftAudit(data, candidates, original.sourceArchiveSha256,
    inheritedEnglish, inheritedPersian),
];
const bySourceKey = new Map(references.references.map(r =>
  [r.candidate.wordNetSenseKey, r] as const,
));
const unresolvedSenseDrafts = data.drafts.filter(d =>
  d.sourceSenseMatch !== "NOT_YET_VERIFIED" ||
  !bySourceKey.has(d.candidate.wordNetSenseKey),
).length;
const nonPrimarySenseDrafts = data.drafts.filter(d =>
  (bySourceKey.get(d.candidate.wordNetSenseKey)?.senseNumber ?? 0) > 1,
).length;
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({
    status: data.status,
    drafts: data.drafts?.length ?? 0,
    candidates: original.candidates.length,
    inheritedEnglishFields: inheritedEnglish.length,
    inheritedPersianFields: inheritedPersian.length,
    sourceReferenceCount: references.references.length,
    sourceReferenceIntegrity: sourceErrors.length === 0,
    editorialSenseReviewsPassed: 0,
    nonPrimarySenseDrafts,
    unresolvedSenseDrafts,
    passed: errors.length === 0,
    errors,
  }, null, 2));
} else {
  console.log("Independent A1 editorial staging: " +
    (errors.length ? "FAIL" : "PASS") +
    " (" + data.drafts.length + " draft entries, " +
    original.candidates.length + " pinned lexical candidates); " +
    "WordNet source references: " + references.references.length + "; " +
    "non-primary linked senses: " + nonPrimarySenseDrafts + "/" + data.drafts.length + "; " +
    "rights approval: NONE; public release: FORBIDDEN.");
  for (const error of errors.slice(0, 30)) console.error("! " + error);
}
if (errors.length) process.exitCode = 1;
