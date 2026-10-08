import { loadCurrentRightsAudit } from "./rights-lineage-audit";

const report = loadCurrentRightsAudit();
const releaseReady = report.structuralIssues.length === 0 && report.blockers.length === 0;
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ ...report, releaseReady }, null, 2));
} else {
  console.log(
    "Rights lineage: " + report.entriesCleared + "/" + report.entries +
    " A1 entries and " + report.publicDataCleared + "/" + report.publicData +
    " public JSON files cleared; Gate 0 " + (releaseReady ? "READY" : "BLOCKED") + ".",
  );
  for (const issue of report.structuralIssues.slice(0, 20)) console.error("! " + issue);
  for (const blocker of report.blockers.slice(0, 10)) console.log("! " + blocker);
  if (report.blockers.length > 10) console.log("! ... plus " + (report.blockers.length - 10) + " more rights blockers.");
}
if (report.structuralIssues.length || (process.argv.includes("--require-cleared") && !releaseReady)) {
  process.exitCode = 1;
}
