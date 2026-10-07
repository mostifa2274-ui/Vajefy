import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  audioCertificateManifest,
  audioRecognitionManifest,
  deriveAudioCertificate,
  type AudioAccent,
  type AudioCertificateManifest,
  type AudioRecognitionManifest,
} from "../src/lib/learn/audio-assurance";

const ROOT = process.cwd();
const AUDIO = path.join(ROOT, "content", "assurance", "audio");
const FILES = {
  curriculum: path.join(ROOT, "content", "curriculum", "A1.json"),
  enhanced: path.join(ROOT, "content", "compiled", "enhanced.json"),
  manifest: path.join(ROOT, "content", "pilot", "audio-manifest.json"),
  report: path.join(ROOT, "content", "pilot", "audio-report.json"),
  recognition: path.join(AUDIO, "recognition.json"),
  certificates: path.join(AUDIO, "certificates.json"),
};

const SCOPE_UNITS = ["01-introductions", "02-family-home", "03-daily-routine"] as const;

const EXPECTED_SYSTEMS = {
  whisper: {
    engine: "faster-whisper",
    packageVersion: "1.2.1",
    model: "Systran/faster-whisper-tiny.en",
    modelVersion: "0d3d19a32d3338f10357c0889762bd8d64bbdeba",
  },
  vosk: {
    engine: "vosk",
    packageVersion: "0.3.45",
    model: "vosk-model-small-en-us-0.15",
    modelVersion: "0.15",
  },
  alignment: {
    engine: "pocketsphinx",
    packageVersion: "5.1.1",
    model: "bundled-en-us",
    modelVersion: "pocketsphinx-5.1.1",
  },
} as const;

type Curriculum = {
  units: { id: string; entries: { id: string }[] }[];
};

type Enhanced = {
  entries: {
    id: string;
    version: string;
    headword: string;
    senses: {
      id: string;
      pronunciation: { gb: string; us: string };
    }[];
  }[];
};

type AudioManifest = {
  clips: Record<string, { duration: number; peak: number; rms: number; bytes: number; text: string; accent: AudioAccent }>;
  senses: Record<
    string,
    Record<AudioAccent, { word: { text: string; file: string }; examples: { text: string; file: string }[] }>
  >;
};

type AudioReport = {
  flagged: { sense: string; accent: AudioAccent; kind: string; text: string; file: string; issues: string[] }[];
};

