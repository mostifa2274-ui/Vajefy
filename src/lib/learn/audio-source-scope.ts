export const AUDIO_CERTIFICATION_UNITS = [
  "01-introductions",
  "02-family-home",
  "03-daily-routine",
] as const;

type Curriculum = {
  units: { id: string; entries: { id: string }[] }[];
};

type Enhanced = {
  entries: {
    id: string;
    headword: string;
    senses: {
      id: string;
      pronunciation: { gb: string; us: string };
    }[];
  }[];
};

type AudioManifest = {
  clips: Record<
    string,
    {
      duration: number;
      peak: number;
      rms: number;
      bytes: number;
      text: string;
      accent: "gb" | "us";
    }
  >;
  senses: Record<
    string,
    Record<"gb" | "us", { word: { text: string; file: string } }>
  >;
};

type AudioReport = {
  flagged: {
    sense: string;
    accent: "gb" | "us";
    kind: string;
    text: string;
    file: string;
    issues: string[];
  }[];
};

function basename(file: string): string {
  return file.split(/[\\/]/).at(-1) ?? file;
}

/**
 * Canonical projection of exactly the repository inputs consumed by Unit 1-3
 * word/accent certification. Out-of-scope A1 edits must not invalidate this
 * evidence; any input that can change a scoped target must.
 */
export function audioSourceScopeProjection(
  curriculum: Curriculum,
  enhanced: Enhanced,
  manifest: AudioManifest,
  report: AudioReport,
  scopeUnits: readonly string[] = AUDIO_CERTIFICATION_UNITS,
) {
  const units = new Map(curriculum.units.map((unit) => [unit.id, unit]));
  const entries = new Map(enhanced.entries.map((entry) => [entry.id, entry]));

  const curriculumProjection = scopeUnits.map((unitId) => {
    const unit = units.get(unitId);
    if (!unit) throw new Error("missing audio-certification unit " + unitId);
    return {
      id: unit.id,
      entries: unit.entries.map((entry) => entry.id),
    };
  });
  const entryIds = curriculumProjection.flatMap((unit) => unit.entries);

  const enhancedProjection = entryIds.map((entryId) => {
    const entry = entries.get(entryId);
    if (!entry) throw new Error("missing scoped enhanced entry " + entryId);
    return {
      id: entry.id,
      headword: entry.headword,
      senses: entry.senses.map((sense) => ({
        id: sense.id,
        pronunciation: {
          gb: sense.pronunciation.gb,
          us: sense.pronunciation.us,
        },
      })),
    };
  });
  const senseIds = new Set(
    enhancedProjection.flatMap((entry) => entry.senses.map((sense) => sense.id)),
  );

  const audioProjection = enhancedProjection.flatMap((entry) =>
    entry.senses.map((sense) => {
      const audio = manifest.senses[sense.id];
      if (!audio) throw new Error("missing scoped audio manifest record " + sense.id);
      const accents = (["gb", "us"] as const).map((accent) => {
        const word = audio[accent]?.word;
        if (!word) throw new Error(sense.id + ":" + accent + ": missing scoped word clip");
        const clip = manifest.clips[basename(word.file)];
        if (!clip) throw new Error(sense.id + ":" + accent + ": missing scoped clip metadata");
        return {
          accent,
          word: {
            text: word.text,
            file: word.file,
          },
          clip: {
            duration: clip.duration,
            peak: clip.peak,
            rms: clip.rms,
            bytes: clip.bytes,
            text: clip.text,
            accent: clip.accent,
          },
        };
      });
      return { senseId: sense.id, accents };
    }),
  );

  const flagged = (report.flagged ?? [])
    .filter((flag) => flag.kind === "word" && senseIds.has(flag.sense))
    .map((flag) => ({
      sense: flag.sense,
      accent: flag.accent,
      kind: flag.kind,
      text: flag.text,
      file: flag.file,
      issues: [...flag.issues],
    }))
    .sort(
      (left, right) =>
        left.sense.localeCompare(right.sense) ||
        left.accent.localeCompare(right.accent) ||
        left.file.localeCompare(right.file) ||
        left.text.localeCompare(right.text),
    );

  return {
    curriculum: { units: curriculumProjection },
    enhanced: { entries: enhancedProjection },
    audioManifest: { senses: audioProjection },
    audioReport: { flagged },
  };
}
