import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "public", "data");
const contract = JSON.parse(fs.readFileSync(new URL("./data-contract.json", import.meta.url), "utf8"));
const failures = [];
const globalIds = new Map();

function fail(message) {
  failures.push(message);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, file), "utf8"));
  } catch (error) {
    fail(`${file}: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
    return null;
  }
}

function fnv1a64(value) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < value.length; index++) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, "0");
}

function text(row, key, file, index, optional = false) {
  const value = row[key];
  if (optional && (value === undefined || value === null || value === "")) return;
  if (typeof value !== "string" || !value.trim()) {
    fail(`${file}[${index}].${key}: expected a non-empty string`);
  }
}

function band(row, file, index) {
  if (!Number.isInteger(row.band) || row.band < 1 || row.band > 3) {
    fail(`${file}[${index}].band: expected 1, 2, or 3`);
  }
}

function validateRow(file, row, index) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    fail(`${file}[${index}]: expected an object`);
    return;
  }
  text(row, "id", file, index);
  if (typeof row.id === "string") {
    const prefix = contract[file]?.prefix;
    if (prefix && !row.id.startsWith(prefix)) fail(`${file}[${index}].id: wrong prefix (${row.id})`);
    const prior = globalIds.get(row.id);
    if (prior) fail(`${file}[${index}].id: duplicate ${row.id}, already in ${prior}`);
    else globalIds.set(row.id, file);
  }

  if (file.startsWith("lex-")) {
    for (const key of ["w", "pr", "ipa", "pos", "fa", "ex", "tr"]) text(row, key, file, index);
  } else if (["collocations.json", "occupations.json", "phrasal.json", "prepositions.json", "verb-patterns.json"].includes(file)) {
    for (const key of ["w", "pr", "fa", "guide", "ex", "tr"]) text(row, key, file, index);
    text(row, "ipa", file, index, true);
    band(row, file, index);
  } else if (file === "antonyms.json") {
    for (const key of ["a", "b", "pr", "ipa", "fa", "guide"]) text(row, key, file, index);
    band(row, file, index);
  } else if (file === "confusing.json" || file === "synonyms.json") {
    const title = row.pair ?? row.group;
    if (typeof title !== "string" || !title.trim()) fail(`${file}[${index}]: missing pair/group title`);
    for (const key of ["pr", "ipa", "guide", "ex", "tr"]) text(row, key, file, index);
    text(row, "fa", file, index, true);
    band(row, file, index);
  } else if (file === "irregular.json") {
    for (const key of ["base", "past", "pp", "pr", "fa", "guide"]) text(row, key, file, index);
    band(row, file, index);
  } else if (file === "formation.json") {
    for (const key of ["affix", "fa", "samples", "samplesFa", "guide"]) text(row, key, file, index);
    band(row, file, index);
  } else if (file === "families.json") {
    for (const key of ["root", "guide", "ex", "tr"]) text(row, key, file, index);
    band(row, file, index);
    if (!Array.isArray(row.members) || row.members.length === 0) {
      fail(`${file}[${index}].members: expected a non-empty array`);
    } else {
      row.members.forEach((member, memberIndex) => {
        for (const key of ["en", "pr", "fa"]) text(member, key, `${file}[${index}].members`, memberIndex);
      });
    }
  }
}

for (const [file, expected] of Object.entries(contract)) {
  const rows = readJson(file);
  if (!Array.isArray(rows)) {
    fail(`${file}: expected a top-level array`);
    continue;
  }
  if (rows.length !== expected.count) {
    fail(`${file}: row count changed ${expected.count} -> ${rows.length}; update data-contract.json only after intentional review`);
  }
  rows.forEach((row, index) => validateRow(file, row, index));
  const ids = rows.map((row) => String(row?.id ?? "")).sort();
  const hash = fnv1a64(ids.join("\n"));
  if (hash !== expected.idHash) {
    fail(`${file}: stable ID set changed (${expected.idHash} -> ${hash}); preserve IDs or intentionally update the contract`);
  }
  const raw = JSON.stringify(rows);
  if (/[كي]/u.test(raw)) {
    fail(`${file}: Arabic ي/ك found; use Persian ی/ک so search and display stay normalized`);
  }
}

const meta = readJson("meta.json");
if (meta) {
  const levelMap = {
    A1: "lex-a1.json",
    A2: "lex-a2.json",
    B1: "lex-b1.json",
    B2: "lex-b2.json",
    B2x: "lex-b2x.json",
    C1: "lex-c1.json",
  };
  for (const level of meta.levels ?? []) {
    const file = levelMap[level.id];
    if (!file) fail(`meta.json: unknown level ${level.id}`);
    else if (level.count !== contract[file].count) fail(`meta.json: ${level.id} count does not match ${file}`);
  }
  const named = {
    occupations: "occupations.json",
    phrasal: "phrasal.json",
    collocations: "collocations.json",
    prepositions: "prepositions.json",
    antonyms: "antonyms.json",
    confusing: "confusing.json",
    patterns: "verb-patterns.json",
    irregular: "irregular.json",
    formation: "formation.json",
    synonyms: "synonyms.json",
    families: "families.json",
  };
  for (const [key, file] of Object.entries(named)) {
    if (meta.counts?.[key] !== contract[file].count) fail(`meta.json: counts.${key} does not match ${file}`);
  }
}

// The pilot list names learning targets by their stable entry IDs. Removing
// or renaming one of them would orphan editorial work and learner progress.
try {
  const pilot = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "pilot-a1.json"), "utf8"));
  const entries = Array.isArray(pilot.entries) ? pilot.entries : [];
  const seen = new Set();
  if (entries.length !== 150) fail(`content/pilot-a1.json: expected 150 entries, found ${entries.length}`);
  for (const entry of entries) {
    if (globalIds.get(entry.id) !== "lex-a1.json") fail(`content/pilot-a1.json: ${entry.id} is not an A1 entry`);
    if (seen.has(entry.id)) fail(`content/pilot-a1.json: duplicate ${entry.id}`);
    seen.add(entry.id);
    if (!pilot.groups?.[entry.group]) fail(`content/pilot-a1.json: ${entry.id} has unknown group ${entry.group}`);
  }
} catch (error) {
  fail(`content/pilot-a1.json: ${error instanceof Error ? error.message : String(error)}`);
}

if (failures.length) {
  console.error(`Data validation failed with ${failures.length} issue(s):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`Data contract OK: ${globalIds.size.toLocaleString("en-US")} unique records across ${Object.keys(contract).length} datasets.`);
