import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { CheckItem, Entry, Scene, Sense } from "../src/lib/learn/content";
import {
  authoredTaskText,
  buildHeadwordIndex,
  englishTokens,
  lexicalForms,
  resolveA1Entry,
} from "../src/lib/learn/learner-language";

type Finding = {
  code: string;
  where: string;
  message: string;
};

type Report = {
  entries: number;
  senses: number;
  findings: number;
  byCode: Record<string, number>;
  details: Finding[];
};

const ROOT = process.cwd();
const ENTRY_DIR = path.join(ROOT, "content", "pilot", "entries");
const PERSIAN = /[\u0600-\u06FF]/u;
const USAGE_REQUIRED = new Set([
  "preposition",
  "conjunction",
  "pronoun",
  "determiner",
  "article",
  "modal",
  "particle",
]);

const findings: Finding[] = [];

function add(code: string, where: string, message: string) {
  findings.push({ code, where, message });
}

function normalized(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u200c\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value: string): string {
  return normalized(value).toLowerCase();
}

function needsPersian(value: string | undefined, where: string, code: string) {
  if (!value || !PERSIAN.test(value)) {
    add(code, where, "learner-facing Persian field contains no Persian-script text");
  }
}

/** A lone surrogate, U+FFFD, or a control character other than a newline. */
function malformed(value: string): boolean {
  for (const char of value) {
    // Iterating by code point pairs valid surrogates, so any left are lone.
    const code = char.codePointAt(0) ?? 0;
    if (
      (code >= 0xd800 && code <= 0xdfff) ||
      code === 0xfffd ||
      (code < 0x20 && code !== 0x0a) ||
      (code >= 0x7f && code <= 0x9f)
    ) {
      return true;
    }
  }
  return false;
}
// Explicit embeddings, overrides and isolates. Direction belongs to the
// interface (dir and bdi), not to stored text.
const BIDI_CONTROL = /[\u202A-\u202E\u2066-\u2069]/u;

function strings(value: unknown, where: string, out: [string, string][]) {
  if (typeof value === "string") out.push([where, value]);
  else if (Array.isArray(value)) {
    value.forEach((item, index) => strings(item, `${where}[${index}]`, out));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      strings(item, `${where}.${key}`, out);
    }
  }
  return out;
}

function checkText(sense: Sense) {
  for (const [where, value] of strings(sense, sense.id, [])) {
    if (malformed(value)) {
      add("MALFORMED_UNICODE", where, "contains a lone surrogate, U+FFFD or a control character");
    }
    if (BIDI_CONTROL.test(value)) {
      add("BIDI_CONTROL", where, "contains an explicit bidirectional embedding, override or isolate");
    }
    if (value.normalize("NFC") !== value) {
      add("UNICODE_NOT_NFC", where, "is not in Unicode normalization form C");
    }
  }
}

/** English learner-facing text: the target-language side of every pair. */
function englishFields(sense: Sense): [string, string][] {
  const base = sense.id;
  const fields: [string, string][] = [
    [`${base}.mistake.wrong`, sense.mistake.wrong],
    [`${base}.mistake.right`, sense.mistake.right],
  ];
  sense.examples.forEach((example, index) =>
    fields.push([`${base}.examples[${index}].en`, example.en]),
  );
  (sense.collocations ?? []).forEach((collocation, index) =>
    fields.push([`${base}.collocations[${index}]`, collocation]),
  );
  sense.grammar.forEach((grammar, index) =>
    fields.push([`${base}.grammar[${index}].pattern`, grammar.pattern]),
  );
  sense.check.forEach((item, index) => {
    const where = `${base}.check[${index}]`;
    if (item.type === "cloze") {
      fields.push([`${where}.text`, item.text], [`${where}.answer`, item.answer]);
      (item.accept ?? []).forEach((form, at) => fields.push([`${where}.accept[${at}]`, form]));
    } else if (item.type === "produce") {
      fields.push([`${where}.frame`, item.frame], [`${where}.answer`, item.answer]);
      (item.accept ?? []).forEach((form, at) => fields.push([`${where}.accept[${at}]`, form]));
    }
  });
  return fields;
}

