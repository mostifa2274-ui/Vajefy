import fs from "node:fs";
import path from "node:path";
import {
  audioRecognitionManifest,
  audioRepairCandidateManifest,
  audioRepairPolicy,
  audioRepairRoundResult,
  deriveAudioCertificate,
} from "../src/lib/learn/audio-assurance";

const ROOT = process.cwd();

function argument(name: string, fallback: string): string {
  const at = process.argv.indexOf(name);
  if (at < 0) return path.join(ROOT, fallback);
  const value = process.argv[at + 1];
  if (!value) throw new Error(name + " requires a path");
  return path.resolve(value);
}

function read(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const CANDIDATES = argument("--candidates", ".audio-repair/candidates.json");
const RECOGNITION = argument("--recognition", ".audio-repair/candidate-recognition.json");
const OUTPUT = argument("--output", ".audio-repair/result.json");
const POLICY = path.join(ROOT, "content", "assurance", "audio", "repair-policy.json");

const candidates = audioRepairCandidateManifest.safeParse(read(CANDIDATES));
if (!candidates.success) fail("Invalid repair candidates: " + candidates.error.issues.map((issue) => issue.message).join("; "));
const recognition = audioRecognitionManifest.safeParse(read(RECOGNITION));
if (!recognition.success) fail("Invalid candidate recognition: " + recognition.error.issues.map((issue) => issue.message).join("; "));
const policy = audioRepairPolicy.safeParse(read(POLICY));
if (!policy.success) fail("Invalid audio repair policy: " + policy.error.issues.map((issue) => issue.message).join("; "));

if (candidates.data.policyVersion !== policy.data.policyVersion) fail("Candidate manifest policy does not match frozen repair policy.");
if (recognition.data.generatedAt === null) fail("Candidate recognition cannot be pending.");

const expectedSystems = {
  whisper: ["faster-whisper", "1.2.1", "Systran/faster-whisper-small.en", "4e49ce629e3fa4c3da596c602b212cb026910443"],
  vosk: ["vosk", "0.3.45", "vosk-model-small-en-us-0.15", "0.15"],
  alignment: ["pocketsphinx", "5.1.1", "bundled-en-us", "pocketsphinx-5.1.1"],
} as const;
for (const key of ["whisper", "vosk", "alignment"] as const) {
  const actual = recognition.data.systems[key];
  const expected = expectedSystems[key];
  if (
    actual.engine !== expected[0] ||
    actual.packageVersion !== expected[1] ||
    actual.model !== expected[2] ||
    actual.modelVersion !== expected[3]
  ) {
    fail("Candidate recognition system drifted: " + key);
  }
}

const evidence = new Map(recognition.data.clips.map((clip) => [clip.targetId, clip]));
if (evidence.size !== candidates.data.items.length) {
  fail("Candidate recognition must contain exactly one record for every generated candidate.");
}

const items = candidates.data.items.map((candidate) => {
  const configured = policy.data.candidates[candidate.accent].find((item) => item.id === candidate.candidateId);
  if (!configured) fail(candidate.targetId + ": candidate is not in the frozen repair policy.");
  if (
    candidate.generation.model !== policy.data.model.name ||
    candidate.generation.modelSha256 !== policy.data.model.modelSha256 ||
    candidate.generation.voicesSha256 !== policy.data.model.voicesSha256 ||
    candidate.generation.packageVersion !== policy.data.model.packageVersion ||
    candidate.generation.bitrate !== policy.data.model.bitrate ||
    candidate.generation.voice !== configured.voice ||
    candidate.generation.lang !== configured.lang ||
    candidate.generation.speed !== configured.speed
  ) {
    fail(candidate.targetId + ": generation provenance differs from frozen repair policy.");
  }

  const clip = evidence.get(candidate.targetId);
  if (!clip) fail(candidate.targetId + ": missing independent candidate recognition.");
  const certificate = deriveAudioCertificate(clip, {
    targetId: candidate.targetId,
    unitId: candidate.unitId,
    entryId: candidate.entryId,
    senseId: candidate.senseId,
    accent: candidate.accent,
    clipFile: candidate.clipFile,
    clipSha256: candidate.clipSha256,
    expectedText: candidate.expectedText,
    pronunciation: candidate.pronunciation,
    manifestSignal: candidate.signal,
    legacyIssues: candidate.issues,
  });
  if (certificate.status === "UNCERTAIN") fail(candidate.targetId + ": candidate evidence is unexpectedly uncertain.");

  return {
    targetId: candidate.targetId,
    sourceClipSha256: candidate.sourceClipSha256,
    candidateId: candidate.candidateId,
    candidateClipSha256: candidate.clipSha256,
    outcome: certificate.status,
    blockers: certificate.blockers,
  };
});

const result = audioRepairRoundResult.parse({
  schemaVersion: 1,
  policyVersion: policy.data.policyVersion,
  evaluatedAt: new Date().toISOString(),
  items,
});

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + "\n");
const certified = result.items.filter((item) => item.outcome === "CERTIFIED").length;
console.log("Audio repair round: " + certified + "/" + result.items.length + " candidates independently certified.");
