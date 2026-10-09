import fs from "node:fs";
import path from "node:path";
import { attestationCannotClearRights, ownerAuthorshipAttestation } from "../../src/lib/learn/rights-owner-attestation";
import { provenanceBlockers, provenanceManifest } from "../../src/lib/learn/assurance";

const root = process.cwd();
const source = (name: string) => JSON.parse(
  fs.readFileSync(path.join(root, "content/assurance", name), "utf8"),
) as unknown;

const statement = ownerAuthorshipAttestation.parse(source("owner-authorship-attestation.json"));
if (!attestationCannotClearRights(statement)) {
  throw new Error("Owner statement cannot establish rights to third-party inputs or derivatives.");
}
const provenance = provenanceManifest.parse(source("provenance.json"));
const blockers = provenanceBlockers(provenance);
console.log(
  "Owner ChatGPT authorship: self-reported for " + statement.categories.length +
  " categories; not file-by-file verified, not a licence. Independent source blockers: " +
  blockers.length + ".",
);
if (!process.argv.includes("--json")) {
  if (blockers.length > 0) {
    console.log("Gate 0 remains BLOCKED until source, item and media rights evidence is verified.");
  }
} else {
  console.log(JSON.stringify({
    claimKind: statement.claimKind,
    categories: statement.categories,
    creator: statement.claimedCreator,
    evidence: statement.creationEvidence,
    legalEffect: statement.legalEffect,
    sourceBlockerCount: blockers.length,
    grantOfThirdPartyRights: false,
  }, null, 2));
}