function checkSense(sense: Sense) {
  const base = sense.id;

  checkText(sense);
  for (const [where, value] of englishFields(sense)) {
    if (value && PERSIAN.test(value)) {
      add("PERSIAN_IN_ENGLISH", where, "English field contains Persian-script text; move it to its Persian field");
    }
  }

  needsPersian(sense.gloss, `${base}.gloss`, "PERSIAN_GLOSS");
  needsPersian(sense.meaning, `${base}.meaning`, "PERSIAN_MEANING");

  for (const [index, grammar] of sense.grammar.entries()) {
    needsPersian(
      grammar.note,
      `${base}.grammar[${index}].note`,
      "PERSIAN_GRAMMAR_NOTE",
    );
  }

  if (sense.examples.length < 3) {
    add(
      "EXAMPLE_COUNT",
      `${base}.examples`,
      `needs at least 3 pedagogically distinct examples; found ${sense.examples.length}`,
    );
  }

  const seenEnglish = new Set<string>();
  const seenPersian = new Set<string>();
  for (const [index, example] of sense.examples.entries()) {
    needsPersian(
      example.fa,
      `${base}.examples[${index}].fa`,
      "PERSIAN_EXAMPLE",
    );
    const en = normalize(example.en);
    const fa = normalize(example.fa);
    if (seenEnglish.has(en)) {
      add(
        "DUPLICATE_EXAMPLE_EN",
        `${base}.examples[${index}]`,
        "duplicate English example",
      );
    }
    if (seenPersian.has(fa)) {
      add(
        "DUPLICATE_EXAMPLE_FA",
        `${base}.examples[${index}]`,
        "duplicate Persian example translation",
      );
    }
    seenEnglish.add(en);
    seenPersian.add(fa);
  }

  if (USAGE_REQUIRED.has(sense.pos) && !sense.usage) {
    add(
      "USAGE_REQUIRED",
      `${base}.usage`,
      `usage guidance required for ${sense.pos}`,
    );
  }
  if (sense.usage) {
    needsPersian(sense.usage, `${base}.usage`, "PERSIAN_USAGE");
  }

  if (!sense.mistake.wrongFa) {
    add(
      "MISTAKE_WRONG_FA_MISSING",
      `${base}.mistake.wrongFa`,
      "incorrect example needs its own Persian translation",
    );
  } else {
    needsPersian(
      sense.mistake.wrongFa,
      `${base}.mistake.wrongFa`,
      "PERSIAN_MISTAKE_WRONG",
    );
  }

  if (!sense.mistake.rightFa) {
    add(
      "MISTAKE_RIGHT_FA_MISSING",
      `${base}.mistake.rightFa`,
      "corrected example needs its own Persian translation",
    );
  } else {
    needsPersian(
      sense.mistake.rightFa,
      `${base}.mistake.rightFa`,
      "PERSIAN_MISTAKE_RIGHT",
    );
  }

  if (
    sense.mistake.wrongFa &&
    sense.mistake.rightFa &&
    normalize(sense.mistake.wrongFa) === normalize(sense.mistake.rightFa)
  ) {
    add(
      "MISTAKE_FA_IDENTICAL",
      `${base}.mistake`,
      "wrong and corrected Persian translations are identical",
    );
  }

  // Case can be the pedagogical distinction (for example "i" versus "I").
  if (normalized(sense.mistake.wrong) === normalized(sense.mistake.right)) {
    add(
      "MISTAKE_EN_IDENTICAL",
      `${base}.mistake`,
      "wrong and corrected English sentences are identical",
    );
  }

  needsPersian(sense.mistake.why, `${base}.mistake.why`, "PERSIAN_MISTAKE_WHY");

  for (const [index, item] of sense.check.entries()) {
    const where = `${base}.check[${index}]`;
    if (item.type === "choice") {
      for (const [optionIndex, option] of item.options.entries()) {
        needsPersian(
          option.why,
          `${where}.options[${optionIndex}].why`,
          "PERSIAN_CHECK_FEEDBACK",
        );
      }
    } else if (item.type === "cloze") {
      needsPersian(item.fa, `${where}.fa`, "PERSIAN_CHECK_FA");
      needsPersian(item.why, `${where}.why`, "PERSIAN_CHECK_FEEDBACK");
    } else {
      needsPersian(item.prompt, `${where}.prompt`, "PERSIAN_CHECK_PROMPT");
      needsPersian(item.why, `${where}.why`, "PERSIAN_CHECK_FEEDBACK");
    }
  }
}

