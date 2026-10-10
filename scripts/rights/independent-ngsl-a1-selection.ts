import fs from "node:fs";
import path from "node:path";
import { readPinnedNgslSelection, readVerifiedNgslSelection } from "./pinned-ngsl-source";

const root = process.cwd();
const dir = path.join(root, "content", "rights-staging", "ngsl-1.2");
const output = path.join(dir, "independent-first-900-selection.json");
if (process.argv.includes("--write")) {
  const selected = readPinnedNgslSelection(root);
  fs.writeFileSync(output, JSON.stringify(selected, null, 2) + "\n");
  console.log("Staged 900 independently rank-selected NGSL candidate lemmas; 0 A1, semantic or rights approvals");
} else {
  readVerifiedNgslSelection(root);
  console.log("NGSL independent first-900 selection: PASS (source-pinned; 900 selection candidates; 0 lesson/CEFR/rights approvals)");
}
