import fs from "node:fs";
import path from "node:path";
import type { CheckItem, Pilot } from "../src/lib/learn/content.ts";

type SliceEntry = {
  id: string;
  objective: string;
  prerequisites: string[];
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
  };
};

const ROOT = process.cwd();
const SLICE_FILE = path.join(ROOT, "content", "calibration", "a1-20.json");
const COMPILED_FILE = path.join(ROOT, "content", "compiled", "enhanced.json");
const AUDIO_REPORT_FILE = path.join(ROOT, "content", "pilot", "audio-report.json");

function read<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function die(messages: string[]): never {
  console.error(`A1 calibration failed with ${messages.length} structural issue(s):\n- ${messages.join("\n- ")}`);
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
    out.push(`### ${entry.order}. ${entry.headword} — \`${entry.id}\``, "");
    for (const sense of entry.senses) {
      const teaching = sense.teachingChecks.map((item) => `${item.id} (${item.type})`).join(", ");
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
    "- Record approvals only through the documented human review workflow after the reviewer has actually completed the checks.",
    "",
  );
  return out.join("\n");
}

const slice = read<Slice>(SLICE_FILE);
const pilot = read<Pilot>(COMPILED_FILE);
const audioReport = fs.existsSync(AUDIO_REPORT_FILE) ? read<AudioReport>(AUDIO_REPORT_FILE) : {};
const flags = audioReport.flagged ?? [];
const structural: string[] = [];

const flat = slice.units.flatMap((unit) => unit.entries.map((entry) => ({ unit, entry })));
if (flat.length !== 20) structural.push(`expected exactly 20 calibration entries, found ${flat.length}`);

const ids = flat.map(({ entry }) => entry.id);
if (new Set(ids).size !== ids.length) structural.push("calibration entry ids must be unique");
if (new Set(slice.units.map((unit) => unit.id)).size !== slice.units.length) structural.push("calibration unit ids must be unique");

const byEntry = new Map(pilot.entries.map((entry) => [entry.id, entry]));
const position = new Map(ids.map((id, index) => [id, index]));
const unitPosition = new Map(slice.units.map((unit, index) => [unit.id, index]));

for (const { unit, entry } of flat) {
  const content = byEntry.get(entry.id);
  if (!entry.id.startsWith("lex:A1:")) structural.push(`${entry.id}: calibration slice must remain A1`);
  if (!content) structural.push(`${entry.id}: no enhanced content`);
  for (const prerequisite of entry.prerequisites) {
    const at = position.get(prerequisite);
    if (at === undefined) structural.push(`${entry.id}: prerequisite ${prerequisite} is outside the 20-entry slice`);
    else if (at >= (position.get(entry.id) ?? -1)) structural.push(`${entry.id}: prerequisite ${prerequisite} must be introduced earlier`);
  }
  for (const recycled of unit.recycles) {
    const at = position.get(recycled);
    if (at === undefined) structural.push(`${unit.id}: recycled entry ${recycled} is outside the slice`);
    const introUnit = slice.units.find((candidate) => candidate.entries.some((item) => item.id === recycled));
    if (introUnit && (unitPosition.get(introUnit.id) ?? 0) >= (unitPosition.get(unit.id) ?? 0)) {
      structural.push(`${unit.id}: ${recycled} must be introduced in an earlier unit before recycling`);
    }
  }
  for (const sense of content?.senses ?? []) {
    if (sense.check.length < 2) structural.push(`${sense.id}: needs at least one teaching check plus one held-out assessment`);
    const heldOut = sense.check.at(-1);
    if (!heldOut) structural.push(`${sense.id}: missing held-out assessment`);
  }
}

if (structural.length) die(structural);

const entries: EntryRow[] = flat.map(({ unit, entry: selected }, index) => {
  const content = byEntry.get(selected.id)!;
  const laterUnits = slice.units
    .filter((candidate) => (unitPosition.get(candidate.id) ?? 0) > (unitPosition.get(unit.id) ?? 0) && candidate.recycles.includes(selected.id))
    .map((candidate) => candidate.id);

  const senses: SenseRow[] = content.senses.map((sense) => {
    const heldOut = sense.check.at(-1)!;
    const teachingChecks = sense.check.slice(0, -1).map((item) => ({ id: item.id, type: item.type }));
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
        contrasts: pilot.contrasts.filter((item) => item.entries.includes(sense.id)).map((item) => item.id),
        scenes: pilot.scenes.filter((item) => item.targets.includes(sense.id)).map((item) => item.id),
      },
    };
  });

  const gaps: string[] = [];
  if (!content.review) gaps.push("no current human review record");
  else {
    if (content.review.bilingual !== "approved") gaps.push(`bilingual review: ${content.review.bilingual}`);
    if (content.review.pronunciation !== "approved") gaps.push(`pronunciation review: ${content.review.pronunciation}`);
  }
  if (senses.some((sense) => !sense.audio.gb.complete || !sense.audio.us.complete)) gaps.push("audio incomplete");
  const flagged = senses.reduce((sum, sense) => sum + sense.flags.length, 0);
  if (flagged) gaps.push(`${flagged} flagged audio clip${flagged === 1 ? "" : "s"}`);
  if (senses.some((sense) => !sense.recycling.laterUnits.length && !sense.recycling.contrasts.length && !sense.recycling.scenes.length)) {
    gaps.push("one or more senses need later recycling");
  }

  return {
    order: index + 1,
    id: content.id,
    headword: content.headword,
    objective: selected.objective,
    prerequisites: selected.prerequisites,
    unit: { id: unit.id, title: unit.title, goal: unit.goal, patterns: unit.patterns },
    version: content.version,
    released: content.released,
    review: {
      bilingual: reviewStatus(content.review?.bilingual),
      pronunciation: reviewStatus(content.review?.pronunciation),
      ...(content.review?.reviewer ? { reviewer: content.review.reviewer } : {}),
      ...(content.review?.date ? { date: content.review.date } : {}),
    },
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
    bilingualApproved: entries.filter((entry) => entry.review.bilingual === "approved").length,
    pronunciationApproved: entries.filter((entry) => entry.review.pronunciation === "approved").length,
    fullyReviewed: entries.filter((entry) => entry.review.bilingual === "approved" && entry.review.pronunciation === "approved").length,
    completeAudioSenses: allSenses.filter((sense) => sense.audio.gb.complete && sense.audio.us.complete).length,
    flaggedClips: allSenses.reduce((sum, sense) => sum + sense.flags.length, 0),
    structuralGaps: structural.length,
    editorialGaps: entries.reduce((sum, entry) => sum + entry.gaps.length, 0),
  },
};

if (process.argv.includes("--check")) {
  console.log(
    `A1 calibration OK: ${packet.summary.entries} entries, ${packet.summary.senses} senses; ${packet.summary.editorialGaps} editorial/coverage gap(s) reported for human review.`,
  );
} else if (process.argv.includes("--json")) {
  console.log(JSON.stringify(packet, null, 2));
} else {
  console.log(markdown(packet));
}
