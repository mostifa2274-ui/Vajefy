import assert from "node:assert/strict";
import test from "node:test";
import {
  appendAudioAutomationAttempt,
  audioCertificateManifest,
  audioLexicalMatch,
  audioRecognitionManifest,
  audioRepairLog,
  audioRepairPolicy,
  deriveAudioCertificate,
  MAX_AUDIO_AUTOMATION_ATTEMPTS,
  normalizeAudioAlignmentWords,
  normalizeAudioTranscript,
  planAudioRepairs,
  serializeAudioJson,
} from "./audio-assurance";

test("audio JSON serialization is parseable and ends with one real newline", () => {
  const value = { status: "PARTIAL", summary: { certified: 0, targets: 386 } };
  const serialized = serializeAudioJson(value);
  assert.deepEqual(JSON.parse(serialized), value);
  assert.equal(serialized.endsWith("\n"), true);
  assert.equal(serialized.endsWith("\\n"), false);
  assert.equal(serialized.slice(0, -1).includes("\n"), true);
});

test("audio transcript normalization is conservative but contraction-aware", () => {
  assert.equal(normalizeAudioTranscript("  I\u2019m HERE!  "), "i am here");
  assert.equal(normalizeAudioTranscript("Don't."), "do not");
  assert.equal(normalizeAudioTranscript("B2+"), "b2");
});

test("short A1 forms need exact lexical recognition", () => {
  assert.equal(audioLexicalMatch("family", "family"), true);
  assert.equal(audioLexicalMatch("family", "families"), false);
  assert.equal(audioLexicalMatch("a, an", "an"), true);
  assert.equal(audioLexicalMatch("a, an", "and"), false);
});

test("longer phrases tolerate only one token of ASR noise", () => {
  assert.equal(audioLexicalMatch("I am from Tabriz", "I am from Tabriz"), true);
  assert.equal(audioLexicalMatch("I am from Tabriz", "I am Tabriz"), true);
  assert.equal(audioLexicalMatch("I am from Tabriz", "you are Tabriz"), false);
});

const expected = {
  targetId: "lex:A1:i:gb",
  unitId: "01-introductions",
  entryId: "lex:A1:i",
  senseId: "lex:A1:i",
  accent: "gb" as const,
  clipFile: "pilot/abc.mp3",
  clipSha256: "a".repeat(64),
  expectedText: "I",
  pronunciation: "/a\u026a/",
  manifestSignal: { duration: 0.6, peak: 0.7, rms: 0.1 },
  legacyIssues: [],
};

const evidence = {
  ...expected,
  clipSha256: "a".repeat(64),
  signal: { duration: 0.6, peak: 0.7, rms: 0.1 },
  whisper: { transcript: "I", avgLogProb: -0.1, noSpeechProb: 0.01 },
  vosk: { transcript: "I" },
  alignment: {
    status: "ok" as const,
    words: [
      {
        name: "i",
        start: 3,
        duration: 40,
        phones: [
          { name: "AY", start: 3, duration: 40 },
        ],
      },
    ],
    coverage: 0.67,
    reason: null,
  },
};

test("PocketSphinx boundary tokens and alternate pronunciation labels do not fail lexical alignment", () => {
  assert.deepEqual(
    normalizeAudioAlignmentWords([
      { name: "<s>" },
      { name: "a(2)" },
      { name: "an" },
      { name: "<sil>" },
    ]),
    ["a", "an"],
  );

  const certificate = deriveAudioCertificate(
    {
      ...evidence,
      alignment: {
        ...evidence.alignment,
        words: [
          { name: "<s>", start: 0, duration: 2, phones: [{ name: "SIL", start: 0, duration: 2 }] },
          { name: "i(2)", start: 3, duration: 40, phones: [{ name: "AY", start: 3, duration: 40 }] },
          { name: "<sil>", start: 43, duration: 20, phones: [{ name: "SIL", start: 43, duration: 20 }] },
        ],
      },
    },
    expected,
  );
  assert.equal(certificate.status, "CERTIFIED");
  assert.equal(certificate.criteria.forcedAlignment, true);
});

test("alignment normalization does not exempt boundary tokens from acoustic integrity", () => {
  const certificate = deriveAudioCertificate(
    {
      ...evidence,
      alignment: {
        ...evidence.alignment,
        words: [
          { name: "i", start: 3, duration: 40, phones: [{ name: "AY", start: 3, duration: 40 }] },
          { name: "<sil>", start: 43, duration: 0, phones: [{ name: "SIL", start: 43, duration: 0 }] },
        ],
      },
    },
    expected,
  );
  assert.equal(certificate.criteria.forcedAlignment, false);
  assert.equal(certificate.status, "QUARANTINED");
  assert.equal(certificate.blockers.includes("forced-alignment"), true);
});

