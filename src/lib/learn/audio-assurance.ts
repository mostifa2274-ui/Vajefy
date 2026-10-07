import { z } from "zod";

const text = z.string().trim().min(1);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);

export const audioAccent = z.enum(["gb", "us"]);
export type AudioAccent = z.infer<typeof audioAccent>;

export const audioCertificateStatus = z.enum(["CERTIFIED", "UNCERTAIN", "QUARANTINED"]);
export type AudioCertificateStatus = z.infer<typeof audioCertificateStatus>;

export const audioSystemDescriptor = z
  .object({
    engine: text,
    packageVersion: text,
    model: text,
    modelVersion: text,
    modelSha256: sha256.nullable().optional(),
  })
  .strict();

export const audioRecognitionClip = z
  .object({
    targetId: text,
    unitId: text,
    entryId: text,
    senseId: text,
    accent: audioAccent,
    clipFile: text,
    clipSha256: sha256,
    expectedText: text,
    pronunciation: text,
    signal: z
      .object({
        duration: z.number().positive(),
        peak: z.number().nonnegative(),
        rms: z.number().nonnegative(),
      })
      .strict(),
    whisper: z
      .object({
        transcript: z.string(),
        avgLogProb: z.number().finite().nullable(),
        noSpeechProb: z.number().min(0).max(1).nullable(),
      })
      .strict(),
    vosk: z
      .object({
        transcript: z.string(),
      })
      .strict(),
    alignment: z
      .object({
        status: z.enum(["ok", "unavailable"]),
        words: z.array(
          z
            .object({
              name: text,
              start: z.number().int().nonnegative(),
              duration: z.number().int().nonnegative(),
              phones: z.array(
                z
                  .object({
                    name: text,
                    start: z.number().int().nonnegative(),
                    duration: z.number().int().nonnegative(),
                  })
                  .strict(),
              ),
            })
            .strict(),
        ),
        coverage: z.number().min(0).max(1).nullable(),
        reason: z.string().nullable(),
      })
      .strict(),
  })
  .strict();

const sourceHashes = z
  .object({
    curriculumSha256: sha256,
    enhancedSha256: sha256,
    audioManifestSha256: sha256,
    audioReportSha256: sha256,
  })
  .strict();

export const audioRecognitionManifest = z
  .object({
    schemaVersion: z.literal(1),
    evidenceVersion: z.literal("vajefy-audio-v1"),
    generatedAt: text.nullable(),
    scope: z.object({ units: z.array(text).min(1) }).strict(),
    sourceHashes: sourceHashes.nullable(),
    systems: z
      .object({
        whisper: audioSystemDescriptor,
        vosk: audioSystemDescriptor,
        alignment: audioSystemDescriptor,
      })
      .strict(),
    clips: z.array(audioRecognitionClip),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    const ids = manifest.clips.map((clip) => clip.targetId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", path: ["clips"], message: "audio recognition target ids must be unique" });
    }
    if (manifest.generatedAt === null) {
      if (manifest.sourceHashes !== null || manifest.clips.length !== 0) {
        ctx.addIssue({
          code: "custom",
          message: "pending recognition must have null sourceHashes and no clip evidence",
        });
      }
    } else if (manifest.sourceHashes === null) {
      ctx.addIssue({ code: "custom", path: ["sourceHashes"], message: "generated recognition needs exact source hashes" });
    }
  });

export type AudioRecognitionManifest = z.infer<typeof audioRecognitionManifest>;
export type AudioRecognitionClip = z.infer<typeof audioRecognitionClip>;

export const audioCertificateRecord = z
  .object({
    targetId: text,
    unitId: text,
    entryId: text,
    senseId: text,
    accent: audioAccent,
    clipFile: text,
    clipSha256: sha256,
    expectedText: text,
    pronunciation: text,
    status: audioCertificateStatus,
    criteria: z
      .object({
        sourceIdentity: z.boolean(),
        signalIntegrity: z.boolean(),
        whisperLexical: z.boolean(),
        voskLexical: z.boolean(),
        forcedAlignment: z.boolean(),
        multiSystemAgreement: z.boolean(),
      })
      .strict(),
    legacyIssues: z.array(z.string()),
    blockers: z.array(text),
  })
  .strict();

