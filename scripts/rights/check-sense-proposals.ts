import fs from "node:fs";
import path from "node:path";
import {
  auditSenseProposals,
  type ProposalManifest,
} from "../../src/lib/learn/rights-sense-proposals";

const ROOT = path.join(process.cwd(), "content", "rights-staging");
function read<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, name), "utf8")) as T;
}
const manifest = read<ProposalManifest>("oewn-2025-sense-proposals.json");
const drafts = read<Parameters<typeof auditSenseProposals>[1]>("independent-a1-editorial-drafts.json");
const alternatives = read<Parameters<typeof auditSenseProposals>[2]>("oewn-2025-draft-alternatives.json");
const errors = auditSenseProposals(manifest, drafts, alternatives);
const report = {
  status: manifest.status,
  pinnedSource: manifest.sourceArchiveSha256,
  proposals: manifest.proposals.length,
  remainingDraftsWithoutProposals: drafts.drafts.length - manifest.proposals.length,
  selectedForRelease: 0,
  independentlyApproved: 0,
  rightsCleared: 0,
  errors,
};
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    "OEWN A1 sense proposals: " + (errors.length ? "FAIL" : "PASS") +
    " (" + report.proposals + " model suggestions, " +
    report.remainingDraftsWithoutProposals +
    " remaining independent drafts; 0 human approvals; 0 rights clearances).",
  );
  for (const error of errors) console.error("! " + error);
}
if (errors.length) process.exitCode = 1;
