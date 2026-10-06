import fs from "node:fs";
import path from "node:path";

/**
 * Checks the feature ledger in docs/FEATURES.md (plan §30): every row is
 * complete, its paths exist, and every screen in src/routes belongs to a
 * feature. `--check` exits non-zero on any problem.
 */

const ROOT = process.cwd();
const FILE = path.join(ROOT, "docs", "FEATURES.md");
const START = "<!-- feature-ledger:start -->";
const END = "<!-- feature-ledger:end -->";
const COLUMNS = [
  "Feature",
  "Paths",
  "Learning purpose",
  "Success measure",
  "Remove or redesign if",
  "Depends on",
  "Last review",
  "Status",
];
const STATUSES = ["ACTIVE", "FROZEN", "OFF"];

const problems: string[] = [];
const lines = fs.readFileSync(FILE, "utf8").split("\n");
const start = lines.findIndex((line) => line.trim() === START);
const end = lines.findIndex((line) => line.trim() === END);
if (start < 0 || end < start) {
  console.error(`docs/FEATURES.md: markers ${START} and ${END} are missing or out of order.`);
  process.exit(1);
}

const cells = (line: string) =>
  line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
const table = lines
  .slice(start + 1, end)
  .map((text, index) => ({ text, line: start + 2 + index }))
  .filter(({ text }) => text.trim().startsWith("|"));

if (cells(table[0]?.text ?? "").join("|") !== COLUMNS.join("|")) {
  console.error(`docs/FEATURES.md: the header must be: ${COLUMNS.join(" | ")}`);
  process.exit(1);
}

const covered = new Set<string>();
const names = new Set<string>();
const counts: Record<string, number> = {};
for (const { text, line } of table.slice(2)) {
  const row = cells(text);
  const where = `docs/FEATURES.md:${line}`;
  if (row.length !== COLUMNS.length) {
    problems.push(`${where} has ${row.length} cells; expected ${COLUMNS.length}`);
    continue;
  }
  const [name, paths, , , , , review, status] = row;
  COLUMNS.forEach((column, index) => {
    if (!row[index]) problems.push(`${where} ${name || "?"}: ${column} is empty`);
  });
  if (names.has(name)) problems.push(`${where} ${name}: duplicate feature`);
  names.add(name);
  if (!STATUSES.includes(status)) {
    problems.push(`${where} ${name}: status "${status}" is not one of ${STATUSES.join(", ")}`);
  } else {
    counts[status] = (counts[status] ?? 0) + 1;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(review) || Number.isNaN(Date.parse(review))) {
    problems.push(`${where} ${name}: last review "${review}" is not a YYYY-MM-DD date`);
  }
  for (const item of paths.split(";").map((part) => part.trim())) {
    const match = /^`([^`]+)`$/.exec(item);
    if (!match) {
      problems.push(`${where} ${name}: path "${item}" must be backticked and separated by ";"`);
    } else if (!fs.existsSync(path.join(ROOT, match[1]))) {
      problems.push(`${where} ${name}: path does not exist: ${match[1]}`);
    } else {
      covered.add(match[1]);
    }
  }
}

const routes = fs
  .readdirSync(path.join(ROOT, "src", "routes"))
  .filter((file) => file.endsWith(".tsx") && !file.startsWith("__"))
  .map((file) => `src/routes/${file}`);
for (const route of routes) {
  if (!covered.has(route)) problems.push(`docs/FEATURES.md: screen ${route} belongs to no feature`);
}

console.log(
  `Feature ledger: ${names.size} feature(s): ${STATUSES.filter((status) => counts[status]).map((status) => `${counts[status]} ${status}`).join(", ")}; ${routes.length} screen(s) covered.`,
);
for (const problem of problems) console.error(`! ${problem}`);
if (process.argv.includes("--check") && problems.length) {
  console.error(`Feature ledger is inconsistent: ${problems.length} problem(s).`);
  process.exit(1);
}
