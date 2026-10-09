import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Pilot } from "../src/lib/learn/content.ts";
import { coachCaseContentVersion } from "../src/lib/learn/coach-case-version.ts";

/**
 * The coach's evaluation set (docs/COACH.md), built from the teaching content:
 * its examples and corrections should be judged natural, its documented
 * learner mistakes should be judged to need a change, and hand-written
 * context-dependent cases may be judged natural or unsure. A fixed 30% of
 * cases, chosen by hash, are held out for the release gate.
 *
 *   npm run coach:cases [-- --check]
 */

const ROOT = process.cwd();
const OUT = path.join(ROOT, "content", "coach-eval", "cases.json");
const pilot = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "compiled", "enhanced.json"), "utf8")) as Pilot;
const ambiguous = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "coach-eval", "ambiguous.json"), "utf8")) as { senses: string[]; text: string; note: string }[];

type Case = { id: string; split: "dev" | "test"; source: string; senses: string[]; text: string; expect: ("natural" | "needs-change" | "unsure")[] };
const cases: Case[] = [];
const seen = new Set<string>();
const known = new Set(pilot.entries.flatMap((entry) => entry.senses.map((sense) => sense.id)));

function add(source: string, senses: string[], text: string, expect: Case["expect"]) {
  const key = `${senses.join(",")}|${text}`;
  if (seen.has(key) || !senses.every((id) => known.has(id))) return;
  seen.add(key);
  const hash = createHash("sha256").update(key).digest();
  cases.push({ id: hash.toString("hex").slice(0, 10), split: hash[0]! < 0.3 * 256 ? "test" : "dev", source, senses, text, expect });
}

for (const entry of pilot.entries) {
  for (const sense of entry.senses) {
    for (const example of sense.examples) add("example", [sense.id], example.en, ["natural"]);
    add("mistake-right", [sense.id], sense.mistake.right, ["natural"]);
    add("mistake-wrong", [sense.id], sense.mistake.wrong, ["needs-change"]);
  }
}
for (const contrast of pilot.contrasts) {
  const senses = contrast.entries.slice(0, 3);
  for (const item of contrast.unnatural) {
    add("contrast-right", senses, item.right, ["natural"]);
    add("contrast-wrong", senses, item.wrong, ["needs-change"]);
  }
}
for (const item of ambiguous) add("ambiguous", item.senses, item.text, ["natural", "unsure"]);

const output = `${JSON.stringify(
  {
    // The content is unreviewed, so the set is too: it becomes the release gate
    // only after bilingual review confirms every expected verdict.
    status: pilot.entries.every((entry) => entry.released) ? "reviewed" : "draft",
    contentVersion: coachCaseContentVersion(cases),
    cases,
  },
  null,
  1,
)}\n`;
const counts = (split: string) => {
  const subset = cases.filter((item) => item.split === split);
  return `${subset.length} (${subset.filter((item) => item.expect[0] === "natural" && item.expect.length === 1).length} natural, ${subset.filter((item) => item.expect[0] === "needs-change").length} need a change, ${subset.filter((item) => item.expect.length > 1).length} context-dependent)`;
};
if (process.argv.includes("--check")) {
  if (!fs.existsSync(OUT) || fs.readFileSync(OUT, "utf8") !== output) {
    console.error("content/coach-eval/cases.json is out of date; run npm run coach:cases");
    process.exit(1);
  }
} else fs.writeFileSync(OUT, output);
console.log(`Coach cases OK: dev ${counts("dev")}; held out ${counts("test")}.`);