function option(flag: string): string | undefined {
  const at = process.argv.indexOf(flag);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

const requestedUnit = option("--unit");
const curriculumFile = path.join(ROOT, "content", "curriculum", "A1.json");
const curriculum = fs.existsSync(curriculumFile)
  ? (JSON.parse(fs.readFileSync(curriculumFile, "utf8")) as {
      units: { id: string; entries: { id: string }[] }[];
    })
  : { units: [] };
let selectedIds: Set<string> | null = null;
if (requestedUnit) {
  const unit = curriculum.units.find((candidate) => candidate.id === requestedUnit);
  if (!unit) {
    console.error(`Unknown A1 unit: ${requestedUnit}`);
    process.exit(1);
  }
  selectedIds = new Set(unit.entries.map((item) => item.id));
}

const files = fs
  .readdirSync(ENTRY_DIR)
  .filter((name) => name.endsWith(".json"))
  .sort();

const allA1: Entry[] = [];
for (const file of files) {
  const rows = JSON.parse(
    fs.readFileSync(path.join(ENTRY_DIR, file), "utf8"),
  ) as Entry[];
  allA1.push(...rows.filter((entry) => entry.id.startsWith("lex:A1:")));
}
const entries = allA1.filter((entry) => !selectedIds || selectedIds.has(entry.id));

// Curriculum frontier (plan §7 C3). An entry's first sense is taught at its
// place in the curriculum; further senses come one unit later, so by then
// the whole of the entry's own unit is known.
const position = new Map<string, number>();
const unitEnd = new Map<string, number>();
for (const unit of curriculum.units) {
  for (const item of unit.entries) position.set(item.id, position.size);
  for (const item of unit.entries) unitEnd.set(item.id, position.size - 1);
}

/** Irregular past forms from the A1 irregular-verb collection (went -> go). */
const irregularForms = new Map<string, string>();
const irregularFile = path.join(ROOT, "public", "data", "irregular.json");
if (fs.existsSync(irregularFile)) {
  for (const row of JSON.parse(fs.readFileSync(irregularFile, "utf8")) as {
    base: string;
    past: string;
    pp: string;
  }[]) {
    for (const form of `${row.past}/${row.pp}`.toLowerCase().split("/")) {
      if (form.trim()) irregularForms.set(form.trim(), row.base.toLowerCase());
    }
  }
}

// Forms the shared morphology does not cover.
for (const [form, base] of Object.entries({ these: "this", those: "that" })) {
  irregularForms.set(form, base);
}

/** Plain ASCII letters, so "café" is read as "cafe", not "caf". */
function unaccented(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

const headwordIndex = buildHeadwordIndex(
  allA1.map((entry) => ({ id: entry.id, headword: unaccented(entry.headword) })),
);

/** The forms a token stands for, adding "'d" contractions (I'd -> I would). */
function forms(raw: string): string[] {
  const token = raw.toLowerCase().replaceAll("’", "'");
  if (token.endsWith("'d") && token.length > 2) return [token.slice(0, -2), "would"];
  return lexicalForms(raw);
}

/** Resolves a form to an A1 entry, including comparatives and superlatives. */
function resolveForm(form: string): string | undefined {
  const direct = resolveA1Entry(form, headwordIndex, irregularForms);
  if (direct) return direct;
  for (const suffix of ["est", "er"]) {
    if (!form.endsWith(suffix) || form.length <= suffix.length + 2) continue;
    const stem = form.slice(0, -suffix.length);
    const candidates = [stem, `${stem}e`];
    if (stem.at(-1) === stem.at(-2)) candidates.push(stem.slice(0, -1));
    if (stem.endsWith("i")) candidates.push(`${stem.slice(0, -1)}y`);
    for (const candidate of candidates) {
      const id = headwordIndex.get(candidate);
      if (id) return id;
    }
  }
  return undefined;
}

/** Documented learner-language exceptions from the calibration slice. */
const exceptionsByEntry = new Map<string, Set<string>>();
const calibrationFile = path.join(ROOT, "content", "calibration", "a1-20.json");
if (fs.existsSync(calibrationFile)) {
  const slice = JSON.parse(fs.readFileSync(calibrationFile, "utf8")) as {
    units: { entries: { id: string; languageExceptions?: { token: string }[] }[] }[];
  };
  for (const item of slice.units.flatMap((unit) => unit.entries)) {
    exceptionsByEntry.set(
      item.id,
      new Set(
        (item.languageExceptions ?? []).map((exception) =>
          exception.token.toLowerCase().replaceAll("’", "'").trim(),
        ),
      ),
    );
  }
}

/**
 * Reports words in tasks that the learner has not met by `frontier` (a
 * curriculum position), unless the task glosses them in its support.
 */
function checkTasks(
  code: string,
  where: string,
  items: readonly CheckItem[],
  frontier: number,
  exceptions: ReadonlySet<string> = new Set(),
) {
  for (const [index, item] of items.entries()) {
    const glossed = new Set<string>();
    for (const support of item.support ?? []) {
      for (const raw of englishTokens(unaccented(support.en))) {
        for (const form of forms(raw)) glossed.add(form);
      }
    }
    const reported = new Set<string>();
    // A wrong option may be a deliberately malformed form ("fastly"); only
    // real later vocabulary in it is a dependency.
    const distractors =
      item.type === "choice"
        ? new Set(
            item.options
              .filter((option) => !option.ok)
              .flatMap((option) => englishTokens(unaccented(option.text)))
              .flatMap(forms),
          )
        : new Set<string>();
    // Dialogue speaker labels ("A: ... B: ...") are not vocabulary.
    const text = unaccented(authoredTaskText(item)).replace(
      /(^|[\s"“'‘])[A-Z]:/g,
      "$1",
    );
    for (const raw of englishTokens(text)) {
      // A hyphenated word nobody lists whole ("twenty-five") is its parts.
      const whole = forms(raw);
      const split = whole.flatMap((form) =>
        form.includes("-") && !resolveForm(form) ? form.split("-") : [form],
      );
      for (const form of split) {
        // Single letters name letters ("the letter B"); "a" and "I" resolve.
        if (form.length === 1) continue;
        if (reported.has(form) || glossed.has(form) || exceptions.has(form)) continue;
        const id = resolveForm(form);
        if (!id && distractors.has(form)) continue;
        const at = id === undefined ? undefined : position.get(id);
        if (at !== undefined && at <= frontier) continue;
        reported.add(form);
        add(
          code,
          `${where}.check[${index}]`,
          id
            ? `"${form}" is taught later (${id}); gloss it in support or reword`
            : `"${form}" is not an A1 word; gloss it in support or reword`,
        );
      }
    }
  }
}

/** Where a sense is taught: its entry's place, or its unit's end for a further sense. */
function senseFrontier(senseId: string): number | undefined {
  const [entryId, label] = senseId.split("#");
  const entry = allA1.find((candidate) => candidate.id === entryId);
  const first = !label || entry?.senses[0]?.id === senseId;
  return first ? position.get(entryId) : unitEnd.get(entryId);
}

let senses = 0;
for (const entry of entries) {
  for (const [index, sense] of entry.senses.entries()) {
    senses += 1;
    checkSense(sense);
    const frontier =
      index === 0 ? position.get(entry.id) : unitEnd.get(entry.id);
    if (frontier !== undefined) {
      checkTasks(
        "FRONTIER_TASK_VOCABULARY",
        sense.id,
        sense.check,
        frontier,
        exceptionsByEntry.get(entry.id),
      );
    }
  }
}

// A scene comes after all its targets, so its tasks may use anything taught
// up to the latest of them. Its lines carry Persian translations.
const scenesFile = path.join(ROOT, "content", "pilot", "scenes.json");
let scenes = 0;
if (fs.existsSync(scenesFile)) {
  for (const scene of JSON.parse(fs.readFileSync(scenesFile, "utf8")) as Scene[]) {
    const reach = scene.targets.map(senseFrontier);
    if (reach.some((at) => at === undefined)) continue;
    const frontier = Math.max(...(reach as number[]));
    const lastTarget = scene.targets[reach.indexOf(frontier)].split("#")[0];
    if (selectedIds && !selectedIds.has(lastTarget)) continue;
    scenes += 1;
    // Speaker names are declared named entities, so the scene's tasks may use them.
    const speakers = new Set(
      scene.lines
        .flatMap((line) => englishTokens(unaccented(line.speaker ?? "")))
        .flatMap(forms),
    );
    checkTasks("FRONTIER_SCENE_VOCABULARY", scene.id, scene.check, frontier, speakers);
  }
}

const byCode: Record<string, number> = {};
for (const finding of findings) {
  byCode[finding.code] = (byCode[finding.code] ?? 0) + 1;
}

const report: Report = {
  entries: entries.length,
  senses,
  findings: findings.length,
  byCode: Object.fromEntries(
    Object.entries(byCode).sort(([a], [b]) => a.localeCompare(b)),
  ),
  details: findings,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `A1 deterministic assurance${requestedUnit ? ` [${requestedUnit}]` : ""}: ${report.entries} entries, ${report.senses} senses, ${scenes} scene(s), ${report.findings} finding(s).`,
  );
  for (const [code, count] of Object.entries(report.byCode)) {
    console.log(`! ${code}: ${count}`);
  }
  if (process.argv.includes("--all")) {
    for (const finding of report.details) {
      console.log(`- ${finding.code} ${finding.where}: ${finding.message}`);
    }
  } else if (report.findings) {
    console.log("Use --all for every finding or --json for a machine-readable report.");
  }
}

type Baseline = {
  schemaVersion: 1;
  recordedAgainst: string;
  evidence: string;
  maximumByCode: Record<string, number>;
};

const updating = process.argv.includes("--update-baseline");
if (process.argv.includes("--ratchet") || updating) {
  if (requestedUnit) {
    console.error("--ratchet compares the full A1 corpus and cannot be combined with --unit.");
    process.exit(1);
  }
  const baselineFile = path.join(
    ROOT,
    "content",
    "assurance",
    "deterministic-baseline.json",
  );
  const baseline = JSON.parse(fs.readFileSync(baselineFile, "utf8")) as Baseline;
  if (
    baseline.schemaVersion !== 1 ||
    !baseline.recordedAgainst ||
    !baseline.evidence ||
    !baseline.maximumByCode ||
    Object.values(baseline.maximumByCode).some(
      (value) => !Number.isInteger(value) || value < 0,
    )
  ) {
    console.error("Deterministic assurance baseline is invalid.");
    process.exit(1);
  }

  // Every reported code is bounded. A code missing from the baseline has a
  // maximum of zero, so a new defect class fails instead of going unnoticed.
  const codes = [
    ...new Set([
      ...Object.keys(baseline.maximumByCode),
      ...Object.keys(report.byCode),
    ]),
  ].sort((a, b) => a.localeCompare(b));
  const regressions = codes.flatMap((code) => {
    const current = report.byCode[code] ?? 0;
    const maximum = baseline.maximumByCode[code] ?? 0;
    return current > maximum ? [{ code, current, maximum }] : [];
  });
  const fixes = codes.flatMap((code) => {
    const current = report.byCode[code] ?? 0;
    const maximum = baseline.maximumByCode[code] ?? 0;
    return current < maximum ? [{ code, current, maximum }] : [];
  });

  if (regressions.length) {
    console.error(
      `Deterministic assurance regressed against ${baseline.recordedAgainst}:`,
    );
    for (const regression of regressions) {
      console.error(
        `- ${regression.code}: ${regression.current} > ${regression.maximum}`,
      );
    }
    if (updating) console.error("The baseline only shrinks; fix the content instead.");
    process.exit(1);
  }

  if (updating) {
    if (fixes.length) {
      const head = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
        cwd: ROOT,
        encoding: "utf8",
      });
      const next: Baseline = {
        ...baseline,
        recordedAgainst:
          head.status === 0 ? head.stdout.trim() : baseline.recordedAgainst,
        maximumByCode: Object.fromEntries(
          codes.map((code) => [code, report.byCode[code] ?? 0]),
        ),
      };
      fs.writeFileSync(baselineFile, `${JSON.stringify(next, null, 2)}\n`);
    }
    console.log(
      fixes.length
        ? `Deterministic assurance baseline lowered: ${fixes.map((fix) => `${fix.code} ${fix.maximum} -> ${fix.current}`).join(", ")}.`
        : "Deterministic assurance baseline already matches the content.",
    );
  } else if (fixes.length) {
    // Fixed defects must be recorded, or the old maximum would hide a later
    // regression up to that count.
    console.error(
      `Deterministic assurance improved against ${baseline.recordedAgainst}; record it so the gain cannot be lost:`,
    );
    for (const fix of fixes) {
      console.error(`- ${fix.code}: ${fix.current} < ${fix.maximum}`);
    }
    console.error("Run: npm run assurance:content:baseline");
    process.exit(1);
  } else if (!process.argv.includes("--json")) {
    console.log(
      `Deterministic assurance ratchet: PASS against ${baseline.recordedAgainst}; every finding code is at its recorded maximum.`,
    );
  }
}

if (process.argv.includes("--strict") && report.findings) {
  console.error("A1 content is not machine-certifiable yet.");
  process.exit(1);
}
