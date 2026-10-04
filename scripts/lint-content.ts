import fs from "node:fs";
import path from "node:path";
import type { CheckItem, Contrast, Entry, Scene } from "../src/lib/learn/content.ts";
import { LEVELS, read, ROOT, type Level } from "./catalogue.ts";
import { basesOf, irregular, lookup } from "./words.ts";

/**
 * Authoring checks for enhanced content, beyond what the schema can say:
 *
 * - words above the learner's level in examples, checks and scenes: for
 *   content at a level, words taught at that level or the next are expected;
 * - scenes too hard for their learners, or that never use their target words;
 * - checks that repeat a teaching example instead of a new sentence;
 * - choices with duplicate options, and clozes that give their answer away.
 *
 * Problems marked "error" fail `--strict` (CI). Warnings are for an editor to
 * judge: a B1 word can be the right word, and a name is not vocabulary.
 *
 *   npm run content:lint [-- --strict] [-- --all]
 */

type Finding = { severity: "error" | "warning"; where: string; message: string };

const SOURCE = path.join(ROOT, "content", "pilot");
/** Words a learner at a level can be expected to meet: that level, those below and the next. */
const reach = (level: Level) => LEVELS[Math.min(LEVELS.length - 1, LEVELS.indexOf(level) + 1)]!;
const allowedAt = (level: Level) => new Set(LEVELS.slice(0, LEVELS.indexOf(reach(level)) + 1));
const levelOfId = (id: string): Level => (/^lex:([A-Za-z0-9]+):/.exec(id)?.[1] as Level | undefined) ?? "A1";
const highest = (levels: Level[]): Level => levels.reduce((top, level) => (LEVELS.indexOf(level) > LEVELS.indexOf(top) ? level : top), "A1" as Level);
/** Titles before a name, which the vocabulary lists leave out. */
const TITLES = new Set(["mr", "mrs", "ms", "dr"]);
/** A scene is too hard when more than this share of its words is beyond its learners' reach. */
const SCENE_LIMIT = 0.05;

const findings: Finding[] = [];
const add = (severity: Finding["severity"], where: string, message: string) => findings.push({ severity, where, message });

/** Words beyond the reach of learners at a level, in a sentence; names and numbers are skipped. */
function hardWords(text: string, allow: Set<string>, level: Level): string[] {
  const allowed = allowedAt(level);
  const hard: string[] = [];
  const tokens = text.replace(/___/g, " ").match(/\p{L}+(?:['’]\p{L}+)?/gu) ?? [];
  tokens.forEach((token, index) => {
    // A capitalised word inside a sentence is a name (Ali, London, Monday is A1 anyway).
    if (index > 0 && /^[A-Z]/.test(token) && token !== "I") return;
    // Single letters are initials and abbreviations (p.m.); "a" and "I" are A1.
    if (token.length === 1) return;
    const word = token.toLowerCase().replace("’", "'");
    if (allow.has(word) || TITLES.has(word)) return;
    const found = lookup(word);
    if (!found) hard.push(`${token} (not in the lists)`);
    else if (!allowed.has(found)) hard.push(`${token} (${found})`);
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

function checkItems(where: string, items: CheckItem[], examples: string[], allow: Set<string>, level: Level) {
  for (const item of items) {
    const at = `${where}/${item.id}`;
    const sentence = sentenceOf(item);
    if (sentence) {
      for (const example of examples) {
        if (similarity(sentence, example) >= 0.8) add("warning", at, `nearly repeats the teaching example "${example}"`);
      }
      const hard = hardWords(sentence, allow, level);
      if (hard.length) add("warning", at, `words above ${reach(level)}: ${hard.join(", ")}`);
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
  const own = new Set(entry.headword.toLowerCase().replace(/’/g, "'").split(/[^a-z']+/).filter(Boolean));
  const level = levelOfId(entry.id);
  for (const sense of entry.senses) {
    headwordOf.set(sense.id, entry.headword);
    const where = sense.id;
    const examples = sense.examples.map((example) => example.en);
    for (const example of sense.examples) {
      const hard = hardWords(example.en, own, level);
      if (hard.length) add("warning", where, `example "${example.en}": words above ${reach(level)}: ${hard.join(", ")}`);
    }
    checkItems(where, sense.check, examples, own, level);
  }
}

const contrasts = fs.existsSync(path.join(SOURCE, "contrasts.json")) ? read<Contrast[]>(path.join(SOURCE, "contrasts.json")) : [];
for (const contrast of contrasts) {
  const own = new Set(contrast.title.toLowerCase().replace(/’/g, "'").split(/[^a-z']+/).filter(Boolean));
  checkItems(contrast.id, contrast.check, contrast.patterns.map((pattern) => pattern.en), own, highest(contrast.entries.map(levelOfId)));
}

const scenes = fs.existsSync(path.join(SOURCE, "scenes.json")) ? read<Scene[]>(path.join(SOURCE, "scenes.json")) : [];
for (const scene of scenes) {
  const text = scene.lines.map((line) => line.en).join(" ");
  const words = text.match(/\p{L}+(?:['’]\p{L}+)?/gu) ?? [];
  const level = highest(scene.targets.map(levelOfId));
  const hard = scene.lines.flatMap((line) => hardWords(line.en, new Set(), level));
  if (hard.length / Math.max(1, words.length) > SCENE_LIMIT) {
    add("warning", scene.id, `${hard.length} of ${words.length} words are above ${reach(level)} (${hard.slice(0, 6).join(", ")}): too hard for ${level}`);
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
  checkItems(scene.id, scene.check, [], new Set(), level);
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