export const audioCertificateManifest = z
  .object({
    schemaVersion: z.literal(1),
    evidenceVersion: z.literal("vajefy-audio-v1"),
    generatedAt: text.nullable(),
    status: z.enum(["PENDING_RECOGNITION", "PARTIAL", "CERTIFIED"]),
    scope: z.object({ units: z.array(text).min(1) }).strict(),
    sourceHashes: sourceHashes.nullable(),
    recognitionHash: sha256.nullable(),
    summary: z
      .object({
        targets: z.number().int().nonnegative(),
        certified: z.number().int().nonnegative(),
        uncertain: z.number().int().nonnegative(),
        quarantined: z.number().int().nonnegative(),
      })
      .strict(),
    records: z.array(audioCertificateRecord),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    const total = manifest.summary.certified + manifest.summary.uncertain + manifest.summary.quarantined;
    if (total !== manifest.summary.targets) {
      ctx.addIssue({ code: "custom", path: ["summary"], message: "audio certificate summary must add up to targets" });
    }
    const ids = manifest.records.map((record) => record.targetId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", path: ["records"], message: "audio certificate target ids must be unique" });
    }
    if (manifest.generatedAt === null) {
      if (
        manifest.status !== "PENDING_RECOGNITION" ||
        manifest.sourceHashes !== null ||
        manifest.recognitionHash !== null ||
        manifest.records.length !== 0
      ) {
        ctx.addIssue({ code: "custom", message: "pending certificates cannot claim source-bound recognition evidence" });
      }
    } else if (manifest.sourceHashes === null || manifest.recognitionHash === null) {
      ctx.addIssue({ code: "custom", message: "generated certificates need source and recognition hashes" });
    }
    if (manifest.status === "CERTIFIED" && manifest.summary.certified !== manifest.summary.targets) {
      ctx.addIssue({ code: "custom", message: "CERTIFIED requires every target to be certified" });
    }
  });

export type AudioCertificateManifest = z.infer<typeof audioCertificateManifest>;
export type AudioCertificateRecord = z.infer<typeof audioCertificateRecord>;

export const audioRepairCandidate = z
  .object({
    id: text,
    voice: text,
    lang: z.enum(["en-gb", "en-us"]),
    speed: z.number().positive().min(0.75).max(1.25),
  })
  .strict();

export const audioRepairPolicy = z
  .object({
    schemaVersion: z.literal(1),
    policyVersion: text,
    model: z
      .object({
        name: text,
        modelFile: text,
        modelSha256: sha256,
        voicesFile: text,
        voicesSha256: sha256,
        packageVersion: text,
        bitrate: text,
      })
      .strict(),
    candidates: z
      .object({
        gb: z.array(audioRepairCandidate).min(1).max(8),
        us: z.array(audioRepairCandidate).min(1).max(8),
      })
      .strict(),
  })
  .strict()
  .superRefine((policy, ctx) => {
    const ids = [...policy.candidates.gb, ...policy.candidates.us].map((candidate) => candidate.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", path: ["candidates"], message: "audio repair candidate ids must be globally unique" });
    }
    if (policy.candidates.gb.some((candidate) => candidate.lang !== "en-gb")) {
      ctx.addIssue({ code: "custom", path: ["candidates", "gb"], message: "GB repair candidates must use en-gb" });
    }
    if (policy.candidates.us.some((candidate) => candidate.lang !== "en-us")) {
      ctx.addIssue({ code: "custom", path: ["candidates", "us"], message: "US repair candidates must use en-us" });
    }
  });

export type AudioRepairPolicy = z.infer<typeof audioRepairPolicy>;
export type AudioRepairCandidate = z.infer<typeof audioRepairCandidate>;

export const audioRepairAttempt = z
  .object({
    targetId: text,
    sourceClipSha256: sha256,
    candidateId: text,
    candidateClipSha256: sha256,
    at: text,
    outcome: z.enum(["CERTIFIED", "QUARANTINED"]),
    blockers: z.array(text),
  })
  .strict();

export const audioRepairLog = z
  .object({
    schemaVersion: z.literal(1),
    policyVersion: text,
    attempts: z.array(audioRepairAttempt),
  })
  .strict()
  .superRefine((log, ctx) => {
    const keys = log.attempts.map(
      (attempt) => attempt.targetId + "|" + attempt.sourceClipSha256 + "|" + attempt.candidateId,
    );
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({ code: "custom", path: ["attempts"], message: "audio repair attempts must be unique per source/candidate" });
    }
  });

export type AudioRepairLog = z.infer<typeof audioRepairLog>;

