import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const WORKFLOW = path.join(ROOT, ".github", "workflows", "audio-certify.yml");
const COMMIT = path.join(ROOT, "scripts", "audio-certification-commit.sh");
const AUTHORITY = path.join(ROOT, "scripts", "audio-certification.ts");
const SOURCE_HASHES = path.join(ROOT, "scripts", "audio-source-hashes.ts");
const SOURCE_SCOPE = path.join(ROOT, "src", "lib", "learn", "audio-source-scope.ts");
const RECOGNIZER = path.join(ROOT, "scripts", "audio", "certify_audio.py");
const CANDIDATE_GENERATOR = path.join(ROOT, "scripts", "audio", "generate_repair_candidates.py");
const PROMOTER = path.join(ROOT, "scripts", "audio", "promote_repair_candidates.py");
const ROLLBACK = path.join(ROOT, "scripts", "audio", "rollback_unstable_promotions.py");
const PRODUCTION_GENERATOR = path.join(ROOT, "scripts", "audio", "generate_audio.py");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(WORKFLOW)) fail("Missing .github/workflows/audio-certify.yml");
if (!fs.existsSync(COMMIT)) fail("Missing scripts/audio-certification-commit.sh");
if (!fs.existsSync(SOURCE_HASHES)) fail("Missing scripts/audio-source-hashes.ts");
if (!fs.existsSync(SOURCE_SCOPE)) fail("Missing src/lib/learn/audio-source-scope.ts");
if (!fs.existsSync(ROLLBACK)) fail("Missing scripts/audio/rollback_unstable_promotions.py");
const workflow = fs.readFileSync(WORKFLOW, "utf8");
const commit = fs.readFileSync(COMMIT, "utf8");
const authority = fs.readFileSync(AUTHORITY, "utf8");
const sourceHashes = fs.readFileSync(SOURCE_HASHES, "utf8");
const sourceScope = fs.readFileSync(SOURCE_SCOPE, "utf8");
const recognizer = fs.readFileSync(RECOGNIZER, "utf8");
const candidateGenerator = fs.readFileSync(CANDIDATE_GENERATOR, "utf8");
const promoter = fs.readFileSync(PROMOTER, "utf8");
const rollback = fs.readFileSync(ROLLBACK, "utf8");
const productionGenerator = fs.readFileSync(PRODUCTION_GENERATOR, "utf8");

