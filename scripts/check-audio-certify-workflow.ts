import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const WORKFLOW = path.join(ROOT, ".github", "workflows", "audio-certify.yml");
const COMMIT = path.join(ROOT, "scripts", "audio-certification-commit.sh");
const AUTHORITY = path.join(ROOT, "scripts", "audio-certification.ts");
const RECOGNIZER = path.join(ROOT, "scripts", "audio", "certify_audio.py");
const CANDIDATE_GENERATOR = path.join(ROOT, "scripts", "audio", "generate_repair_candidates.py");
const PROMOTER = path.join(ROOT, "scripts", "audio", "promote_repair_candidates.py");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(WORKFLOW)) fail("Missing .github/workflows/audio-certify.yml");
if (!fs.existsSync(COMMIT)) fail("Missing scripts/audio-certification-commit.sh");
const workflow = fs.readFileSync(WORKFLOW, "utf8");
const commit = fs.readFileSync(COMMIT, "utf8");
const authority = fs.readFileSync(AUTHORITY, "utf8");
const recognizer = fs.readFileSync(RECOGNIZER, "utf8");
const candidateGenerator = fs.readFileSync(CANDIDATE_GENERATOR, "utf8");
const promoter = fs.readFileSync(PROMOTER, "utf8");

for (const marker of [
  "branches: [main]",
  "contents: write",
  "group: audio-certification",
  "cancel-in-progress: false",
  "scripts/audio/requirements-certify.txt",
  "VOSK_ARCHIVE_SHA256",
  "KOKORO_MODEL_SHA256",
  "KOKORO_VOICES_SHA256",
  "scripts/audio/certify_audio.py",
  "scripts/audio/generate_repair_candidates.py",
  "scripts/audio/promote_repair_candidates.py",
  "assurance:audio:repair:plan",
  "assurance:audio:repair:evaluate",
  "assurance:audio:repair:check",
  "[audio-bot]",
  "assurance:audio -- --write",
  "scripts/audio-certification-commit.sh",
  "assurance:audio:strict",
]) {
  if (!workflow.includes(marker)) fail(`Audio certification workflow marker missing: ${marker}`);
}

if (/secrets\./.test(workflow)) fail("Audio certification must not use repository secrets.");
if (/curl[^\n]*(api|openai|anthropic|workers)/i.test(workflow)) {
  fail("Audio certification must not call hosted inference APIs.");
}
if (/git (commit|push)/.test(workflow)) {
  fail("The workflow may commit only through scripts/audio-certification-commit.sh.");
}

const triggerBlock = /^on:\n((?: {2}.*\n|\n)*)/m.exec(workflow)?.[1] ?? "";
const triggers = [...triggerBlock.matchAll(/^ {2}([a-z_]+):/gm)].map((match) => match[1]);
for (const trigger of triggers) {
  if (!["push", "workflow_dispatch"].includes(trigger!)) {
    fail(`Audio certification has forbidden trigger: ${trigger}`);
  }
}
if (!triggers.includes("push")) fail("Audio certification must run automatically on relevant main pushes.");

const pathsBlock = /paths:\n((?: {6}- .*\n)+)/.exec(workflow)?.[1] ?? "";
if (!pathsBlock) fail("Audio certification push trigger needs an explicit path allowlist.");
if (!pathsBlock.includes("content/assurance/audio/repair-policy.json")) {
  fail("Changing the frozen repair policy must retrigger audio certification.");
}
for (const generated of [
  "content/assurance/audio/recognition.json",
  "content/assurance/audio/certificates.json",
  "content/assurance/audio/repair-log.json",
]) {
  if (pathsBlock.includes(generated)) {
    fail("Generated evidence ledgers must not retrigger the expensive certification workflow: " + generated);
  }
}
for (const sourceInput of [
  "content/pilot/audio-manifest.json",
  "content/pilot/audio-report.json",
  "public/audio/pilot/**",
]) {
  if (!pathsBlock.includes(sourceInput)) {
    fail("Changing shipped audio inputs must retrigger certification: " + sourceInput);
  }
}
if (!workflow.includes("!contains(github.event.head_commit.message, '[audio-bot]')")) {
  fail("Audio bot commits must be prevented from recursively running certification.");
}

for (const marker of [
  "npm run -s assurance:audio:check",
  "git push origin HEAD:main",
  "content/assurance/audio/recognition.json",
  "content/assurance/audio/certificates.json",
]) {
  if (!commit.includes(marker)) fail(`Audio evidence commit safety marker missing: ${marker}`);
}
if (/git add\s+(-A|--all|\.)(\s|$)/m.test(commit)) {
  fail("Audio evidence commit script must never stage the repository broadly.");
}
if (/push\s+(-f|--force)/.test(commit)) fail("Audio evidence commit script must never force-push.");

if (!authority.includes("expectedText: entry.headword")) {
  fail("TypeScript audio authority must compare ASR with the learner-facing entry headword.");
}
if (!recognizer.includes('"expectedText": entry["headword"]')) {
  fail("Python recognizer must compare ASR with the learner-facing entry headword.");
}
if (authority.includes("expectedText: word.text") || recognizer.includes('"expectedText": word["text"]')) {
  fail("Synthesis text/phonemes must never become the lexical ASR target.");
}
if (!candidateGenerator.includes('"clipFile": "candidates/"')) {
  fail("Repair candidates must remain outside the public audio namespace until promotion.");
}
if (!promoter.includes('outcome["outcome"] != "CERTIFIED"')) {
  fail("The promoter must explicitly refuse non-certified candidates.");
}
if (!promoter.includes('sha256(source) != candidate["sourceClipSha256"]')) {
  fail("Candidate promotion must remain bound to the exact source clip SHA-256.");
}
if (!promoter.includes('sha256(generated) != candidate["clipSha256"]')) {
  fail("Candidate promotion must verify the certified candidate SHA-256.");
}

console.log("Audio certification workflow safety: PASS (offline recognizers, bounded certify-before-promote repair, lexical headword targets, main/path gated, narrow bot commits).");
