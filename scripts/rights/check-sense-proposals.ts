import fs from "node:fs";
import path from "node:path";
import {
  checkUnapprovedSenseProposals,
  type DraftSense,
  type SourceSenseGroup,
  type SenseProposalManifest,
} from "../../src/lib/learn/rights-sense-proposals";

const staging = path.join(process.cwd(), "content", "rights-staging");
const read = (name: string): unknown => JSON.parse(
  fs.readFileSync(path.join(staging, name), "utf8"),
);
const draft = read("independent-a1-editorial-drafts.json") as {
  sourceArchiveSha256: string;
  drafts: DraftSense[];
  status: string;
};
const alternatives = read("oewn-2025-draft-alternatives.json") as {
  status: string;
  sourceArchiveSha256: string;
  draftManifest: string;
  entries: SourceSenseGroup[];
};
const proposals = read("oewn-2025-editorial-sense-proposals.json") as SenseProposalManifest;
const issues = checkUnapprovedSenseProposals(
  proposals,
  alternatives.entries,
  draft.drafts,
  {
    archiveSha256: "38b16326159f51853626b7d24a44c453fa88ab33f06fce5ec8fc5996d1c2be93",
    draftManifest: "content/rights-staging/independent-a1-editorial-drafts.json",
    alternativeManifest: "content/rights-staging/oewn-2025-draft-alternatives.json",
  },
);
if (draft.status !== "STAGING_ONLY_NOT_PUBLIC_NOT_RIGHTS_CLEARED" ||
    alternatives.status !== "STAGING_ONLY_ALTERNATIVE_SENSES_NOT_APPROVED" ||
    alternatives.sourceArchiveSha256 !== draft.sourceArchiveSha256 ||
    alternatives.draftManifest !== proposals.draftManifest) {
  issues.push("Upstream source drafts or alternatives are no longer unchanged staging");
}
if (proposals.draftCount !== 50 || proposals.proposedCount !== 46 ||
    proposals.requiresSplitCount !== 4) {
  issues.push("Unexpected editorial queue drift: 50 original drafts, 46 proposals and 4 splits expected");
}
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({
    status: proposals.status,
    proposed: proposals.proposedCount,
    needsSplit: proposals.requiresSplitCount,
    independentlyReviewed: 0,
    cleared: 0,
    issues,
  }, null, 2));
} else {
  console.log(
    "OEWN sense proposal staging: " + (issues.length ? "FAIL" : "PASS") +
    "; " + proposals.proposedCount + " model-authored suggestions, " +
    proposals.requiresSplitCount + " require polysemy splits, 0 independently approved.",
  );
  for (const issue of issues) console.error("! " + issue);
}
if (issues.length) process.exitCode = 1;
