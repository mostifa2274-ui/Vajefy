import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  buildIndependentNgslSelection,
  NGSL_CORE_GIT_BLOB,
  NGSL_LICENSE_GIT_BLOB,
} from "../../src/lib/learn/rights-ngsl-independent";

const root = path.join(process.cwd(), "content", "rights-staging", "ngsl-1.2");
const core = fs.readFileSync(path.join(root, "core.csv"));
const license = fs.readFileSync(path.join(root, "CC-BY-SA-4.0-LICENSE.txt"));
const gitBlob = (input: Buffer) =>
  createHash("sha1").update("blob " + input.length + "\0").update(input).digest("hex");

if (gitBlob(core) !== NGSL_CORE_GIT_BLOB ||
    gitBlob(license) !== NGSL_LICENSE_GIT_BLOB) {
  throw new Error("Pinned NGSL source or licence notice SHA-1 changed; refusing regeneration.");
}
if (!license.toString("utf8").includes("Attribution-ShareAlike 4.0")) {
  throw new Error("NGSL source licence notice missing Attribution-ShareAlike 4.0");
}
const selected = buildIndependentNgslSelection(core.toString("utf8"));
const target = path.join(root, "independent-first900-selection.json");
const expected = JSON.stringify(selected, null, 2) + "\n";
if (fs.readFileSync(target, "utf8") !== expected) {
  throw new Error("NGSL independent-selection staging differs from pinned-source deterministic output. No self-healing, public promotion, or licence inference allowed.");
}
if (selected.candidates.some(row => row.publicRelease !== false ||
  row.reviewStatus !== "A1_CEFR_SENSE_AND_PEDAGOGY_NOT_REVIEWED")) {
  throw new Error("No candidate may claim human/CEFR review or public release.");
}
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({
    schemaVersion: selected.schemaVersion,
    stagedOnly: true,
    upstreamCore: selected.source.coreGitBlobSha1,
    sourceRows: 2809,
    selected: selected.selectedCount,
    independentlyReviewed: selected.independentlyApprovedCount,
    rightsCleared: 0,
    released: 0,
  }, null, 2));
} else {
  console.log("Pinned independent NGSL source selection: PASS (900/900 ranks, 0 CEFR/sense/pedagogical approvals, 0 released).");
}
