import fs from "node:fs";
import path from "node:path";
import type { CheckItem, Contrast, Entry, Scene } from "../src/lib/learn/content.ts";

/**
 * Authoring checks for enhanced content, beyond what the schema can say:
 *
 * - words above the learner's level in examples, checks and scenes;
 * - scenes too hard for an A1 learner, or that never use their target words;
 * - checks that repeat a teaching example instead of a new sentence;
 * - choices with duplicate options, and clozes that give their answer away.
 *
 * Problems marked "error" fail `--strict` (CI). Warnings are for an editor to
 * judge: a B1 word can be the right word, and a name is not vocabulary.
 *
 *   npm run content:lint [-- --strict] [-- --all]
 */

type Level = "A1" | "A2" | "B1" | "B2" | "B2x" | "C1";
type Finding = { severity: "error" | "warning"; where: string; message: string };

const ROOT = process.cwd();
const DATA = path.join(ROOT, "public", "data");
const SOURCE = path.join(ROOT, "content", "pilot");
const LEVELS: Level[] = ["A1", "A2", "B1", "B2", "B2x", "C1"];
/** Words an A1 learner can be expected to meet: A1 and A2. */
const ALLOWED = new Set<Level>(["A1", "A2"]);
/** A scene is too hard when more than this share of its words is above A2. */
const SCENE_LIMIT = 0.05;

const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;
const findings: Finding[] = [];
const add = (severity: Finding["severity"], where: string, message: string) => findings.push({ severity, where, message });

// The lowest level at which each word form is taught.
const levelOf = new Map<string, Level>();
const meta = read<{ levels: { id: Level; file: string }[] }>(path.join(DATA, "meta.json"));
for (const level of meta.levels) {
  for (const row of read<{ w: string }[]>(path.join(DATA, level.file))) {
    const forms = row.w
      .toLowerCase()
      // Homographs carry superscript numbers in the dataset (close¹, close²).
      .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, "")
      .replace(/\(.*?\)/g, "")
      .split(/[,/]/)
      .map((form) => form.trim())
      .filter(Boolean);
    for (const form of forms) {
      for (const word of form.split(/\s+/)) {
        const known = levelOf.get(word);
        if (!known || LEVELS.indexOf(level.id) < LEVELS.indexOf(known)) levelOf.set(word, level.id);
      }
    }
  }
}
const irregular = new Map<string, string>();
for (const row of read<{ base: string; past: string; pp: string }[]>(path.join(DATA, "irregular.json"))) {
  for (const form of `${row.past}/${row.pp}`.toLowerCase().split("/")) irregular.set(form.trim(), row.base.toLowerCase());
}
for (const [form, base] of Object.entries({
  is: "be", am: "be", are: "be", has: "have", these: "this", those: "that",
  children: "child", men: "man", women: "woman", people: "person", feet: "foot", teeth: "tooth", mice: "mouse",
  ca: "can", wo: "will", sha: "shall",
})) {
  irregular.set(form, base);
}

const CONTRACTED: Record<string, string> = { "'d": "would", "'ll": "will", "'re": "are", "'m": "am", "'ve": "have", "'s": "is" };

/** Possible dictionary forms of a word, by simple English inflection rules. */
function basesOf(token: string): Set<string> {
  const word = token.toLowerCase().replace("’", "'");
  const candidates = new Set([word]);
  if (word.endsWith("n't")) candidates.add(irregular.get(word.slice(0, -3)) ?? word.slice(0, -3));
  const apostrophe = word.indexOf("'");
  if (apostrophe > 0) {
    candidates.add(word.slice(0, apostrophe));
    const tail = CONTRACTED[word.slice(apostrophe)];
    if (tail) candidates.add(tail);
  }
  const base = irregular.get(word);
  if (base) candidates.add(base);
  const strip = (suffix: string, add = "") => word.endsWith(suffix) && word.length > suffix.length + 1 && candidates.add(word.slice(0, -suffix.length) + add);
  strip("s");
  strip("es");
  strip("ies", "y");
  strip("ed");
  strip("ed", "e");
  strip("d");
  strip("ied", "y");
  strip("ing");
  strip("ing", "e");
  strip("er");
  strip("est");
  strip("ly");
  strip("'s");
  if (/(bb|dd|gg|ll|mm|nn|pp|rr|tt)(ed|ing|er|est)$/.test(word)) candidates.add(word.replace(/(.)\1(ed|ing|er|est)$/, "$1"));
  for (const candidate of [...candidates]) {
    const irregularBase = irregular.get(candidate);
    if (irregularBase) candidates.add(irregularBase);
  }
  return candidates;
}