export type AudioRepairPlanItem = {
  targetId: string;
  unitId: string;
  entryId: string;
  senseId: string;
  accent: AudioAccent;
  sourceClipFile: string;
  sourceClipSha256: string;
  expectedText: string;
  pronunciation: string;
  candidate: AudioRepairCandidate;
};

const REPAIRABLE_AUDIO_BLOCKERS = new Set([
  "signal-integrity",
  "whisper-lexical",
  "vosk-lexical",
  "forced-alignment",
  "multi-system-disagreement",
]);

/**
 * Select at most one deterministic next candidate for each quarantined target.
 * Missing/stale source evidence is never repaired by synthesising new audio:
 * that is an assurance-pipeline fault and must stay fail-closed.
 */
export function planAudioRepairs(
  certificates: AudioCertificateManifest,
  policy: AudioRepairPolicy,
  log: AudioRepairLog,
): AudioRepairPlanItem[] {
  if (certificates.status === "PENDING_RECOGNITION") return [];
  if (log.policyVersion !== policy.policyVersion) {
    throw new Error("audio repair log policy " + log.policyVersion + " does not match " + policy.policyVersion);
  }

  return certificates.records.flatMap((record) => {
    if (record.status !== "QUARANTINED") return [];
    if (!record.blockers.length || record.blockers.some((blocker) => !REPAIRABLE_AUDIO_BLOCKERS.has(blocker))) return [];

    const history = log.attempts.filter(
      (attempt) => attempt.targetId === record.targetId && attempt.sourceClipSha256 === record.clipSha256,
    );
    if (history.some((attempt) => attempt.outcome === "CERTIFIED")) return [];

    const candidate = policy.candidates[record.accent].find(
      (item) => !history.some((attempt) => attempt.candidateId === item.id),
    );
    if (!candidate) return [];

    return [
      {
        targetId: record.targetId,
        unitId: record.unitId,
        entryId: record.entryId,
        senseId: record.senseId,
        accent: record.accent,
        sourceClipFile: record.clipFile,
        sourceClipSha256: record.clipSha256,
        expectedText: record.expectedText,
        pronunciation: record.pronunciation,
        candidate,
      },
    ];
  });
}

