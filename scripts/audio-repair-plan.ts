import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  audioCertificateManifest,
  audioRepairLog,
  audioRepairPlan,
  audioRepairPolicy,
  planAudioRepairs,
} from "../src/lib/learn/audio-assurance";

const ROOT = process.cwd();
const CERTIFICATES = path.join(ROOT, "content", "assurance", "audio", "certificates.json");
const POLICY = path.join(ROOT, "content", "assurance", "audio", "repair-policy.json");
const LOG = path.join(ROOT, "content", "assurance", "audio", "repair-log.json");

function read(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const certificates = audioCertificateManifest.safeParse(read(CERTIFICATES));
if (!certificates.success) {
  fail("Invalid audio certificates: " + certificates.error.issues.map((issue) => issue.message).join("; "));
}
const policy = audioRepairPolicy.safeParse(read(POLICY));
if (!policy.success) {
  fail("Invalid audio repair policy: " + policy.error.issues.map((issue) => issue.message).join("; "));
}
const log = audioRepairLog.safeParse(read(LOG));
if (!log.success) {
  fail("Invalid audio repair log: " + log.error.issues.map((issue) => issue.message).join("; "));
}
if (log.data.policyVersion !== policy.data.policyVersion) {
  fail("Audio repair log and policy versions differ.");
}
const policySha256 = crypto.createHash("sha256").update(fs.readFileSync(POLICY)).digest("hex");
if (log.data.policySha256 !== null && log.data.policySha256 !== policySha256) {
  fail("Audio repair history belongs to different repair-policy.json bytes; migrate or reset it explicitly.");
}

// A candidate promoted into the current manifest gets one final full-corpus
// certification before any bot commit. If that exact candidate SHA is current,
// its final certificate must still be CERTIFIED.
for (const record of certificates.data.records) {
  const promoted = log.data.attempts.find(
    (attempt) =>
      attempt.targetId === record.targetId &&
      attempt.outcome === "CERTIFIED" &&
      attempt.candidateClipSha256 === record.clipSha256,
  );
  if (promoted && record.status !== "CERTIFIED") {
    fail(record.targetId + ": promoted candidate is not certified by the final full-corpus pass.");
  }
}

const plan = audioRepairPlan.parse({
  schemaVersion: 1,
  policyVersion: policy.data.policyVersion,
  items: planAudioRepairs(certificates.data, policy.data, log.data),
});

if (process.argv.includes("--check")) {
  console.log(
    "Audio repair planning: PASS (" +
      plan.items.length +
      " next candidate" +
      (plan.items.length === 1 ? "" : "s") +
      "; policy " +
      plan.policyVersion +
      ").",
  );
  process.exit(0);
}

const at = process.argv.indexOf("--output");
const output = at >= 0 ? process.argv[at + 1] : path.join(ROOT, ".audio-repair", "plan.json");
if (!output) fail("--output requires a path.");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(plan, null, 2) + "\n");
console.log("Audio repair plan: " + plan.items.length + " candidate(s) -> " + output);
