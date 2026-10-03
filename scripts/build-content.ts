import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { contrast, entry, GOALS, orderForGoal, review, scene, type Entry, type Pilot, type PilotOrder, type SenseAudio } from "../src/lib/learn/content.ts";

/**
 * Compile the enhanced A1 pilot from `content/pilot/` into
 * `public/data/pilot-a1.json`, validating every entry, cross-reference and
 * review record. With `--check`, fail instead of writing when the compiled
 * file is out of date, so CI catches edits that were not rebuilt.
 */

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "content", "pilot");
const OUT = path.join(ROOT, "public", "data", "pilot-a1.json");
const ORDER_OUT = path.join(ROOT, "public", "data", "pilot-order.json");
const AUDIO = path.join(SOURCE, "audio-manifest.json");
const failures: string[] = [];

function read(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** A content version: the hash of the entry's teaching content. */
export function versionOf(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex").slice(0, 12);
}

const selection = read(path.join(ROOT, "content", "pilot-a1.json")) as { entries: { id: string; group: string }[] };
const order = new Map(selection.entries.map((item, index) => [item.id, index]));
const lexA1 = new Map(
  (read(path.join(ROOT, "public", "data", "lex-a1.json")) as { id: string; w: string }[]).map((row) => [row.id, row]),
);

const entries: Entry[] = [];
const entryDir = path.join(SOURCE, "entries");
for (const file of fs.readdirSync(entryDir).filter((name) => name.endsWith(".json")).sort()) {
  const rows = read(path.join(entryDir, file));
  if (!Array.isArray(rows)) {
    failures.push(`${file}: expected an array`);
    continue;
  }
  rows.forEach((row, index) => {
    const parsed = entry.safeParse(row);
    if (!parsed.success) {
      failures.push(`${file}[${index}] ${(row as { id?: string })?.id ?? ""}: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
    } else entries.push(parsed.data);
  });
}

const senseIds = new Set<string>();
const seenEntries = new Set<string>();
for (const item of entries) {
  if (seenEntries.has(item.id)) failures.push(`${item.id}: duplicate entry`);
  seenEntries.add(item.id);
  if (!order.has(item.id)) failures.push(`${item.id}: not in content/pilot-a1.json`);
  const lex = lexA1.get(item.id);
  if (!lex) failures.push(`${item.id}: not an existing A1 entry`);
  if (item.senses[0]?.id !== item.id) failures.push(`${item.id}: the first sense must keep the entry id`);
  for (const [index, sense] of item.senses.entries()) {
    if (index > 0 && !new RegExp(`^${item.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}#[a-z0-9-]+$`).test(sense.id)) {
      failures.push(`${sense.id}: further senses need ids like ${item.id}#name`);
    }
    if (senseIds.has(sense.id)) failures.push(`${sense.id}: duplicate sense id`);
    senseIds.add(sense.id);
    const checks = new Set<string>();
    for (const check of sense.check) {
      if (checks.has(check.id)) failures.push(`${sense.id}: duplicate check id ${check.id}`);
      checks.add(check.id);
    }
    // Assessment must use fresh sentences, not the teaching examples.
    const shown = new Set(sense.examples.map((example) => example.en.toLowerCase()));
    for (const check of sense.check) {
      if (check.type === "cloze" && shown.has(check.text.replace("___", check.answer).toLowerCase())) {
        failures.push(`${sense.id}/${check.id}: reuses a teaching example`);
      }
    }
  }
}
for (const id of order.keys()) if (!seenEntries.has(id)) failures.push(`${id}: selected for the pilot but has no content`);

function list<T>(file: string, schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }): T[] {
  const full = path.join(SOURCE, file);
  if (!fs.existsSync(full)) return [];
  const rows = read(full);
  if (!Array.isArray(rows)) {
    failures.push(`${file}: expected an array`);
    return [];
  }
  return rows.flatMap((row, index) => {
    const parsed = schema.safeParse(row);
    if (parsed.success) return [parsed.data];
    failures.push(`${file}[${index}]: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
    return [];
  });
}

const contrasts = list("contrasts.json", contrast);
for (const item of contrasts) {
  for (const id of item.entries) if (!senseIds.has(id)) failures.push(`${item.id}: unknown sense ${id}`);
}
const scenes = list("scenes.json", scene);
for (const item of scenes) {
  for (const id of item.targets) if (!senseIds.has(id)) failures.push(`${item.id}: unknown target ${id}`);
}

const ledgerFile = path.join(SOURCE, "review.json");
const ledger = fs.existsSync(ledgerFile) ? (read(ledgerFile) as Record<string, unknown>) : {};
type Clip = { text: string; file: string };
type ManifestSense = Partial<Record<"gb" | "us", { word?: Clip; examples?: (Clip | null)[] }>>;
const audio = fs.existsSync(AUDIO)
  ? (read(AUDIO) as { senses?: Record<string, ManifestSense>; clips?: Record<string, { bytes: number }> })
  : {};

const compiled: Pilot = {
  version: "",
  entries: entries
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((item) => {
      const version = versionOf(item);
      const parsed = ledger[item.id] === undefined ? null : review.safeParse(ledger[item.id]);
      if (parsed && !parsed.success) failures.push(`review.json ${item.id}: invalid review record`);
      const record = parsed?.success ? parsed.data : null;
      // An approval applies only to the exact content it reviewed.
      const current = record && record.version === version ? record : null;
      const released = Boolean(current && current.bilingual === "approved" && current.pronunciation === "approved");
      return { ...item, version, order: order.get(item.id) ?? 0, released, review: current };
    }),
  contrasts,
  scenes,
  audio: {},
  audioPack: { gb: { files: [], bytes: 0 }, us: { files: [], bytes: 0 } },
};
// A clip is attached only while its text still matches the content exactly,
// so editing a word or example can never leave outdated audio behind.
for (const item of compiled.entries) {
  for (const sense of item.senses) {
    const clips = audio.senses?.[sense.id];
    if (!clips) continue;
    const attached: SenseAudio = {};
    for (const accent of ["gb", "us"] as const) {
      const recorded = clips[accent];
      if (!recorded) continue;
      const wordText = sense.tts?.[accent] ?? item.headword;
      const word = recorded.word?.text === wordText ? recorded.word.file : undefined;
      const examples = sense.examples.map((example, index) => {
        const clip = recorded.examples?.[index];
        return clip && clip.text === example.en ? clip.file : null;
      });
      if (word || examples.some(Boolean)) attached[accent] = { ...(word ? { word } : {}), examples };
    }
    if (attached.gb || attached.us) compiled.audio[sense.id] = attached;
  }
}
for (const accent of ["gb", "us"] as const) {
  const files = new Set<string>();
  for (const clips of Object.values(compiled.audio)) {
    const recorded = clips[accent];
    if (recorded?.word) files.add(recorded.word);
    for (const file of recorded?.examples ?? []) if (file) files.add(file);
  }
  const sorted = [...files].sort();
  compiled.audioPack[accent] = {
    files: sorted,
    bytes: sorted.reduce((sum, file) => sum + (audio.clips?.[file.replace(/^pilot\//, "")]?.bytes ?? 0), 0),
  };
}
compiled.version = versionOf({ entries: compiled.entries.map((item) => item.version), contrasts, scenes, audio: compiled.audio });

if (failures.length) {
  console.error(`Pilot content failed validation with ${failures.length} issue(s):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

// The introduction order per goal, small enough for Today to load at once.
const targets = compiled.entries.flatMap((item) => item.senses.map((sense, position) => ({ id: sense.id, goals: item.goals, sense: position })));
const pilotOrder: PilotOrder = {
  version: compiled.version,
  order: Object.fromEntries(GOALS.map((goal) => [goal, orderForGoal(targets, goal, (target) => target).map((target) => target.id)])) as PilotOrder["order"],
};

for (const [file, output] of [
  [OUT, `${JSON.stringify(compiled)}\n`],
  [ORDER_OUT, `${JSON.stringify(pilotOrder)}\n`],
] as const) {
  if (process.argv.includes("--check")) {
    const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    if (existing !== output) {
      console.error(`${path.relative(ROOT, file)} is out of date; run npm run content:build`);
      process.exit(1);
    }
  } else {
    fs.writeFileSync(file, output);
  }
}
const released = compiled.entries.filter((item) => item.released).length;
const senses = compiled.entries.reduce((sum, item) => sum + item.senses.length, 0);
console.log(
  `Pilot content OK: ${compiled.entries.length} entries, ${senses} senses, ${contrasts.length} contrasts, ${scenes.length} scenes; ${released} released, ${Object.keys(compiled.audio).length} senses with current audio.`,
);
