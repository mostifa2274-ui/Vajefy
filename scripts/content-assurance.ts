import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Entry, Sense } from "../src/lib/learn/content";

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
let selectedIds: Set<string> | null = null;
if (requestedUnit) {
  const curriculumFile = path.join(ROOT, "content", "curriculum", "A1.json");
  const curriculum = JSON.parse(fs.readFileSync(curriculumFile, "utf8")) as {
    units: { id: string; entries: { id: string }[] }[];
  };
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

const entries: Entry[] = [];
for (const file of files) {
  const rows = JSON.parse(
    fs.readFileSync(path.join(ENTRY_DIR, file), "utf8"),
  ) as Entry[];
  entries.push(
    ...rows.filter(
      (entry) =>
        entry.id.startsWith("lex:A1:") &&
        (!selectedIds || selectedIds.has(entry.id)),
    ),
  );
}

let senses = 0;
for (const entry of entries) {
  for (const sense of entry.senses) {
    senses += 1;
    checkSense(sense);
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
    `A1 deterministic assurance${requestedUnit ? ` [${requestedUnit}]` : ""}: ${report.entries} entries, ${report.senses} senses, ${report.findings} finding(s).`,
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
