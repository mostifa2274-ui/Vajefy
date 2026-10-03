import fs from "node:fs";
import path from "node:path";

/**
 * Order each level's entries by usefulness, so new words are introduced in a
 * purposeful order rather than at random. Usefulness is how often the
 * headword occurs across every example sentence in the app's datasets
 * except the job-specific occupations set: a word learners meet often in examples is a word
 * they need to read the rest. Ties keep the original order. The result is
 * written to public/data/usefulness.json.
 */

const DATA = path.join(process.cwd(), "public", "data");
const LEVELS = { A1: "lex-a1.json", A2: "lex-a2.json", B1: "lex-b1.json", B2: "lex-b2.json", B2x: "lex-b2x.json", C1: "lex-c1.json" };
const read = (file) => JSON.parse(fs.readFileSync(path.join(DATA, file), "utf8"));

function bare(word) {
  return word
    .replace(/[¹²³⁴⁵⁶⁷⁸⁹]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .split(/[,/]/)[0]
    .trim()
    .toLowerCase();
}

const sentences = [];
for (const file of fs.readdirSync(DATA).filter((name) => name.endsWith(".json") && !["meta.json", "usefulness.json", "pilot-a1.json", "pilot-order.json", "occupations.json"].includes(name))) {
  const rows = read(file);
  if (!Array.isArray(rows)) continue;
  for (const row of rows) if (typeof row?.ex === "string") sentences.push(row.ex.toLowerCase());
}
const counts = new Map();
for (const sentence of sentences) {
  for (const token of sentence.match(/[a-z']+/g) ?? []) counts.set(token, (counts.get(token) ?? 0) + 1);
}

const output = {};
for (const [level, file] of Object.entries(LEVELS)) {
  const words = read(file);
  output[level] = words
    .map((word, index) => {
      const tokens = bare(word.w).split(/\s+/).filter(Boolean);
      // A phrase is as frequent as its rarest word.
      const score = tokens.length ? Math.min(...tokens.map((token) => counts.get(token) ?? 0)) : 0;
      return { id: word.id, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.id);
}
const text = `${JSON.stringify(output)}\n`;
const target = path.join(DATA, "usefulness.json");
if (process.argv.includes("--check")) {
  if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== text) {
    console.error("public/data/usefulness.json is out of date; run npm run content:build");
    process.exit(1);
  }
} else fs.writeFileSync(target, text);
console.log(`Usefulness order OK: ${sentences.length} example sentences, ${Object.values(output).flat().length} entries.`);
