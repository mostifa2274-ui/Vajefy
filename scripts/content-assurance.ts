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

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u200c\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function needsPersian(value: string | undefined, where: string, code: string) {
  if (!value || !PERSIAN.test(value)) {
    add(code, where, "learner-facing Persian field contains no Persian-script text");
  }
}

function checkSense(sense: Sense) {
  const base = sense.id;

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

  if (normalize(sense.mistake.wrong) === normalize(sense.mistake.right)) {
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

const files = fs
  .readdirSync(ENTRY_DIR)
  .filter((name) => name.endsWith(".json"))
  .sort();

const entries: Entry[] = [];
for (const file of files) {
  const rows = JSON.parse(
    fs.readFileSync(path.join(ENTRY_DIR, file), "utf8"),
  ) as Entry[];
  entries.push(...rows.filter((entry) => entry.id.startsWith("lex:A1:")));
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
    `A1 deterministic assurance: ${report.entries} entries, ${report.senses} senses, ${report.findings} finding(s).`,
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

if (process.argv.includes("--strict") && report.findings) {
  console.error("A1 content is not machine-certifiable yet.");
  process.exit(1);
}
