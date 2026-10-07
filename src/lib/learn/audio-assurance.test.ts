import assert from "node:assert/strict";
import test from "node:test";
import {
  audioCertificateManifest,
  audioLexicalMatch,
  audioRecognitionManifest,
  deriveAudioCertificate,
  normalizeAudioTranscript,
} from "./audio-assurance";

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