const APOSTROPHE = /[\u2018\u2019\u02bc]/g;
const NON_WORD = /[^a-z0-9']+/g;

export function normalizeAudioTranscript(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(APOSTROPHE, "'")
    .replace(/\b(i'm)\b/g, "i am")
    .replace(/\b(you're)\b/g, "you are")
    .replace(/\b(he's)\b/g, "he is")
    .replace(/\b(she's)\b/g, "she is")
    .replace(/\b(it's)\b/g, "it is")
    .replace(/\b(we're)\b/g, "we are")
    .replace(/\b(they're)\b/g, "they are")
    .replace(/\b(can't)\b/g, "cannot")
    .replace(/\b(don't)\b/g, "do not")
    .replace(/\b(doesn't)\b/g, "does not")
    .replace(/\b(didn't)\b/g, "did not")
    .replace(/\b(won't)\b/g, "will not")
    .replace(NON_WORD, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function editDistance(a: string[], b: string[]): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const old = row[j]!;
      row[j] = Math.min(
        row[j]! + 1,
        row[j - 1]! + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = old;
    }
  }
  return row[b.length]!;
}

/**
 * A lexical match is intentionally strict. For a single word, exact
 * recognition is required. A multi-token form may differ by one token only
 * when it is at least four tokens long, which tolerates a harmless article or
 * contraction split without making short A1 words easy to falsely accept.
 */
export function audioLexicalMatch(expected: string, actual: string): boolean {
  const want = normalizeAudioTranscript(expected).split(" ").filter(Boolean);
  const got = normalizeAudioTranscript(actual).split(" ").filter(Boolean);
  if (!want.length || !got.length) return false;
  if (want.join(" ") === got.join(" ")) return true;

  // Multi-form headwords such as "a, an" are spoken as a sequence, so also
  // accept recognizers that preserve just one listed form.
  const listed = expected
    .split(",")
    .map((part) => normalizeAudioTranscript(part))
    .filter(Boolean);
  if (listed.length > 1 && listed.includes(got.join(" "))) return true;

  return want.length >= 4 && editDistance(want, got) <= 1;
}

const TECHNICAL_ISSUE = /^(too short|too long|clipping|too quiet or silent)$/;

export function deriveAudioCertificate(
  clip: AudioRecognitionClip | undefined,
  expected: {
    targetId: string;
    unitId: string;
    entryId: string;
    senseId: string;
    accent: AudioAccent;
    clipFile: string;
    clipSha256: string;
    expectedText: string;
    pronunciation: string;
    manifestSignal: { duration: number; peak: number; rms: number };
    legacyIssues: string[];
  },
): AudioCertificateRecord {
  const base = {
    targetId: expected.targetId,
    unitId: expected.unitId,
    entryId: expected.entryId,
    senseId: expected.senseId,
    accent: expected.accent,
    clipFile: expected.clipFile,
    clipSha256: expected.clipSha256,
    expectedText: expected.expectedText,
    pronunciation: expected.pronunciation,
    legacyIssues: expected.legacyIssues,
  };

  if (!clip) {
    return audioCertificateRecord.parse({
      ...base,
      status: "UNCERTAIN",
      criteria: {
        sourceIdentity: false,
        signalIntegrity: false,
        whisperLexical: false,
        voskLexical: false,
        forcedAlignment: false,
        multiSystemAgreement: false,
      },
      blockers: ["missing-independent-recognition"],
    });
  }

  const sourceIdentity =
    clip.targetId === expected.targetId &&
    clip.unitId === expected.unitId &&
    clip.entryId === expected.entryId &&
    clip.senseId === expected.senseId &&
    clip.accent === expected.accent &&
    clip.clipFile === expected.clipFile &&
    clip.clipSha256 === expected.clipSha256 &&
    normalizeAudioTranscript(clip.expectedText) === normalizeAudioTranscript(expected.expectedText) &&
    clip.pronunciation === expected.pronunciation;

  // The manifest statistics were measured from the normalized WAV before
  // MP3 encoding. Independent certification measures the shipped MP3 after
  // decoding, so duration must remain close while peak/RMS are judged from
  // the decoded evidence rather than required to be byte-identical to WAV stats.
  const sameSignal =
    Math.abs(clip.signal.duration - expected.manifestSignal.duration) <= 0.12;
  const technicalFault = expected.legacyIssues.some((issue) => TECHNICAL_ISSUE.test(issue));
  const signalIntegrity =
    sameSignal &&
    !technicalFault &&
    clip.signal.duration >= 0.25 &&
    clip.signal.duration <= 3.5 &&
    clip.signal.peak < 0.99 &&
    clip.signal.rms >= 0.01;

  const whisperLexical = audioLexicalMatch(expected.expectedText, clip.whisper.transcript);
  const voskLexical = audioLexicalMatch(expected.expectedText, clip.vosk.transcript);
  const expectedWords = normalizeAudioTranscript(expected.expectedText).split(" ").filter(Boolean);
  const alignedWords = clip.alignment.words.map((word) => normalizeAudioTranscript(word.name)).filter(Boolean);
  const forcedAlignment =
    clip.alignment.status === "ok" &&
    clip.alignment.coverage !== null &&
    clip.alignment.coverage >= 0.45 &&
    clip.alignment.coverage <= 1 &&
    alignedWords.length > 0 &&
    editDistance(expectedWords, alignedWords) === 0 &&
    clip.alignment.words.every(
      (word) => word.duration > 0 && word.phones.length > 0 && word.phones.every((phone) => phone.duration > 0),
    );

  const multiSystemAgreement =
    whisperLexical &&
    voskLexical &&
    forcedAlignment &&
    normalizeAudioTranscript(clip.whisper.transcript).length > 0 &&
    normalizeAudioTranscript(clip.vosk.transcript).length > 0;

  const blockers: string[] = [];
  if (!sourceIdentity) blockers.push("source-identity-mismatch");
  if (!signalIntegrity) blockers.push("signal-integrity");
  if (!whisperLexical) blockers.push("whisper-lexical");
  if (!voskLexical) blockers.push("vosk-lexical");
  if (!forcedAlignment) blockers.push("forced-alignment");
  if (!multiSystemAgreement) blockers.push("multi-system-disagreement");

  return audioCertificateRecord.parse({
    ...base,
    status: blockers.length ? "QUARANTINED" : "CERTIFIED",
    criteria: {
      sourceIdentity,
      signalIntegrity,
      whisperLexical,
      voskLexical,
      forcedAlignment,
      multiSystemAgreement,
    },
    blockers,
  });
}
