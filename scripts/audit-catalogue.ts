import fs from "node:fs";
import path from "node:path";
import { COLLECTIONS, LEVELS, notesOf, read, ROOT, rowsOf, type Level, type Note, type Row } from "./catalogue.ts";
import { basesOf, lookup } from "./words.ts";

/**
 * The catalogue audit (docs/CATALOGUE.md#the-audit): the same kind of checks
 * the enhanced content passes, run over every entry of every level and every
 * reference note, so problems across the whole catalogue are found, fixed and
 * kept fixed.
 *
 * Errors are never accepted. Warnings an editor has judged acceptable, or not
 * yet fixed, are listed in content/audit/baseline.json; CI fails on any
 * finding not in it, and on baseline lines that no longer occur, so the
 * baseline only shrinks.
 *
 *   npm run content:audit                  summary, and findings not in the baseline
 *   npm run content:audit -- --all         every finding
 *   npm run content:audit -- --check       (CI)
 *   npm run content:audit -- --update      accept the current warnings as the baseline
 */

type Severity = "error" | "warning";
type Finding = { rule: string; severity: Severity; id: string; field: string; message: string };

const BASELINE = path.join(ROOT, "content", "audit", "baseline.json");
const findings: Finding[] = [];
const add = (rule: string, severity: Severity, id: string, field: string, message: string) => findings.push({ rule, severity, id, field, message });
const keyOf = (finding: Finding) => `${finding.rule} ${finding.id}${finding.field ? `.${finding.field}` : ""}`;

const PERSIAN = /[؀-ۿ]/;
const OPEN = /[⁦⁧⁨]/g;
/** Fields that hold pronunciation, where IPA beside a Persian respelling is intended. */
const PRONUNCIATION = new Set(["pr", "ipa"]);

