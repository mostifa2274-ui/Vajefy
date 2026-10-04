import fs from "node:fs";
import path from "node:path";
import type { CheckItem, Pilot } from "../src/lib/learn/content.ts";

type LanguageException = {
  token: string;
  reason: string;
};

type SliceEntry = {
  id: string;
  objective: string;
  /**
   * A deliberately allowed learner-language dependency that cannot yet be
   * removed. The token and rationale stay reviewer-visible; this is never an
   * automatic approval.
   */
  languageExceptions?: LanguageException[];
};

type SliceUnit = {
  id: string;
  title: string;
  goal: string;
  patterns: string[];
  recycles: string[];
  entries: SliceEntry[];
};

type Slice = {
  version: number;
  title: string;
  description: string;
  units: SliceUnit[];
};

type CurriculumEntry = {
  id: string;
  prerequisites: string[];
};

type Curriculum = {
  level: string;
  units: { id: string; entries: CurriculumEntry[] }[];
  calibrationSlice: { unit: string; entries: string[] };
};

type AudioFlag = {
  sense: string;
  accent: "gb" | "us";
  kind: string;
  text: string;
  file: string;
  issues: string[];
};

type AudioReport = { model?: string; flagged?: AudioFlag[] };

type AccentCoverage = {
  word: boolean;
  examples: number;
  totalExamples: number;
  complete: boolean;
};

type SenseRow = {
  id: string;
  pos: string;
  gloss: string;
  teachingChecks: { id: string; type: CheckItem["type"] }[];
  assessment: { id: string; type: CheckItem["type"] };
  audio: { gb: AccentCoverage; us: AccentCoverage };
  flags: AudioFlag[];
  recycling: { laterUnits: string[]; contrasts: string[]; scenes: string[] };
};

type LanguageDependencyStatus =
  | "future"
  | "outside-slice"
  | "external"
  | "proper-name-candidate"
  | "exception";

type LanguageDependency = {
  token: string;
  status: LanguageDependencyStatus;
  entryId?: string;
  reason?: string;
  sources: string[];
};

type LanguageAudit = {
  dependencies: LanguageDependency[];
  unresolved: number;
  taskUnresolved: number;
  documentedExceptions: number;
  staleExceptions: string[];
};

type EntryRow = {
  order: number;
  id: string;
  headword: string;
  objective: string;
  prerequisites: string[];
  unit: { id: string; title: string; goal: string; patterns: string[] };
  version: string;
  released: boolean;
  review: {
    bilingual: string;
    pronunciation: string;
    reviewer?: string;
    date?: string;
  };
  language: LanguageAudit;
  senses: SenseRow[];
  gaps: string[];
};

type Packet = {
  title: string;
  contentVersion: string;
  entries: EntryRow[];
  summary: {
    entries: number;
    senses: number;
    released: number;
    bilingualApproved: number;
    pronunciationApproved: number;
    fullyReviewed: number;
    completeAudioSenses: number;
    flaggedClips: number;
    structuralGaps: number;
    editorialGaps: number;
    languageUnresolved: number;
    taskLanguageUnresolved: number;
    languageExceptions: number;
  };
};

const ROOT = process.cwd();
const SLICE_FILE = path.join(ROOT, "content", "calibration", "a1-20.json");
const CURRICULUM_FILE = path.join(ROOT, "content", "curriculum", "A1.json");
const COMPILED_FILE = path.join(ROOT, "content", "compiled", "enhanced.json");
const AUDIO_REPORT_FILE = path.join(
  ROOT,
  "content",
  "pilot",
  "audio-report.json",
);

function read<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function die(messages: string[]): never {
  console.error(
    `A1 calibration failed with ${messages.length} structural issue(s):\n- ${messages.join("\n- ")}`,
  );
  process.exit(1);
}

function accentCoverage(
  pilot: Pilot,
  senseId: string,
  accent: "gb" | "us",
  totalExamples: number,
): AccentCoverage {
  const audio = pilot.audio[senseId]?.[accent];
  const examples = (audio?.examples ?? []).filter(Boolean).length;
  const word = Boolean(audio?.word);
  return {
    word,
    examples,
    totalExamples,
    complete: word && examples === totalExamples,
  };
}

