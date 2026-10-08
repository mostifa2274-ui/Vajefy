import fs from "node:fs";
import path from "node:path";
import { loadCurrentRightsAudit } from "./rights-lineage-audit";
import {
  provenanceBlockers,
  provenanceManifest,
} from "../src/lib/learn/assurance";

const file = path.join(process.cwd(), "content", "assurance", "provenance.json");
const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
const parsed = provenanceManifest.safeParse(raw);

if (!parsed.success) {
  console.error("Gate 0 provenance manifest is invalid:");
  for (const issue of parsed.error.issues) {
    console.error(`- ${issue.path.join(".") || "<root>"}: ${issue.message}`);
  }
  process.exit(1);
}

const lineage = loadCurrentRightsAudit();
const blockers = [
  ...provenanceBlockers(parsed.data),
  ...lineage.structuralIssues.map(issue => "rights-lineage:" + issue),
  ...lineage.blockers,
];
const report = {
  schemaVersion: parsed.data.schemaVersion,
  sources: parsed.data.sources.length,
  cleared: parsed.data.sources.filter((source) => source.status === "cleared").length,
  releaseReady: blockers.length === 0,
  lineage: {
    entries: lineage.entries,
    entriesCleared: lineage.entriesCleared,
    publicData: lineage.publicData,
    publicDataCleared: lineage.publicDataCleared,
    curatedContent: lineage.curatedContent,
    curatedContentCleared: lineage.curatedContentCleared,
    mediaGroups: lineage.mediaGroups,
    mediaGroupsCleared: lineage.mediaGroupsCleared,
    structuralIssues: lineage.structuralIssues,
  },
  blockers,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `Gate 0 provenance: ${report.cleared}/${report.sources} source(s) cleared; release-ready=${report.releaseReady ? "yes" : "no"}.`,
  );
  for (const blocker of blockers.slice(0, 15)) console.log(`! ${blocker}`);
  if (blockers.length > 15) console.log(`! ... plus ${blockers.length - 15} more blockers`);
}

if (lineage.structuralIssues.length || (process.argv.includes("--require-release-ready") && blockers.length)) {
  console.error(
    "Gate 0 is blocked. Public release requires explicit machine-readable redistribution and derivative-work rights for every distributed source.",
  );
  process.exit(1);
}
