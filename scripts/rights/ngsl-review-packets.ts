import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  auditUnreviewedNgslDrafts,
  ngslDraftBatchFiles,
  type NgslDraftManifest,
  type NgslEditorialDraft,
} from "../../src/lib/learn/rights-independent-ngsl-drafts";
import { readVerifiedNgslSelection } from "./pinned-ngsl-source";

/**
 * Read-only, exact-draft review packets for an eventual independent reviewer.
 *
 * This does not run a judge, interpret copyright, approve CEFR placement,
 * confer rights, or write into the existing learner-facing public corpus.
 * Reviewers MUST NOT be the authoring model/context, and a completed review
 * must separately name evidence, model version and scope before promotion.
 */
const ROOT = process.cwd();
const PREFIX = "content/rights-staging/ngsl-1.2";
const read = <T>(relative: string): T =>
  JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8")) as T;
const source = readVerifiedNgslSelection(ROOT);

const sequence = ngslDraftBatchFiles(fs.readdirSync(path.join(ROOT, PREFIX)));
if (sequence.issues.length) throw new Error(sequence.issues.join("\n"));

const pending: {
  schemaVersion: 1;
  reviewState: "PENDING_INDEPENDENT_REVIEWS_NOT_RELEASE_AUTHORIZATION";
  source: {
    selectionId: string;
    sourceRank: number;
    lemma: string;
    dataset: string;
    upstreamUrl: string;
    coreGitBlobSha: string;
    license: string;
    licenseGitBlobSha: string;
    licensePath: string;
  };
  authoredDraft: NgslEditorialDraft;
  authoringAgent: string;
  draftSha256: string;
  requiredIndependentReviews: {
    englishSense: "PENDING";
    persianAccuracy: "PENDING";
    cefrAndPedagogy: "PENDING";
    copyrightAndShareAlike: "PENDING";
    publicMediaAndDerivatives: "PENDING";
  };
  explicitReleaseApproval: false;
}[] = [];

for (const [batchIndex, filename] of sequence.filenames.entries()) {
  const rankStart = batchIndex * 20 + 1;
  const batch = read<NgslDraftManifest>(PREFIX + "/" + filename);
  const subset = { ...source, entries: source.entries.slice(rankStart - 1, rankStart + 19) };
  const issues = auditUnreviewedNgslDrafts(batch, subset);
  if (issues.length) throw new Error(filename + ": " + issues.join("; "));
  for (const [index, lesson] of batch.lessons.entries()) {
    const sourceItem = source.entries[rankStart - 1 + index];
    if (!sourceItem || sourceItem.sourceRank !== lesson.sourceRank ||
        sourceItem.selectionId !== lesson.selectionId ||
        sourceItem.lemma !== lesson.lemma) {
      throw new Error("Unmatched source-ranked editorial lesson in " + filename);
    }
    // All creator-side drafts remain unaudited. No inferred license or review
    // result can be inserted into an evidence packet by this script.
    const draftSha256 = createHash("sha256")
      .update(JSON.stringify({ authoringAgent: batch.authoringAgent, lesson }))
      .digest("hex");
    pending.push({
      schemaVersion: 1,
      reviewState: "PENDING_INDEPENDENT_REVIEWS_NOT_RELEASE_AUTHORIZATION",
      source: {
        selectionId: sourceItem.selectionId,
        sourceRank: sourceItem.sourceRank,
        lemma: sourceItem.lemma,
        dataset: source.source.edition,
        upstreamUrl: source.source.upstreamUrl,
        coreGitBlobSha: source.source.coreGitBlobSha,
        license: source.source.license,
        licenseGitBlobSha: source.source.licenseGitBlobSha,
        licensePath: source.source.licensePath,
      },
      authoredDraft: lesson,
      authoringAgent: batch.authoringAgent,
      draftSha256,
      requiredIndependentReviews: {
        englishSense: "PENDING",
        persianAccuracy: "PENDING",
        cefrAndPedagogy: "PENDING",
        copyrightAndShareAlike: "PENDING",
        publicMediaAndDerivatives: "PENDING",
      },
      explicitReleaseApproval: false,
    });
  }
}
if (pending.length !== sequence.filenames.length * 20 ||
    pending.some((v, i) => v.source.sourceRank !== i + 1) ||
    pending.some(v => !/^[0-9a-f]{64}$/.test(v.draftSha256))) {
  throw new Error("Review queue lost a draft, changed rank order, or produced an invalid content hash");
}

function positiveFlag(flag: string): number | null {
  const at = process.argv.indexOf(flag);
  if (at === -1) return null;
  const value = process.argv[at + 1];
  const number = Number(value);
  if (!value || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(number)) {
    throw new Error(flag + " expects a positive integer");
  }
  return number;
}
const from = positiveFlag("--from") ?? 1;
const limit = positiveFlag("--limit") ?? pending.length;
if (from > pending.length || from + limit - 1 > pending.length) {
  throw new Error("Requested review packet range is outside staged source ranks");
}
if (process.argv.includes("--check") &&
    (process.argv.includes("--from") || process.argv.includes("--limit"))) {
  throw new Error("Integrity --check must cover every staged independent lesson");
}
const selected = pending.slice(from - 1, from - 1 + limit);
const result = {
  schemaVersion: 1,
  status: "STAGING_REVIEW_PACKETS_ONLY_NOT_PUBLIC_RELEASE",
  sourceCandidates: source.selected,
  authorOnlyDrafts: pending.length,
  independentReviewPassed: 0,
  rightsCleared: 0,
  publicRelease: 0,
  packetFromRank: from,
  packetCount: selected.length,
  packets: selected,
};
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(
    "NGSL independent review packets: " + pending.length + "/" +
    source.selected + " unreviewed source-locked drafts; " +
    "0 independent approvals, 0 rights clearances, 0 releases."
  );
  console.log("Selected ranks " + from + "–" + (from + selected.length - 1) +
    ". Use --json --from N --limit M for SHA-bound, pending-only packets.");
}