test("two ASRs plus alignment can certify exact source-bound audio", () => {
  const certificate = deriveAudioCertificate(evidence, expected);
  assert.equal(certificate.status, "CERTIFIED");
  assert.deepEqual(certificate.blockers, []);
});

test("one agreeing recognizer cannot certify audio", () => {
  const certificate = deriveAudioCertificate(
    { ...evidence, vosk: { transcript: "eye" } },
    expected,
  );
  assert.equal(certificate.status, "QUARANTINED");
  assert.ok(certificate.blockers.includes("vosk-lexical"));
  assert.ok(certificate.blockers.includes("multi-system-disagreement"));
});

test("missing independent evidence stays uncertain, never pass", () => {
  const certificate = deriveAudioCertificate(undefined, expected);
  assert.equal(certificate.status, "UNCERTAIN");
  assert.deepEqual(certificate.blockers, ["missing-independent-recognition"]);
});

test("technical faults veto otherwise agreeing recognition", () => {
  const certificate = deriveAudioCertificate(evidence, {
    ...expected,
    legacyIssues: ["clipping"],
  });
  assert.equal(certificate.status, "QUARANTINED");
  assert.ok(certificate.blockers.includes("signal-integrity"));
});

test("pending recognition and certificates cannot contain source-bound evidence", () => {
  assert.equal(
    audioRecognitionManifest.safeParse({
      schemaVersion: 1,
      evidenceVersion: "vajefy-audio-v1",
      generatedAt: null,
      scope: { units: ["01-introductions"] },
      sourceHashes: null,
      systems: {
        whisper: { engine: "faster-whisper", packageVersion: "1", model: "m", modelVersion: "v" },
        vosk: { engine: "vosk", packageVersion: "1", model: "m", modelVersion: "v" },
        alignment: { engine: "pocketsphinx", packageVersion: "1", model: "m", modelVersion: "v" },
      },
      clips: [{}],
    }).success,
    false,
  );

  assert.equal(
    audioCertificateManifest.safeParse({
      schemaVersion: 1,
      evidenceVersion: "vajefy-audio-v1",
      generatedAt: null,
      status: "CERTIFIED",
      scope: { units: ["01-introductions"] },
      sourceHashes: null,
      recognitionHash: null,
      summary: { targets: 1, certified: 1, uncertain: 0, quarantined: 0 },
      records: [],
    }).success,
    false,
  );
});


const repairPolicy = audioRepairPolicy.parse({
  schemaVersion: 1,
  policyVersion: "test-policy",
  model: {
    name: "kokoro-v1.0",
    modelFile: "kokoro-v1.0.onnx",
    modelSha256: "1".repeat(64),
    voicesFile: "voices-v1.0.bin",
    voicesSha256: "2".repeat(64),
    packageVersion: "0.6.1",
    bitrate: "40k",
  },
  candidates: {
    gb: [
      { id: "gb-one", voice: "bf_isabella", lang: "en-gb", speed: 0.95 },
      { id: "gb-two", voice: "bm_george", lang: "en-gb", speed: 0.95 },
    ],
    us: [{ id: "us-one", voice: "af_bella", lang: "en-us", speed: 0.95 }],
  },
});

function partialCertificate(blockers = ["whisper-lexical", "multi-system-disagreement"]) {
  return audioCertificateManifest.parse({
    schemaVersion: 1,
    evidenceVersion: "vajefy-audio-v1",
    generatedAt: "2026-10-07T00:00:00Z",
    status: "PARTIAL",
    scope: { units: ["01-introductions"] },
    sourceHashes: {
      curriculumSha256: "3".repeat(64),
      enhancedSha256: "4".repeat(64),
      audioManifestSha256: "5".repeat(64),
      audioReportSha256: "6".repeat(64),
    },
    recognitionHash: "7".repeat(64),
    summary: { targets: 1, certified: 0, uncertain: 0, quarantined: 1 },
    records: [
      {
        targetId: "lex:A1:i:gb",
        unitId: "01-introductions",
        entryId: "lex:A1:i",
        senseId: "lex:A1:i",
        accent: "gb",
        clipFile: "pilot/source.mp3",
        clipSha256: "8".repeat(64),
        expectedText: "I",
        pronunciation: "/aɪ/",
        status: "QUARANTINED",
        criteria: {
          sourceIdentity: !blockers.includes("source-identity-mismatch"),
          signalIntegrity: true,
          whisperLexical: false,
          voskLexical: true,
          forcedAlignment: true,
          multiSystemAgreement: false,
        },
        legacyIssues: [],
        blockers,
      },
    ],
  });
}