function read<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function sha256File(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function systemsMatch(recognition: AudioRecognitionManifest): boolean {
  for (const key of ["whisper", "vosk", "alignment"] as const) {
    const actual = recognition.systems[key];
    const expected = EXPECTED_SYSTEMS[key];
    for (const field of ["engine", "packageVersion", "model", "modelVersion"] as const) {
      if (actual[field] !== expected[field]) return false;
    }
  }
  return true;
}

function sourceHashes() {
  return {
    curriculumSha256: sha256File(FILES.curriculum),
    enhancedSha256: sha256File(FILES.enhanced),
    audioManifestSha256: sha256File(FILES.manifest),
    audioReportSha256: sha256File(FILES.report),
  };
}

function buildTargets() {
  const curriculum = read<Curriculum>(FILES.curriculum);
  const enhanced = read<Enhanced>(FILES.enhanced);
  const manifest = read<AudioManifest>(FILES.manifest);
  const report = read<AudioReport>(FILES.report);

  const units = new Map(curriculum.units.map((unit) => [unit.id, unit]));
  const entries = new Map(enhanced.entries.map((entry) => [entry.id, entry]));
  const issues = new Map<string, string[]>();
  for (const flag of report.flagged ?? []) {
    if (flag.kind !== "word") continue;
    issues.set(\`\${flag.sense}|\${flag.accent}\`, [...flag.issues]);
  }

  const targets = [];
  for (const unitId of SCOPE_UNITS) {
    const unit = units.get(unitId);
    if (!unit) fail(\`Missing required audio-certification unit \${unitId}.\`);
    for (const item of unit.entries) {
      const entry = entries.get(item.id);
      if (!entry) fail(\`\${unitId}: missing enhanced entry \${item.id}.\`);
      for (const sense of entry.senses) {
        const audio = manifest.senses[sense.id];
        if (!audio) fail(\`\${sense.id}: missing audio manifest record.\`);
        for (const accent of ["gb", "us"] as const) {
          const word = audio[accent]?.word;
          if (!word) fail(\`\${sense.id}:\${accent}: missing word clip.\`);
          const clipName = path.basename(word.file);
          const metadata = manifest.clips[clipName];
          if (!metadata) fail(\`\${sense.id}:\${accent}: manifest clip \${clipName} is missing.\`);
          if (metadata.text !== word.text || metadata.accent !== accent) {
            fail(\`\${sense.id}:\${accent}: clip metadata does not match its sense record.\`);
          }
          const disk = path.join(ROOT, "public", "audio", word.file);
          if (!fs.existsSync(disk)) fail(\`\${sense.id}:\${accent}: audio file \${word.file} is missing.\`);
          if (fs.statSync(disk).size !== metadata.bytes) {
            fail(\`\${sense.id}:\${accent}: audio byte count differs from audio-manifest.json.\`);
          }
          targets.push({
            targetId: \`\${sense.id}:\${accent}\`,
            unitId,
            entryId: entry.id,
            senseId: sense.id,
            accent,
            clipFile: word.file,
            clipSha256: sha256File(disk),
            expectedText: word.text,
            pronunciation: sense.pronunciation[accent],
            manifestSignal: {
              duration: metadata.duration,
              peak: metadata.peak,
              rms: metadata.rms,
            },
            legacyIssues: issues.get(\`\${sense.id}|\${accent}\`) ?? [],
          });
        }
      }
    }
  }

  const ids = targets.map((target) => target.targetId);
  if (new Set(ids).size !== ids.length) fail("Audio certification targets are not unique.");
  return targets;
}

function expectedCertificates(recognition: AudioRecognitionManifest): AudioCertificateManifest {
  const targets = buildTargets();

  if (recognition.generatedAt === null) {
    return audioCertificateManifest.parse({
      schemaVersion: 1,
      evidenceVersion: "vajefy-audio-v1",
      generatedAt: null,
      status: "PENDING_RECOGNITION",
      scope: { units: [...SCOPE_UNITS] },
      sourceHashes: null,
      recognitionHash: null,
      summary: {
        targets: targets.length,
        certified: 0,
        uncertain: targets.length,
        quarantined: 0,
      },
      records: [],
    });
  }

  const currentSources = sourceHashes();
  if (!same(recognition.sourceHashes, currentSources)) {
    fail("Audio recognition evidence is stale: source hashes do not match current curriculum/content/audio inputs.");
  }

  const byTarget = new Map(recognition.clips.map((clip) => [clip.targetId, clip]));
  if (byTarget.size !== targets.length) {
    fail(\`Audio recognition evidence must cover exactly \${targets.length} targets; found \${byTarget.size}.\`);
  }
  const unknown = recognition.clips.filter((clip) => !targets.some((target) => target.targetId === clip.targetId));
  if (unknown.length) fail(\`Audio recognition evidence contains unknown target \${unknown[0]!.targetId}.\`);

  const records = targets.map((target) => deriveAudioCertificate(byTarget.get(target.targetId), target));
  const certified = records.filter((record) => record.status === "CERTIFIED").length;
  const uncertain = records.filter((record) => record.status === "UNCERTAIN").length;
  const quarantined = records.filter((record) => record.status === "QUARANTINED").length;
  const status = certified === records.length ? "CERTIFIED" : "PARTIAL";

  return audioCertificateManifest.parse({
    schemaVersion: 1,
    evidenceVersion: "vajefy-audio-v1",
    generatedAt: recognition.generatedAt,
    status,
    scope: { units: [...SCOPE_UNITS] },
    sourceHashes: currentSources,
    recognitionHash: sha256File(FILES.recognition),
    summary: { targets: records.length, certified, uncertain, quarantined },
    records,
  });
}

if (!fs.existsSync(FILES.recognition)) fail("Missing content/assurance/audio/recognition.json.");
if (!fs.existsSync(FILES.certificates)) fail("Missing content/assurance/audio/certificates.json.");

const recognitionResult = audioRecognitionManifest.safeParse(read<unknown>(FILES.recognition));
if (!recognitionResult.success) {
  fail(
    \`recognition.json is invalid:\\n\${recognitionResult.error.issues
      .map((issue) => \`- \${issue.path.join(".")}: \${issue.message}\`)
      .join("\\n")}\`,
  );
}
const recognition = recognitionResult.data;
if (!same(recognition.scope.units, [...SCOPE_UNITS])) fail("Audio recognition scope must be exactly Units 1-3.");
if (!systemsMatch(recognition)) fail("Audio recognition systems drifted from the frozen foundation versions.");
if (recognition.generatedAt !== null && !recognition.systems.vosk.modelSha256) {
  fail("Generated recognition evidence must record the exact Vosk model archive SHA-256.");
}

const expected = expectedCertificates(recognition);
const write = process.argv.includes("--write");
if (write) {
  fs.mkdirSync(AUDIO, { recursive: true });
  fs.writeFileSync(FILES.certificates, \`\${JSON.stringify(expected, null, 2)}\\n\`);
  console.log(
    \`Audio certificates written: \${expected.summary.certified}/\${expected.summary.targets} certified, \` +
      \`\${expected.summary.uncertain} uncertain, \${expected.summary.quarantined} quarantined.\`,
  );
} else {
  const actualResult = audioCertificateManifest.safeParse(read<unknown>(FILES.certificates));
  if (!actualResult.success) {
    fail(
      \`certificates.json is invalid:\\n\${actualResult.error.issues
        .map((issue) => \`- \${issue.path.join(".")}: \${issue.message}\`)
        .join("\\n")}\`,
    );
  }
  if (!same(actualResult.data, expected)) {
    fail("Audio certificates are stale. Run npm run assurance:audio -- --write and commit the result.");
  }
  console.log(
    \`Audio certification evidence: \${expected.status} (\${expected.summary.certified}/\${expected.summary.targets} certified; \` +
      \`\${expected.summary.uncertain} uncertain; \${expected.summary.quarantined} quarantined).\`,
  );
}

if (process.argv.includes("--require-certified") && expected.status !== "CERTIFIED") {
  fail(
    \`Audio certification gate is not satisfied: \${expected.summary.certified}/\${expected.summary.targets} targets are certified.\`,
  );
}
