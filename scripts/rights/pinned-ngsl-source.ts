import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  checkIndependentNgslSelection,
  independentNgslSelection,
  readRankedNgslCore,
  type IndependentNgslSelection,
} from "../../src/lib/learn/rights-independent-ngsl";

const PREFIX = "content/rights-staging/ngsl-1.2";

/** Verify upstream bytes against fixed pins, never pins supplied by the manifest. */
export function readPinnedNgslSelection(root: string): IndependentNgslSelection {
  function verifiedGitBlob(name: string, expected: string): Buffer {
    const raw = fs.readFileSync(path.join(root, PREFIX, name));
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
  return independentNgslSelection(readRankedNgslCore(core.toString("utf8")));
}

/** Source metadata, all 900 candidates and zero-approval flags must match the bytes. */
export function readVerifiedNgslSelection(root: string): IndependentNgslSelection {
  const expected = readPinnedNgslSelection(root);
  const text = fs.readFileSync(path.join(root, PREFIX, "independent-first-900-selection.json"), "utf8");
  const issues = checkIndependentNgslSelection(JSON.parse(text), expected);
  if (text !== JSON.stringify(expected, null, 2) + "\n" || issues.length) {
    throw new Error("NGSL independent selection is stale or implies false approval: " + issues.join("; "));
  }
  return expected;
}