/** The lowest level that teaches any dictionary form of the word. */
function lookup(word: string): Level | null {
  let best: Level | null = null;
  for (const candidate of basesOf(word)) {
    const level = levelOf.get(candidate);
    if (level && (!best || LEVELS.indexOf(level) < LEVELS.indexOf(best))) best = level;
  }
  return best;
}

/** Words above the learner's level in a sentence; names and numbers are skipped. */
function hardWords(text: string, allow: Set<string>): string[] {
  const hard: string[] = [];
  const tokens = text.replace(/___/g, " ").match(/\p{L}+(?:['’]\p{L}+)?/gu) ?? [];
  tokens.forEach((token, index) => {
    // A capitalised word inside a sentence is a name (Ali, London, Monday is A1 anyway).
    if (index > 0 && /^[A-Z]/.test(token) && token !== "I") return;
    const word = token.toLowerCase().replace("’", "'");
    if (allow.has(word)) return;
    const level = lookup(word);
    if (!level) hard.push(`${token} (not in the lists)`);
    else if (!ALLOWED.has(level)) hard.push(`${token} (${level})`);
  });
  return hard;
}

const tokens = (text: string) => new Set((text.toLowerCase().match(/[a-z']+/g) ?? []).filter((word) => word.length > 2));
function similarity(a: string, b: string): number {
  const x = tokens(a);
  const y = tokens(b);
  const shared = [...x].filter((word) => y.has(word)).length;
  return shared / Math.max(1, new Set([...x, ...y]).size);
}

/** The English sentence a check shows, with the answer filled in. */
function sentenceOf(check: CheckItem): string | null {
  if (check.type === "cloze") return check.text.replace("___", check.answer);
  if (check.type === "produce") return check.frame.replace("___", check.answer);
  return /[A-Za-z]/.test(check.prompt) && !/[؀-ۿ]/.test(check.prompt) ? check.prompt : null;
}

function checkItems(where: string, items: CheckItem[], examples: string[], allow: Set<string>) {
  for (const item of items) {
    const at = `${where}/${item.id}`;
    const sentence = sentenceOf(item);
    if (sentence) {
      for (const example of examples) {
        if (similarity(sentence, example) >= 0.8) add("warning", at, `nearly repeats the teaching example "${example}"`);
      }
      const hard = hardWords(sentence, allow);
      if (hard.length) add("warning", at, `words above A2: ${hard.join(", ")}`);
    }
    if (item.type === "choice") {
      // Case can be meaningful here: PRE-sent and pre-SENT mark stress.
      const texts = item.options.map((option) => option.text.trim());
      if (new Set(texts).size !== texts.length) add("error", at, "two options are the same");
    }
    if (item.type === "cloze") {
      const rest = item.text.toLowerCase().split("___").join(" ");
      if (new RegExp(`\\b${item.answer.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(rest)) {
        add("warning", at, `the answer "${item.answer}" already appears in the sentence`);
      }
      const answers = [item.answer, ...item.accept].map((value) => value.trim().toLowerCase());
      if (new Set(answers).size !== answers.length) add("warning", at, "accepted answers repeat each other (grading already ignores case)");
    }
  }
}

const entries = fs
  .readdirSync(path.join(SOURCE, "entries"))
  .filter((name) => name.endsWith(".json"))
  .flatMap((name) => read<Entry[]>(path.join(SOURCE, "entries", name)));
const headwordOf = new Map<string, string>();
for (const entry of entries) {
  // An entry's own words are what it teaches, whatever their level elsewhere.
  const own = new Set(entry.headword.toLowerCase().split(/[^a-z']+/).filter(Boolean));
  for (const sense of entry.senses) {
    headwordOf.set(sense.id, entry.headword);
    const where = sense.id;
    const examples = sense.examples.map((example) => example.en);
    for (const example of sense.examples) {
      const hard = hardWords(example.en, own);
      if (hard.length) add("warning", where, `example "${example.en}": words above A2: ${hard.join(", ")}`);
    }
    checkItems(where, sense.check, examples, own);
  }
}

const contrasts = fs.existsSync(path.join(SOURCE, "contrasts.json")) ? read<Contrast[]>(path.join(SOURCE, "contrasts.json")) : [];
for (const contrast of contrasts) {
  const own = new Set(contrast.title.toLowerCase().split(/[^a-z']+/).filter(Boolean));
  checkItems(contrast.id, contrast.check, contrast.patterns.map((pattern) => pattern.en), own);
}

const scenes = fs.existsSync(path.join(SOURCE, "scenes.json")) ? read<Scene[]>(path.join(SOURCE, "scenes.json")) : [];
for (const scene of scenes) {
  const text = scene.lines.map((line) => line.en).join(" ");
  const words = text.match(/\p{L}+(?:['’]\p{L}+)?/gu) ?? [];
  const hard = scene.lines.flatMap((line) => hardWords(line.en, new Set()));
  if (hard.length / Math.max(1, words.length) > SCENE_LIMIT) {
    add("warning", scene.id, `${hard.length} of ${words.length} words are above A2 (${hard.slice(0, 6).join(", ")}): too hard for A1`);
  }
  const lower = ` ${text.toLowerCase().replace(/[^a-z' ]+/g, " ")} `;
  for (const target of scene.targets) {
    const headword = headwordOf.get(target);
    if (!headword) continue;
    const forms = headword.toLowerCase().split(/[,/]/).map((form) => form.replace(/\(.*?\)/g, "").trim()).filter(Boolean);
    const used = forms.some((form) => {
      const stem = form.replace(/e$/, "");
      return lower.includes(` ${form} `) || new RegExp(` ${stem}[a-z']* `).test(lower) || [...irregular].some(([inflected, base]) => base === form && lower.includes(` ${inflected} `));
    });
    if (!used) add("error", scene.id, `never uses its target "${headword}" (${target})`);
  }
  checkItems(scene.id, scene.check, [], new Set());
  // Each word of the model, as its possible dictionary forms, so "left" counts
  // as "leave" and "has to" as "have to".
  const model = (scene.write.model.match(/\p{L}+(?:['’]\p{L}+)?/gu) ?? []).map(basesOf);
  for (const phrase of scene.write.use) {
    const words = phrase.toLowerCase().split(/\s+/);
    const used = model.some((_, start) => words.every((word, offset) => model[start + offset]?.has(word)));
    if (!used) add("error", `${scene.id}/write`, `the model answer does not use "${phrase}"`);
  }
}

const errors = findings.filter((finding) => finding.severity === "error");
const warnings = findings.filter((finding) => finding.severity === "warning");
const shown = process.argv.includes("--all") ? findings : [...errors, ...warnings.slice(0, 25)];
for (const finding of shown) console.log(`${finding.severity === "error" ? "✗" : "!"} ${finding.where}: ${finding.message}`);
if (warnings.length > 25 && !process.argv.includes("--all")) console.log(`… ${warnings.length - 25} more warnings (--all to list them)`);
console.log(`Content lint: ${errors.length} error(s), ${warnings.length} warning(s) to review.`);
if (process.argv.includes("--strict") && errors.length) process.exit(1);