for (const marker of [
  "branches: [main]",
  "schedule:",
  'cron: "17 3 * * *"',
  "contents: write",
  "group: audio-certification",
  "cancel-in-progress: false",
  "scripts/audio/requirements-certify.txt",
  "VOSK_ARCHIVE_SHA256",
  "KOKORO_MODEL_SHA256",
  "KOKORO_VOICES_SHA256",
  "scripts/audio/certify_audio.py",
  "scripts/audio-source-hashes.ts",
  "src/lib/learn/audio-source-scope.ts",
  "assurance:audio:scope",
  "--source-hashes .audio-repair/source-hashes.json",
  "Build scoped Unit 1-3 source identity",
  "scripts/audio/generate_repair_candidates.py",
  "scripts/audio/promote_repair_candidates.py",
  "scripts/audio/rollback_unstable_promotions.py",
  "Snapshot scoped release before repair promotion",
  "Roll back final-pass-unstable promotions",
  "--snapshot-dir .audio-repair/baseline",
  "partial-with-untried-candidates",
  "current-PARTIAL-no-untried-candidates",
  "assurance:audio:repair:plan",

  "assurance:audio:repair:evaluate",
  "assurance:audio:repair:check",
  "Decide whether certification needs a retry",
  "assurance:audio:check",
  "--record-automation",
  "AUDIO_AUTOMATION_JOB_STATUS",
  "always() && steps.plan.outputs.run == 'true'",
  "git clean -fdq -- .audio-repair public/data/enhanced",
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
  if (!["push", "schedule", "workflow_dispatch"].includes(trigger!)) {
    fail(`Audio certification has forbidden trigger: ${trigger}`);
  }
}
if (!triggers.includes("push")) fail("Audio certification must run automatically on relevant main pushes.");
if (!triggers.includes("schedule")) fail("Pending or stale audio certification must retry on a bounded schedule.");

const pathsBlock = /paths:\n((?: {6}- .*\n)+)/.exec(workflow)?.[1] ?? "";
if (!pathsBlock) fail("Audio certification push trigger needs an explicit path allowlist.");
if (!pathsBlock.includes("content/assurance/audio/repair-policy.json")) {
  fail("Changing the frozen repair policy must retrigger audio certification.");
}
if (!pathsBlock.includes("scripts/audio/rollback_unstable_promotions.py")) {
  fail("Changing final-pass rollback logic must retrigger audio certification.");
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

const recertifyBlock =
  /- name: Re-certify exact promoted state[\s\S]*?(?=\n {6}- name: Roll back final-pass-unstable promotions)/.exec(workflow)?.[0] ?? "";
if (!recertifyBlock) fail("Audio workflow must contain the exact promoted-state re-certification step.");
const buildAt = recertifyBlock.indexOf("scripts/build-content.ts");
const sourceAt = recertifyBlock.indexOf("assurance:audio:scope -- --output .audio-repair/source-hashes.json");
const recognizeAt = recertifyBlock.indexOf("scripts/audio/certify_audio.py");
if (!(buildAt >= 0 && sourceAt > buildAt && recognizeAt > sourceAt)) {
  fail("Final audio re-certification must rebuild content, then scoped source identity, then recognition.");
}

const rollbackBlock =
  /- name: Roll back final-pass-unstable promotions[\s\S]*?(?=\n {6}- name: Validate exact evidence and promotions)/.exec(workflow)?.[0] ?? "";
if (!rollbackBlock) fail("Audio workflow must contain final-pass rollback before validation.");
for (const marker of [
  "rollback_unstable_promotions.py rollback",
  "--changed-marker .audio-repair/rollback-applied",
  "scripts/build-content.ts",
  "assurance:audio:scope -- --output .audio-repair/source-hashes.json",
  "scripts/audio/certify_audio.py",
  "assurance:audio -- --write",
]) {
  if (!rollbackBlock.includes(marker)) fail("Audio rollback step missing marker: " + marker);
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
if (!authority.includes("buildAudioSourceHashes(ROOT)")) {
  fail("TypeScript audio authority must bind evidence to the canonical scoped source hashes.");
}
for (const marker of [
  "audioSourceScopeProjection",
  "AUDIO_CERTIFICATION_UNITS",
  "headword",
  "pronunciation",
  "duration",
  "peak",
  "rms",
  "bytes",
  "flagged",
]) {
  if (!sourceScope.includes(marker)) fail("Scoped audio source projection marker missing: " + marker);
}
if (!sourceHashes.includes("audioSourceScopeProjection")) {
  fail("Scoped audio source hash builder must consume the canonical projection.");
}
if (!recognizer.includes('"expectedText": entry["headword"]')) {
  fail("Python recognizer must compare ASR with the learner-facing entry headword.");
}
if (!recognizer.includes('parser.add_argument("--source-hashes", type=Path, required=True)')) {
  fail("Python recognizer must require the precomputed scoped source identity.");
}
if (!recognizer.includes('"sourceHashes": source_hashes')) {
  fail("Python recognizer must emit the supplied scoped source identity.");
}
if (
  recognizer.includes('"curriculumSha256": sha256(CURRICULUM)') ||
  recognizer.includes('"enhancedSha256": sha256(ENHANCED)') ||
  recognizer.includes('"audioManifestSha256": sha256(MANIFEST)') ||
  recognizer.includes('"audioReportSha256": sha256(REPORT)')
) {
  fail("Python recognizer must not bind Unit 1-3 evidence to full-corpus file hashes.");
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
if (!promoter.includes('policy_sha256 = sha256(POLICY)') || !promoter.includes('log["policySha256"] = policy_sha256')) {
  fail("Repair history must bind its first attempt to the exact frozen policy SHA-256.");
}
for (const marker of [
  'baseline["clipSha256"] != attempt["sourceClipSha256"]',
  'candidateClipSha256',
  'finalFailures',
  'restored bytes failed SHA-256',
]) {
  if (!rollback.includes(marker)) fail("Final-pass rollback safety marker missing: " + marker);
}
if (
  !productionGenerator.includes('prior_meta.get("repairPolicyVersion")') ||
  !productionGenerator.includes('repaired = True')
) {
  fail("Full audio regeneration must preserve independently certified repaired clips.");
}

console.log("Audio certification workflow safety: PASS (offline recognizers, bounded certify-before-promote repair, durable repaired clips, lexical headword targets, main/path gated, narrow bot commits).");