function q(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function reviewStatus(value: string | undefined): string {
  return value ?? "pending";
}

const CONTRACTIONS: Record<string, string[]> = {
  "i'm": ["i", "be"],
  "you're": ["you", "be"],
  "he's": ["he", "be"],
  "she's": ["she", "be"],
  "it's": ["it", "be"],
  "we're": ["we", "be"],
  "they're": ["they", "be"],
  "that's": ["that", "be"],
  "what's": ["what", "be"],
  "who's": ["who", "be"],
  "where's": ["where", "be"],
  "how's": ["how", "be"],
  "isn't": ["be", "not"],
  "aren't": ["be", "not"],
  "wasn't": ["be", "not"],
  "weren't": ["be", "not"],
  "don't": ["do", "not"],
  "doesn't": ["do", "not"],
  "didn't": ["do", "not"],
  "can't": ["can", "not"],
  "couldn't": ["could", "not"],
  "won't": ["will", "not"],
  "wouldn't": ["would", "not"],
  "haven't": ["have", "not"],
  "hasn't": ["have", "not"],
  "hadn't": ["have", "not"],
  "i've": ["i", "have"],
  "you've": ["you", "have"],
  "we've": ["we", "have"],
  "they've": ["they", "have"],
  "i'll": ["i", "will"],
  "you'll": ["you", "will"],
  "he'll": ["he", "will"],
  "she'll": ["she", "will"],
  "we'll": ["we", "will"],
  "they'll": ["they", "will"],
};

const IRREGULAR: Record<string, string> = {
  am: "be",
  is: "be",
  are: "be",
  was: "be",
  were: "be",
  been: "be",
  being: "be",
  has: "have",
  had: "have",
  having: "have",
  does: "do",
  did: "do",
  done: "do",
  doing: "do",
  goes: "go",
  went: "go",
  gone: "go",
  going: "go",
  people: "person",
  children: "child",
  men: "man",
  women: "woman",
  feet: "foot",
  teeth: "tooth",
  mice: "mouse",
};

type EnglishSource = { source: string; text: string };

function englishSources(entry: Pilot["entries"][number]): EnglishSource[] {
  const sources: EnglishSource[] = [];
  for (const sense of entry.senses) {
    for (const [index, item] of (sense.grammar ?? []).entries()) {
      sources.push({ source: `${sense.id}/grammar-${index + 1}`, text: item.pattern });
    }
    for (const [index, item] of (sense.examples ?? []).entries()) {
      sources.push({ source: `${sense.id}/example-${index + 1}`, text: item.en });
    }
    for (const [index, item] of (sense.collocations ?? []).entries()) {
      sources.push({ source: `${sense.id}/collocation-${index + 1}`, text: item });
    }
    if (sense.mistake?.wrong) {
      sources.push({ source: `${sense.id}/mistake-wrong`, text: sense.mistake.wrong });
    }
    if (sense.mistake?.right) {
      sources.push({ source: `${sense.id}/mistake-right`, text: sense.mistake.right });
    }
    for (const item of sense.check ?? []) {
      if (item.type === "cloze") {
        sources.push({ source: `${sense.id}/check-${item.id}`, text: item.text });
      } else if (item.type === "choice") {
        sources.push({ source: `${sense.id}/check-${item.id}/prompt`, text: item.prompt });
        item.options.forEach((option, index) =>
          sources.push({
            source: `${sense.id}/check-${item.id}/option-${index + 1}`,
            text: option.text,
          }),
        );
      } else {
        sources.push({ source: `${sense.id}/check-${item.id}/frame`, text: item.frame });
      }
    }
  }
  return sources;
}

function headwordAliases(headword: string): string[] {
  const normalized = headword.toLowerCase().replaceAll("’", "'").trim();
  // Some catalogue headwords carry sense labels, e.g.
  // "like (find sb/sth pleasant)". Slash characters inside those labels are
  // not lexical variants and must not make us discard the actual headword.
  const withoutSenseLabel = normalized.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return withoutSenseLabel
    .split(/\s*[,/;]\s*/)
    .map((part) => part.trim())
    .filter((part) => /^[a-z]+(?:[-'][a-z]+)*$/.test(part));
}

function buildHeadwordIndex(
  entries: Pilot["entries"],
): Map<string, string> {
  const index = new Map<string, string>();
  for (const entry of entries) {
    for (const alias of headwordAliases(entry.headword)) {
      if (!index.has(alias)) index.set(alias, entry.id);
    }
  }
  return index;
}

function lexicalForms(raw: string): string[] {
  const token = raw.toLowerCase().replaceAll("’", "'");
  const contraction = CONTRACTIONS[token];
  if (contraction) return contraction;
  if (token.endsWith("'s") && token.length > 2) return [token.slice(0, -2)];
  if (token.endsWith("'re") && token.length > 3)
    return [token.slice(0, -3), "be"];
  if (token.endsWith("'ve") && token.length > 3)
    return [token.slice(0, -3), "have"];
  if (token.endsWith("'ll") && token.length > 3)
    return [token.slice(0, -3), "will"];
  return [token];
}

function morphologyCandidates(form: string): string[] {
  const candidates = [form];
  const irregular = IRREGULAR[form];
  if (irregular) candidates.push(irregular);
  if (form.endsWith("ies") && form.length > 3)
    candidates.push(`${form.slice(0, -3)}y`);
  if (form.endsWith("es") && form.length > 2)
    candidates.push(form.slice(0, -2));
  if (form.endsWith("s") && form.length > 1)
    candidates.push(form.slice(0, -1));
  if (form.endsWith("ied") && form.length > 3)
    candidates.push(`${form.slice(0, -3)}y`);
  if (form.endsWith("ed") && form.length > 2) {
    const stem = form.slice(0, -2);
    candidates.push(stem, `${stem}e`);
    if (
      stem.length > 2 &&
      stem.at(-1) === stem.at(-2)
    )
      candidates.push(stem.slice(0, -1));
  }
  if (form.endsWith("ing") && form.length > 3) {
    const stem = form.slice(0, -3);
    candidates.push(stem, `${stem}e`);
    if (
      stem.length > 2 &&
      stem.at(-1) === stem.at(-2)
    )
      candidates.push(stem.slice(0, -1));
  }
  return [...new Set(candidates)];
}

function resolveA1Entry(
  form: string,
  headwordIndex: Map<string, string>,
): string | undefined {
  for (const candidate of morphologyCandidates(form)) {
    const id = headwordIndex.get(candidate);
    if (id) return id;
  }
  return undefined;
}

function auditLanguage(
  entry: Pilot["entries"][number],
  currentIndex: number,
  position: Map<string, number>,
  headwordIndex: Map<string, string>,
  exceptions: LanguageException[],
): LanguageAudit {
  const exceptionByToken = new Map<string, LanguageException>();
  for (const exception of exceptions) {
    const token = exception.token.toLowerCase().replaceAll("’", "'").trim();
    if (token) exceptionByToken.set(token, exception);
  }

  const rows = new Map<string, LanguageDependency>();
  const usedExceptions = new Set<string>();

  for (const { source, text } of englishSources(entry)) {
    const rawTokens = text.match(/[A-Za-z]+(?:[-'’][A-Za-z]+)*/g) ?? [];
    for (const raw of rawTokens) {
      for (const form of lexicalForms(raw)) {
        const exactException = exceptionByToken.get(form);
        const resolvedId = resolveA1Entry(form, headwordIndex);
        const resolvedPosition = resolvedId ? position.get(resolvedId) : undefined;

        let status: LanguageDependencyStatus | "available";
        if (exactException) {
          status = "exception";
          usedExceptions.add(form);
        } else if (resolvedId && resolvedPosition !== undefined && resolvedPosition <= currentIndex) {
          status = "available";
        } else if (resolvedId && resolvedPosition !== undefined) {
          status = "future";
        } else if (resolvedId) {
          status = "outside-slice";
        } else if (/^[A-Z]/.test(raw)) {
          status = "proper-name-candidate";
        } else {
          status = "external";
        }

        if (status === "available") continue;
        const key = `${status}:${form}:${resolvedId ?? ""}`;
        const existing = rows.get(key);
        if (existing) {
          if (!existing.sources.includes(source)) existing.sources.push(source);
          continue;
        }
        rows.set(key, {
          token: form,
          status,
          ...(resolvedId ? { entryId: resolvedId } : {}),
          ...(exactException ? { reason: exactException.reason } : {}),
          sources: [source],
        });
      }
    }
  }

  const dependencies = [...rows.values()].sort((a, b) =>
    `${a.status}:${a.token}`.localeCompare(`${b.status}:${b.token}`),
  );
  const unresolvedDependencies = dependencies.filter(
    (item) => item.status !== "exception",
  );
  return {
    dependencies,
    unresolved: unresolvedDependencies.length,
    taskUnresolved: unresolvedDependencies.filter((item) =>
      item.sources.some((source) => source.includes("/check-")),
    ).length,
    documentedExceptions: dependencies.filter(
      (item) => item.status === "exception",
    ).length,
    staleExceptions: [...exceptionByToken.keys()].filter(
      (token) => !usedExceptions.has(token),
    ),
  };
}

function dependencySummary(audit: LanguageAudit): string {
  if (!audit.dependencies.length) return "all learner-facing English resolves to introduced A1 targets";
  return audit.dependencies
    .map((item) => {
      const mapped = item.entryId ? ` → ${item.entryId}` : "";
      const reason = item.reason ? ` — ${item.reason}` : "";
      return `${item.token} [${item.status}${mapped}]${reason}`;
    })
    .join("; ");
}

function markdown(packet: Packet): string {
  const out: string[] = [];
  out.push(
    `# ${packet.title}`,
    "",
    `Generated from enhanced content version \`${packet.contentVersion}\`.`,
    "",
    "This is a calibration/review packet. It reports repository evidence only. It does **not** create bilingual or pronunciation approvals, invent reviewer identities, or turn automated checks into human sign-off.",
    "",
    "## Snapshot",
    "",
    "| Measure | Current |",
    "|---|---:|",
    `| Entries | ${packet.summary.entries} |`,
    `| Senses | ${packet.summary.senses} |`,
    `| Released entries | ${packet.summary.released} |`,
    `| Bilingual approvals current | ${packet.summary.bilingualApproved} |`,
    `| Pronunciation approvals current | ${packet.summary.pronunciationApproved} |`,
    `| Entries fully reviewed | ${packet.summary.fullyReviewed} |`,
    `| Senses with complete GB+US word/example audio | ${packet.summary.completeAudioSenses} |`,
    `| Flagged clips in this slice | ${packet.summary.flaggedClips} |`,
    `| Unresolved learner-language dependencies | ${packet.summary.languageUnresolved} |`,
    `| Unresolved authored-task dependencies | ${packet.summary.taskLanguageUnresolved} |`,
    `| Documented language exceptions | ${packet.summary.languageExceptions} |`,
    `| Editorial/coverage gaps to inspect | ${packet.summary.editorialGaps} |`,
    "",
  );

  let currentUnit = "";
  for (const entry of packet.entries) {
    if (entry.unit.id !== currentUnit) {
      currentUnit = entry.unit.id;
      out.push(
        `## ${entry.unit.title}`,
        "",
        entry.unit.goal,
        "",
        `Patterns: ${entry.unit.patterns.map((item) => `\`${q(item)}\``).join(", ")}`,
        "",
        "| # | Entry | Objective | Prerequisites | Review | Gaps |",
        "|---:|---|---|---|---|---|",
      );
    }
    const review = `BI: ${entry.review.bilingual}; PR: ${entry.review.pronunciation}`;
    out.push(
      `| ${entry.order} | \`${entry.id}\` — **${q(entry.headword)}** | ${q(entry.objective)} | ${entry.prerequisites.length ? entry.prerequisites.map((id) => `\`${id}\``).join("<br>") : "—"} | ${review} | ${entry.gaps.length ? q(entry.gaps.join("; ")) : "—"} |`,
    );
  }

  out.push("", "## Sense-level review matrix", "");
  for (const entry of packet.entries) {
    out.push(
      `### ${entry.order}. ${entry.headword} — \`${entry.id}\``,
      "",
      `- Learner-language dependency audit: ${dependencySummary(entry.language)}`,
      "",
    );
    for (const sense of entry.senses) {
      const teaching = sense.teachingChecks
        .map((item) => `${item.id} (${item.type})`)
        .join(", ");
      const recycling = [
        ...sense.recycling.laterUnits.map((id) => `unit:${id}`),
        ...sense.recycling.contrasts.map((id) => `contrast:${id}`),
        ...sense.recycling.scenes.map((id) => `scene:${id}`),
      ];
      out.push(
        `- **${sense.gloss}** (\`${sense.id}\`, ${sense.pos})`,
        `  - Teaching/practice checks: ${teaching || "none"}`,
        `  - Held-out delayed assessment: ${sense.assessment.id} (${sense.assessment.type})`,
        `  - Audio: GB ${sense.audio.gb.complete ? "complete" : `${sense.audio.gb.word ? "word ✓" : "word ✗"}, examples ${sense.audio.gb.examples}/${sense.audio.gb.totalExamples}`}; US ${sense.audio.us.complete ? "complete" : `${sense.audio.us.word ? "word ✓" : "word ✗"}, examples ${sense.audio.us.examples}/${sense.audio.us.totalExamples}`}`,
        `  - Recycling: ${recycling.length ? recycling.join(", ") : "none yet in this calibration slice/content"}`,
        `  - Audio flags: ${sense.flags.length ? sense.flags.flatMap((flag) => flag.issues.map((issue) => `${flag.accent}/${flag.kind}: ${issue}`)).join("; ") : "none recorded"}`,
      );
    }
    out.push("");
  }

  out.push(
    "## Human review checklist",
    "",
    "- Verify each Persian gloss and precise meaning against the exact A1 sense.",
    "- Verify English examples are natural at A1 and Persian translations preserve the same meaning.",
    "- Verify grammar patterns, collocations, usage notes, and common-mistake guidance are accurate for Persian speakers.",
    "- Verify the held-out item is independent of teaching examples and has one defensible answer.",
    "- Listen to the current GB and US clips; resolve every flagged clip rather than accepting it automatically.",
    "- Check prerequisites and recycling in the actual learner sequence; add curriculum recycling when the packet reports none.",
    "- Resolve every learner-language dependency marked future, outside-slice, external, or proper-name-candidate. Rewrite the teaching text when possible; if an exception is genuinely unavoidable, document its exact token and rationale in the calibration overlay.",
    "- Record approvals only through the documented human review workflow after the reviewer has actually completed the checks.",
    "",
  );
  return out.join("\n");
}

const slice = read<Slice>(SLICE_FILE);
const curriculum = read<Curriculum>(CURRICULUM_FILE);
const pilot = read<Pilot>(COMPILED_FILE);
const audioReport = fs.existsSync(AUDIO_REPORT_FILE)
  ? read<AudioReport>(AUDIO_REPORT_FILE)
  : {};
const flags = audioReport.flagged ?? [];
const structural: string[] = [];

const flat = slice.units.flatMap((unit) =>
  unit.entries.map((entry) => ({ unit, entry })),
);
if (flat.length !== 20)
  structural.push(
    `expected exactly 20 calibration entries, found ${flat.length}`,
  );

const ids = flat.map(({ entry }) => entry.id);
const canonicalIds = curriculum.calibrationSlice.entries;
const canonicalUnit = curriculum.units.find(
  (unit) => unit.id === curriculum.calibrationSlice.unit,
);
if (curriculum.level !== "A1")
  structural.push("content/curriculum/A1.json must describe A1");
if (canonicalIds.length !== 20)
  structural.push(
    `curriculum calibration slice must contain exactly 20 entries, found ${canonicalIds.length}`,
  );
if (new Set(canonicalIds).size !== canonicalIds.length)
  structural.push("curriculum calibration slice contains duplicate entries");
if (!canonicalUnit)
  structural.push(
    `curriculum calibration unit ${curriculum.calibrationSlice.unit} does not exist`,
  );
else if (
  JSON.stringify(canonicalUnit.entries.map((entry) => entry.id)) !==
  JSON.stringify(canonicalIds)
) {
  structural.push(
    "curriculum calibration slice order must exactly match its unit entries",
  );
}
if (JSON.stringify(ids) !== JSON.stringify(canonicalIds)) {
  structural.push(
    "calibration packet entries must exactly match the curriculum calibration slice",
  );
}
if (new Set(ids).size !== ids.length)
  structural.push("calibration entry ids must be unique");
if (new Set(slice.units.map((unit) => unit.id)).size !== slice.units.length)
  structural.push("calibration unit ids must be unique");

const byEntry = new Map(pilot.entries.map((entry) => [entry.id, entry]));
const curriculumByEntry = new Map(
  (canonicalUnit?.entries ?? []).map((entry) => [entry.id, entry]),
);
const position = new Map(ids.map((id, index) => [id, index]));
const unitPosition = new Map(
  slice.units.map((unit, index) => [unit.id, index]),
);
const headwordIndex = buildHeadwordIndex(pilot.entries);
const languageByEntry = new Map<string, LanguageAudit>();

for (const { unit, entry } of flat) {
  const content = byEntry.get(entry.id);
  const curriculumEntry = curriculumByEntry.get(entry.id);
  if (!entry.id.startsWith("lex:A1:"))
    structural.push(`${entry.id}: calibration slice must remain A1`);
  if (!content) structural.push(`${entry.id}: no enhanced content`);
  if (!curriculumEntry)
    structural.push(
      `${entry.id}: missing from the curriculum calibration unit`,
    );

  const exceptionTokens = new Set<string>();
  for (const exception of entry.languageExceptions ?? []) {
    const token = exception.token.toLowerCase().replaceAll("’", "'").trim();
    if (!token) structural.push(`${entry.id}: language exception token is required`);
    if (!exception.reason.trim())
      structural.push(`${entry.id}: language exception ${exception.token} needs a rationale`);
    if (exceptionTokens.has(token))
      structural.push(`${entry.id}: duplicate language exception ${exception.token}`);
    exceptionTokens.add(token);
  }

  if (content) {
    const language = auditLanguage(
      content,
      position.get(entry.id) ?? -1,
      position,
      headwordIndex,
      entry.languageExceptions ?? [],
    );
    languageByEntry.set(entry.id, language);
    for (const token of language.staleExceptions) {
      structural.push(
        `${entry.id}: language exception ${token} is stale because the token is not present in learner-facing English`,
      );
    }
  }

  for (const prerequisite of curriculumEntry?.prerequisites ?? []) {
    const at = position.get(prerequisite);
    if (at === undefined)
      structural.push(
        `${entry.id}: prerequisite ${prerequisite} is outside the 20-entry slice`,
      );
    else if (at >= (position.get(entry.id) ?? -1))
      structural.push(
        `${entry.id}: prerequisite ${prerequisite} must be introduced earlier`,
      );
  }
  for (const recycled of unit.recycles) {
    const at = position.get(recycled);
    if (at === undefined)
      structural.push(
        `${unit.id}: recycled entry ${recycled} is outside the slice`,
      );
    const introUnit = slice.units.find((candidate) =>
      candidate.entries.some((item) => item.id === recycled),
    );
    if (
      introUnit &&
      (unitPosition.get(introUnit.id) ?? 0) >= (unitPosition.get(unit.id) ?? 0)
    ) {
      structural.push(
        `${unit.id}: ${recycled} must be introduced in an earlier unit before recycling`,
      );
    }
  }
  for (const sense of content?.senses ?? []) {
    if (sense.check.length < 3) {
      structural.push(
        `${sense.id}: needs at least 3 checks (two lesson opportunities plus one held-out assessment)`,
      );
    }
    const heldOut = sense.check.at(-1);
    if (!heldOut) structural.push(`${sense.id}: missing held-out assessment`);
  }
}

if (structural.length) die(structural);

const entries: EntryRow[] = flat.map(({ unit, entry: selected }, index) => {
  const content = byEntry.get(selected.id)!;
  const curriculumEntry = curriculumByEntry.get(selected.id)!;
  const laterUnits = slice.units
    .filter(
      (candidate) =>
        (unitPosition.get(candidate.id) ?? 0) >
          (unitPosition.get(unit.id) ?? 0) &&
        candidate.recycles.includes(selected.id),
    )
    .map((candidate) => candidate.id);

  const senses: SenseRow[] = content.senses.map((sense) => {
    const heldOut = sense.check.at(-1)!;
    const teachingChecks = sense.check
      .slice(0, -1)
      .map((item) => ({ id: item.id, type: item.type }));
    return {
      id: sense.id,
      pos: sense.pos,
      gloss: sense.gloss,
      teachingChecks,
      assessment: { id: heldOut.id, type: heldOut.type },
      audio: {
        gb: accentCoverage(pilot, sense.id, "gb", sense.examples.length),
        us: accentCoverage(pilot, sense.id, "us", sense.examples.length),
      },
      flags: flags.filter((flag) => flag.sense === sense.id),
      recycling: {
        laterUnits,
        contrasts: pilot.contrasts
          .filter((item) => item.entries.includes(sense.id))
          .map((item) => item.id),
        scenes: pilot.scenes
          .filter((item) => item.targets.includes(sense.id))
          .map((item) => item.id),
      },
    };
  });

  const language = languageByEntry.get(selected.id) ?? {
    dependencies: [],
    unresolved: 0,
    taskUnresolved: 0,
    documentedExceptions: 0,
    staleExceptions: [],
  };

  const gaps: string[] = [];
  if (!content.review) gaps.push("no current human review record");
  else {
    if (content.review.bilingual !== "approved")
      gaps.push(`bilingual review: ${content.review.bilingual}`);
    if (content.review.pronunciation !== "approved")
      gaps.push(`pronunciation review: ${content.review.pronunciation}`);
  }
  if (
    senses.some((sense) => !sense.audio.gb.complete || !sense.audio.us.complete)
  )
    gaps.push("audio incomplete");
  const flagged = senses.reduce((sum, sense) => sum + sense.flags.length, 0);
  if (flagged)
    gaps.push(`${flagged} flagged audio clip${flagged === 1 ? "" : "s"}`);
  if (
    senses.some(
      (sense) =>
        !sense.recycling.laterUnits.length &&
        !sense.recycling.contrasts.length &&
        !sense.recycling.scenes.length,
    )
  ) {
    gaps.push("one or more senses need later recycling");
  }
  if (language.unresolved) {
    gaps.push(
      `${language.unresolved} unresolved learner-language dependenc${language.unresolved === 1 ? "y" : "ies"}`,
    );
  }

  return {
    order: index + 1,
    id: content.id,
    headword: content.headword,
    objective: selected.objective,
    prerequisites: curriculumEntry.prerequisites,
    unit: {
      id: unit.id,
      title: unit.title,
      goal: unit.goal,
      patterns: unit.patterns,
    },
    version: content.version,
    released: content.released,
    review: {
      bilingual: reviewStatus(content.review?.bilingual),
      pronunciation: reviewStatus(content.review?.pronunciation),
      ...(content.review?.reviewer
        ? { reviewer: content.review.reviewer }
        : {}),
      ...(content.review?.date ? { date: content.review.date } : {}),
    },
    language,
    senses,
    gaps,
  };
});

const allSenses = entries.flatMap((entry) => entry.senses);
const packet: Packet = {
  title: slice.title,
  contentVersion: pilot.version,
  entries,
  summary: {
    entries: entries.length,
    senses: allSenses.length,
    released: entries.filter((entry) => entry.released).length,
    bilingualApproved: entries.filter(
      (entry) => entry.review.bilingual === "approved",
    ).length,
    pronunciationApproved: entries.filter(
      (entry) => entry.review.pronunciation === "approved",
    ).length,
    fullyReviewed: entries.filter(
      (entry) =>
        entry.review.bilingual === "approved" &&
        entry.review.pronunciation === "approved",
    ).length,
    completeAudioSenses: allSenses.filter(
      (sense) => sense.audio.gb.complete && sense.audio.us.complete,
    ).length,
    flaggedClips: allSenses.reduce((sum, sense) => sum + sense.flags.length, 0),
    structuralGaps: structural.length,
    editorialGaps: entries.reduce((sum, entry) => sum + entry.gaps.length, 0),
    languageUnresolved: entries.reduce(
      (sum, entry) => sum + entry.language.unresolved,
      0,
    ),
    taskLanguageUnresolved: entries.reduce(
      (sum, entry) => sum + entry.language.taskUnresolved,
      0,
    ),
    languageExceptions: entries.reduce(
      (sum, entry) => sum + entry.language.documentedExceptions,
      0,
    ),
  },
};

if (
  process.argv.includes("--strict-language") &&
  packet.summary.languageUnresolved > 0
) {
  console.error(
    `A1 calibration language gate failed: ${packet.summary.languageUnresolved} unresolved learner-language dependenc${packet.summary.languageUnresolved === 1 ? "y" : "ies"}. Use --json or the review packet to inspect them; rewrite the text or document a justified exception.`,
  );
  process.exit(1);
}

if (
  process.argv.includes("--strict-tasks") &&
  packet.summary.taskLanguageUnresolved > 0
) {
  console.error(
    `A1 calibration task-language gate failed: ${packet.summary.taskLanguageUnresolved} unresolved authored-task dependenc${packet.summary.taskLanguageUnresolved === 1 ? "y" : "ies"}. Rewrite the authored checks or document only genuinely unavoidable support language.`,
  );
  process.exit(1);
}

if (process.argv.includes("--check")) {
  console.log(
    `A1 calibration OK: ${packet.summary.entries} entries, ${packet.summary.senses} senses; ${packet.summary.languageUnresolved} unresolved learner-language dependencies (${packet.summary.taskLanguageUnresolved} in authored tasks) and ${packet.summary.editorialGaps} editorial/coverage gap(s) reported for human review.`,
  );
} else if (process.argv.includes("--json")) {
  console.log(JSON.stringify(packet, null, 2));
} else {
  console.log(markdown(packet));
}