test("audio automation history is idempotent and bounded", () => {
  let log = audioRepairLog.parse({
    schemaVersion: 1,
    policyVersion: "test-policy",
    policySha256: null,
    attempts: [],
  });
  const base = {
    runAttempt: 1,
    event: "schedule" as const,
    headSha: "a".repeat(40),
    certificateStatus: "PENDING_RECOGNITION" as const,
    certified: 0,
    targets: 386,
    recognitionGeneratedAt: null,
  };
  log = appendAudioAutomationAttempt(log, {
    ...base,
    runId: "same",
    at: "2026-10-07T00:00:00.000Z",
    jobStatus: "failure",
  });
  log = appendAudioAutomationAttempt(log, {
    ...base,
    runId: "same",
    at: "2026-10-07T01:00:00.000Z",
    jobStatus: "success",
  });
  assert.equal(log.automationAttempts.length, 1);
  assert.equal(log.automationAttempts[0]?.jobStatus, "success");

  for (let i = 0; i < MAX_AUDIO_AUTOMATION_ATTEMPTS + 5; i += 1) {
    log = appendAudioAutomationAttempt(log, {
      ...base,
      runId: String(i),
      at: new Date(Date.UTC(2026, 9, 8, 0, i)).toISOString(),
      jobStatus: "failure",
    });
  }
  assert.equal(log.automationAttempts.length, MAX_AUDIO_AUTOMATION_ATTEMPTS);
  assert.equal(log.automationAttempts.some((attempt) => attempt.runId === "same"), false);
  assert.equal(log.automationAttempts.at(-1)?.runId, String(MAX_AUDIO_AUTOMATION_ATTEMPTS + 4));
});

test("audio repair planner picks the first untried candidate deterministically", () => {
  const empty = audioRepairLog.parse({ schemaVersion: 1, policyVersion: "test-policy", policySha256: null, attempts: [] });
  assert.equal(planAudioRepairs(partialCertificate(), repairPolicy, empty)[0]?.candidate.id, "gb-one");

  const once = audioRepairLog.parse({
    schemaVersion: 1,
    policyVersion: "test-policy",
    policySha256: "a".repeat(64),
    attempts: [
      {
        targetId: "lex:A1:i:gb",
        sourceClipSha256: "8".repeat(64),
        candidateId: "gb-one",
        candidateClipSha256: "9".repeat(64),
        at: "2026-10-07T00:01:00Z",
        outcome: "QUARANTINED",
        blockers: ["whisper-lexical"],
      },
    ],
  });
  assert.equal(planAudioRepairs(partialCertificate(), repairPolicy, once)[0]?.candidate.id, "gb-two");
});

test("audio repair planner advances after an isolated certified candidate is rolled back", () => {
  const log = audioRepairLog.parse({
    schemaVersion: 1,
    policyVersion: "test-policy",
    policySha256: "a".repeat(64),
    attempts: [
      {
        targetId: "lex:A1:i:gb",
        sourceClipSha256: "8".repeat(64),
        candidateId: "gb-one",
        candidateClipSha256: "9".repeat(64),
        at: "2026-10-07T00:01:00Z",
        outcome: "CERTIFIED",
        blockers: [],
      },
    ],
    finalFailures: [
      {
        targetId: "lex:A1:i:gb",
        sourceClipSha256: "8".repeat(64),
        candidateId: "gb-one",
        candidateClipSha256: "9".repeat(64),
        at: "2026-10-07T00:02:00Z",
        blockers: ["vosk-lexical", "multi-system-disagreement"],
      },
    ],
  });
  assert.equal(planAudioRepairs(partialCertificate(), repairPolicy, log)[0]?.candidate.id, "gb-two");
});

test("audio repair final-pass failures are unique per source and candidate", () => {
  const failure = {
    targetId: "lex:A1:i:gb",
    sourceClipSha256: "8".repeat(64),
    candidateId: "gb-one",
    candidateClipSha256: "9".repeat(64),
    at: "2026-10-07T00:02:00Z",
    blockers: ["vosk-lexical"],
  };
  assert.equal(
    audioRepairLog.safeParse({
      schemaVersion: 1,
      policyVersion: "test-policy",
      policySha256: "a".repeat(64),
      attempts: [],
      finalFailures: [failure, failure],
    }).success,
    false,
  );
});

test("audio repair planner never synthesises around source-identity failures", () => {
  const log = audioRepairLog.parse({ schemaVersion: 1, policyVersion: "test-policy", policySha256: null, attempts: [] });
  assert.deepEqual(
    planAudioRepairs(partialCertificate(["source-identity-mismatch"]), repairPolicy, log),
    [],
  );
});