/** Checks every text field of a row or note, however deeply nested. */
function text(id: string, value: unknown, field = "") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => text(id, item, `${field}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) text(id, item, field ? `${field}.${key}` : key);
    return;
  }
  if (typeof value !== "string") return;
  const name = field.replace(/^.*\./, "").replace(/\[\d+\]$/, "");
  if (value !== value.trim() || /[^\S\n]{2,}|[^\S\n]\n|\n[^\S\n]/.test(value)) add("spacing", "error", id, field, "stray or doubled spaces");
  // Each isolate (⁦ ⁧ ⁨) must be closed (⁩), or the rest of the line renders in the wrong direction.
  let depth = 0;
  for (const char of value) {
    if (/[⁦⁧⁨]/.test(char)) depth++;
    else if (char === "⁩") depth--;
    if (depth < 0) break;
  }
  if (depth !== 0) add("isolates", "error", id, field, "an unbalanced direction isolate (⁦…⁩)");
  else if (/[\u2066-\u2068]{2}/.test(value)) add("isolates", "error", id, field, "an isolate opened directly inside another (⁦⁦…⁩⁩)");
  // English inside Persian text is isolated so it keeps its order in a right-to-left line.
  if (PERSIAN.test(value) && !PRONUNCIATION.has(name)) {
    const outside = value.replace(/⁦[^⁩]*⁩/g, "").replace(OPEN, "");
    const latin = outside.match(/[A-Za-z][A-Za-z'’.-]*(?:\s+[A-Za-z][A-Za-z'’.-]*)*/g);
    if (latin) add("latin-in-persian", "warning", id, field, `English not isolated in Persian text: ${latin.slice(0, 3).join(", ")}`);
  }
}

const words = (sentence: string) => sentence.match(/\p{L}+(?:['’]\p{L}+)*/gu) ?? [];
/** Every dictionary form the words of a sentence may stand for. */
const formsIn = (sentence: string) => new Set(words(sentence).flatMap((word) => [...basesOf(word)]));
const bare = (headword: string) =>
  headword
    .toLowerCase()
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/’/g, "'");
/** Words a phrase can change or leave out in use: articles, placeholders, possessives. */
const FLEXIBLE = new Set(["a", "an", "the", "someone", "someone's", "somebody", "something", "sb", "sth", "one's", "your", "my", "his", "her", "their", "our", "its", "..."]);
/** Whether a sentence uses a word or phrase in some form: each of its words, in any inflection. */
function uses(text: string, phrase: string): boolean {
  const sentence = text.replace(/&/g, "and");
  const forms = formsIn(sentence);
  const lower = sentence.toLowerCase().replace(/’/g, "'");
  return phrase
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/&/g, "and")
    .replace(/\(.*?\)/g, "")
    // "Talent Agent or Business Manager" names two jobs; either will do.
    .split(/\s*[,/]\s*|\s+or\s+/)
    .map((form) => form.trim())
    .filter(Boolean)
    .some(
      (form) =>
        lower.includes(form) ||
        form
          .split(/[\s-]+/)
          .filter((word) => word && !FLEXIBLE.has(word) && !/^\.+$/.test(word))
          .every((word) => forms.has(word) || [...basesOf(word)].some((base) => forms.has(base))),
    );
}

/** "an utility", "a apple": an article that does not match the sound after it. */
function article(id: string, field: string, sentence: string) {
  const wrong = sentence.match(/\b[Aa]n (?=(?:uni|use|usu|uti|ure|uro|eu|one\b|once\b))\w+|\b[Aa] (?=[aei]|o(?!ne\b|nce\b)|u(?!ni|se|su|ti|re|ro|ra|k|bi|ga))[a-z]\w*/g);
  if (wrong) add("article", "warning", id, field, `check the article: ${wrong.join(", ")}`);
}

const LEVEL_ORDER: readonly Level[] = LEVELS;
const reach = (level: Level) => LEVEL_ORDER[Math.min(LEVEL_ORDER.length - 1, LEVEL_ORDER.indexOf(level) + 1)]!;

// Entries of every level.
const examples = new Map<string, string>();
for (const level of LEVELS) {
  const allowed = new Set(LEVEL_ORDER.slice(0, LEVEL_ORDER.indexOf(reach(level)) + 1));
  for (const row of rowsOf(level) as Row[]) {
    text(row.id, row);
    const headword = bare(row.w);
    if (row.ipa && !/^\/[^/]+\/$|^(\p{L}+ \/[^/]+\/)(; \p{L}+ \/[^/]+\/)+$/u.test(row.ipa)) add("ipa", "error", row.id, "ipa", `not /…/ (or "noun /…/; verb /…/"): ${row.ipa}`);
    if (!/^["“]?[A-Z0-9]/.test(row.ex) || !/[.!?]["”’)]?$/.test(row.ex)) add("example-sentence", "warning", row.id, "ex", "the example is not a full sentence (capital, final punctuation)");
    if (!/[.!؟?»)]$/.test(row.tr)) add("translation-sentence", "warning", row.id, "tr", "the translation has no final punctuation");
    article(row.id, "ex", row.ex);
    if (!uses(row.ex, headword)) add("example-headword", "warning", row.id, "ex", `the example does not use "${row.w}"`);
    const seen = examples.get(row.ex.toLowerCase().trim());
    if (seen) add("example-repeated", "warning", row.id, "ex", `the same example as ${seen}; assessment needs a sentence of its own`);
    else examples.set(row.ex.toLowerCase().trim(), row.id);
    const own = new Set(headword.split(/[^a-z']+/).filter(Boolean));
    const hard = words(row.ex).filter((word, index) => {
      if (index > 0 && /^[A-Z]/.test(word) && word !== "I") return false;
      if (own.has(word.toLowerCase())) return false;
      const found = lookup(word);
      return found !== null && !allowed.has(found);
    });
    if (hard.length) add("example-level", "warning", row.id, "ex", `words above ${reach(level)}: ${hard.map((word) => `${word} (${lookup(word)})`).join(", ")}`);
  }
}

// The reference notes.
/** An example with its subject left out, to find one sentence reused with only the subject changed. */
const shape = (example: string, title: string) => {
  const own = new Set(title.toLowerCase().split(/[^a-z]+/));
  return words(example.toLowerCase())
    .filter((word) => !own.has(word) && !["a", "an", "the"].includes(word))
    .join(" ");
};
const shapes = new Map<string, string[]>();

function item(note: Note, prefix: string): string {
  if (prefix === "ant") return `${note.a} / ${note.b}`;
  if (prefix === "irr") return String(note.base);
  if (prefix === "fam") return String(note.root);
  if (prefix === "wf") return String(note.affix);
  if (prefix === "conf") return String(note.pair);
  if (prefix === "syn") return String(note.group);
  return String(note.w);
}

for (const collection of COLLECTIONS) {
  for (const note of notesOf(collection.file)) {
    text(note.id, note);
    const name = item(note, collection.prefix);
    const example = typeof note.ex === "string" ? note.ex : "";
    if (example) {
      if (!/[.!?]["”’)]?$/.test(example.trim())) add("example-sentence", "warning", note.id, "ex", "the example has no final punctuation");
      article(note.id, "ex", example);
      const key = `${collection.prefix} ${shape(example, name)}`;
      shapes.set(key, [...(shapes.get(key) ?? []), note.id]);
      // What the note teaches should appear in its example.
      const phrase =
        collection.prefix === "vp" || collection.prefix === "prep" || collection.prefix === "pv"
          ? name.split(/\s*\+\s*/)[0]!.replace(/\b(sb|sth|someone|something|one's)\b/g, "").trim()
          : collection.prefix === "fam"
            ? [name, ...((note.members as { en: string }[]) ?? []).map((member) => member.en.replace(/\(.*?\)/g, "").trim())].join(" / ")
            : name;
      if (phrase && !uses(example, phrase)) add("example-item", "warning", note.id, "ex", `the example does not use "${phrase}"`);
    }
    // Words a note compares or lists should be words the app teaches.
    // (Antonym pairs often teach derived words such as "unkind", which the lists do not include.)
    const listed = collection.prefix === "irr" ? [note.base] : collection.prefix === "conf" || collection.prefix === "syn" ? name.split("/") : [];
    for (const word of listed.map((value) => String(value).trim().toLowerCase())) {
      if (word && !word.includes(" ") && !lookup(word)) add("note-word", "warning", note.id, "", `"${word}" is not in the vocabulary lists`);
    }
  }
}

// One sentence shared by several notes describes none of them: a learner
// cannot tell a crane operator from a conveyor operator by it.
for (const ids of shapes.values()) {
  if (ids.length < 4) continue;
  for (const id of ids) add("example-template", "warning", id, "ex", `a generic sentence shared with ${ids.length - 1} other notes; say what this one involves`);
}

// Report against the baseline.
const baseline = new Set<string>(fs.existsSync(BASELINE) ? read<string[]>(BASELINE) : []);
const keys = new Set(findings.map(keyOf));
const errors = findings.filter((finding) => finding.severity === "error");
const fresh = findings.filter((finding) => finding.severity === "warning" && !baseline.has(keyOf(finding)));
const fixed = [...baseline].filter((key) => !keys.has(key));

const groups = new Map<string, Map<string, number>>();
for (const finding of findings) {
  const where = /^lex:([A-Za-z0-9]+):/.exec(finding.id)?.[1] ?? COLLECTIONS.find((collection) => finding.id.startsWith(`${collection.prefix}:`))?.prefix ?? "?";
  const row = groups.get(where) ?? new Map<string, number>();
  row.set(finding.rule, (row.get(finding.rule) ?? 0) + 1);
  groups.set(where, row);
}
const rules = [...new Set(findings.map((finding) => finding.rule))].sort();
const order = [...LEVELS, ...COLLECTIONS.map((collection) => collection.prefix)];
const header = ["", ...rules];
const table = [header, ...order.filter((where) => groups.has(where)).map((where) => [where, ...rules.map((rule) => String(groups.get(where)!.get(rule) ?? ""))])];
const widths = header.map((_, column) => Math.max(...table.map((line) => line[column]!.length)));
for (const line of table) console.log(line.map((cell, column) => cell.padEnd(widths[column]!)).join("  "));

const show = (list: Finding[]) => list.forEach((finding) => console.log(`${finding.severity === "error" ? "✗" : "!"} ${keyOf(finding)}: ${finding.message}`));
if (process.argv.includes("--all")) show(findings);
else {
  show(errors);
  show(fresh.slice(0, 40));
  if (fresh.length > 40) console.log(`… ${fresh.length - 40} more new findings (--all to list every finding)`);
}

if (process.argv.includes("--update")) {
  const accepted = findings.filter((finding) => finding.severity === "warning").map(keyOf).sort();
  fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
  fs.writeFileSync(BASELINE, `${JSON.stringify(accepted, null, 1)}\n`);
  console.log(`\nBaseline updated: ${accepted.length} warning(s) accepted.`);
}
console.log(
  `\nCatalogue audit: ${errors.length} error(s), ${findings.length - errors.length} warning(s) (${fresh.length} not in the baseline); ${fixed.length} baseline line(s) fixed.`,
);
if (process.argv.includes("--check")) {
  if (errors.length || fresh.length) process.exit(1);
  if (fixed.length) {
    console.error(`Fixed findings are still in content/audit/baseline.json; run npm run content:audit -- --update:\n- ${fixed.slice(0, 10).join("\n- ")}`);
    process.exit(1);
  }
}
