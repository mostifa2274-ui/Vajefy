import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { CheckItem, Entry } from "../src/lib/learn/content";
import { taskSupportIssues } from "../src/lib/learn/task-support";

/** Explicit, context-inspected English surface forms. Never guess translation at runtime. */
const GLOSSES: Readonly<Record<string, string>> = {
  heavy: "سنگین",
  hurts: "درد می‌کند",
  maths: "ریاضی",
  fridge: "یخچال",
  wet: "خیس",
  sky: "آسمان",
  boss: "رئیس",
  fresh: "تازه",
  lamp: "چراغ",
  stairs: "پله‌ها",
  slowly: "آهسته",
  beautifully: "به زیبایی",
};

type Finding = {
  code: string;
  where: string;
  frontier?: { token: string; frontierEntryId?: string; dependencyId?: string };
};
function assurance() {
  const p = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types", "--no-warnings",
      "--import", "./scripts/ts-test-register.mjs",
      "scripts/content-assurance.ts", "--json",
    ],
    { cwd: process.cwd(), encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (p.status !== 0) throw new Error("Content assurance failed: " + p.stderr);
  return JSON.parse(p.stdout) as {
    byCode: Record<string, number>;
    details: Finding[];
  };
}
const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "content", "pilot", "entries");
const curriculum = JSON.parse(
  fs.readFileSync(path.join(ROOT, "content", "curriculum", "A1.json"), "utf8"),
) as { units: { id: string; entries: { id: string }[] }[] };
const frozen = new Set(
  curriculum.units.slice(0, 3).flatMap(unit => unit.entries.map(entry => entry.id)),
);
const later = new Set(
  curriculum.units.slice(3).flatMap(unit => unit.entries.map(entry => entry.id)),
);

const sources = new Map<string, { task: CheckItem[]; entryId: string; file: string }>();
const files = new Map<string, { entries: Entry[]; indent: number; original: string }>();
for (const name of fs.readdirSync(SOURCE).filter(name => name.endsWith(".json")).sort()) {
  const file = path.join(SOURCE, name);
  const original = fs.readFileSync(file, "utf8");
  const entries = JSON.parse(original) as Entry[];
  const indent = /^\s*\[\s*\n( +)\{/m.exec(original)?.[1]?.length ?? 2;
  files.set(file, { entries, indent, original });
  for (const entry of entries) {
    if (!entry.id.startsWith("lex:A1:")) continue;
    for (const sense of entry.senses) {
      if (sources.has(sense.id)) throw new Error("Duplicate sense: " + sense.id);
      sources.set(sense.id, { task: sense.check, entryId: entry.id, file });
    }
  }
}

const before = assurance();
const changed = new Set<string>();
const modifiedFiles = new Set<string>();
const eligible = new Map<string, number>();
const skipped = new Map<string, number>();
for (const finding of before.details) {
  if (finding.code !== "FRONTIER_TASK_VOCABULARY") continue;
  const meta = finding.frontier;
  if (!meta || meta.dependencyId || !Object.hasOwn(GLOSSES, meta.token)) continue;
  if (!meta.frontierEntryId) throw new Error("Finding lost its curriculum anchor: " + finding.where);
  if (frozen.has(meta.frontierEntryId)) continue;
  if (!later.has(meta.frontierEntryId)) throw new Error("Unknown curriculum frontier: " + meta.frontierEntryId);

  const match = /^(.*)\.check\[(\d+)\]$/.exec(finding.where);
  if (!match) throw new Error("Malformed source finding: " + finding.where);
  const ref = sources.get(match[1]!);
  const task = ref?.task[Number(match[2])];
  if (!ref || !task) throw new Error("Missing referenced task: " + finding.where);

  const proposal = {
    ...task,
    support: [...(task.support ?? []), { en: meta.token, fa: GLOSSES[meta.token]! }],
  } as CheckItem;
  if ((task.support?.length ?? 0) >= 6 || taskSupportIssues(proposal).length) {
    skipped.set(meta.token, (skipped.get(meta.token) ?? 0) + 1);
    continue;
  }
  eligible.set(meta.token, (eligible.get(meta.token) ?? 0) + 1);
  if (process.argv.includes("--apply")) {
    (task as { support?: { en: string; fa: string }[] }).support = proposal.support;
    changed.add(ref.entryId);
    modifiedFiles.add(ref.file);
  }
}
const proposals = [...eligible.values()].reduce((total, value) => total + value, 0);
if (proposals < 20 || proposals > 70) {
  throw new Error("Unexpected candidate count " + proposals + "; review contextual selection before editing.");
}

if (process.argv.includes("--apply")) {
  for (const file of modifiedFiles) {
    const value = files.get(file)!;
    const next = JSON.stringify(value.entries, null, value.indent) + "\n";
    if (next === value.original) throw new Error("Expected source file to change: " + file);
    fs.writeFileSync(file, next);
  }
  const after = assurance();
  for (const code of new Set([...Object.keys(before.byCode), ...Object.keys(after.byCode)])) {
    if ((after.byCode[code] ?? 0) > (before.byCode[code] ?? 0)) {
      throw new Error("Assurance findings increased for " + code + "; do not commit this batch.");
    }
  }
  const prior = before.byCode.FRONTIER_TASK_VOCABULARY ?? 0;
  const remaining = after.byCode.FRONTIER_TASK_VOCABULARY ?? 0;
  if (remaining >= prior || prior - remaining < 20) {
    throw new Error("Frontier batch did not achieve its minimum improvement.");
  }
  console.log("Frontier batch: " + prior + " -> " + remaining +
    " task findings; " + changed.size + " source entries changed.");
} else {
  console.log("Frontier common-word repair proposal: " + proposals +
    " structurally admissible glosses in later units; no files written.");
}
console.log("Eligible: " + JSON.stringify(Object.fromEntries(eligible)));
console.log("Skipped as unsafe: " + JSON.stringify(Object.fromEntries(skipped)));
