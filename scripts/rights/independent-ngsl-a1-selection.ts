import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  checkIndependentNgslSelection,
  independentNgslSelection,
  readRankedNgslCore,
} from "../../src/lib/learn/rights-independent-ngsl";

const root = process.cwd();
const dir = path.join(root, "content", "rights-staging", "ngsl-1.2");
const output = path.join(dir, "independent-first-900-selection.json");
function verifiedGitBlob(name: string, expected: string): Buffer {
  const raw = fs.readFileSync(path.join(dir, name));
  const sha = createHash("sha1")
    .update("blob " + raw.length + "\0")
    .update(raw)
    .digest("hex");
  if (sha !== expected) throw new Error("Pinned upstream NGSL file changed: " + name);
  return raw;
}
const core = verifiedGitBlob("core.csv", "b8705be6c208bbee4450a208eb39a5be4dea8f63");
const license = verifiedGitBlob(
  "CC-BY-SA-4.0-LICENSE.txt",
  "2d58298e6eda10e7204abb52722efbc840db2390",
).toString("utf8");
if (!license.includes("Attribution-ShareAlike 4.0")) {
  throw new Error("NGSL CC BY-SA license notice cannot be verified");
}
const selected = independentNgslSelection(readRankedNgslCore(core.toString("utf8")));
const expectedText = JSON.stringify(selected, null, 2) + "\n";
if (process.argv.includes("--write")) {
  fs.writeFileSync(output, expectedText);
  console.log("Staged 900 independently rank-selected NGSL candidate lemmas; 0 A1, semantic or rights approvals");
} else {
  const actualText = fs.readFileSync(output, "utf8");
  const violations = checkIndependentNgslSelection(JSON.parse(actualText), selected);
  if (actualText !== expectedText || violations.length) {
    throw new Error("NGSL independent selection is stale or implies false approval: " + violations.join("; "));
  }
  console.log("NGSL independent first-900 selection: PASS (source-pinned; 900 selection candidates; 0 lesson/CEFR/rights approvals)");
}
