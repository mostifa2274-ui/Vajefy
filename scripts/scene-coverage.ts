import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const CATALOGUE = path.join(ROOT, "public", "data", "enhanced", "index.json");
const CURRICULUM = path.join(ROOT, "content", "curriculum", "A1.json");
const SCENES = path.join(ROOT, "content", "pilot", "scenes.json");
const OUTPUT = path.join(ROOT, "content", "assurance", "scene-coverage.json");

type ListedEntry = {
  id: string;
  senses: { id: string }[];
};

type Catalogue = {
  entries: ListedEntry[];
};

type Curriculum = {
  units: { entries: { id: string }[] }[];
};

type Scene = {
  id: string;
  kind: string;
  targets: string[];
  check: unknown[];
};

type SceneCoverageReport = {
  schemaVersion: 1;
  sourceFiles: {
    catalogue: string;
    curriculum: string;
    scenes: string;
  };
  threshold: null;
  thresholdStatus: "UNSET";
  summary: {
    senses: number;
    scenes: number;
    covered: number;
    uncovered: number;
    coverageRatio: number;
    coveredByTwoOrMore: number;
    maxScenesPerSense: number;
  };
  scenes: {
    id: string;
    kind: string;
    targetCount: number;
    checkCount: number;
  }[];
  senses: {
    id: string;
    entryId: string;
    sceneCount: number;
    scenes: string[];
  }[];
};

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function entryIdOf(senseId: string): string {
  const hash = senseId.indexOf("#");
  return hash < 0 ? senseId : senseId.slice(0, hash);
}

export function buildSceneCoverage(
  catalogue: Catalogue,
  curriculum: Curriculum,
  scenes: Scene[],
): SceneCoverageReport {
  const senseIds = catalogue.entries.flatMap((entry) =>
    entry.senses.map((sense) => sense.id),
  );
  const known = new Set(senseIds);
  const bySense = new Map(senseIds.map((id) => [id, [] as string[]]));
  const introduction = new Map<string, number>();
  let order = 0;
  for (const unit of curriculum.units) {
    for (const entry of unit.entries) {
      order += 1;
      introduction.set(entry.id, order);
    }
  }

  for (const scene of scenes) {
    if (!scene.id || !scene.kind) throw new Error("Every scene needs id and kind.");
    if (!Array.isArray(scene.targets) || scene.targets.length === 0) {
      throw new Error(`${scene.id}: scene has no targets.`);
    }
    if (!Array.isArray(scene.check) || scene.check.length < 2) {
      throw new Error(`${scene.id}: scene needs at least two comprehension checks.`);
    }
    for (const id of scene.targets) {
      if (!known.has(id)) throw new Error(`${scene.id}: unknown target ${id}.`);
      const ownOrder = introduction.get(entryIdOf(id));
      if (ownOrder === undefined) continue;
      const recyclesLater = scene.targets.some((other) => {
        const otherOrder = introduction.get(entryIdOf(other));
        return otherOrder !== undefined && otherOrder > ownOrder;
      });
      if (!recyclesLater) continue;
      const bucket = bySense.get(id)!;
      if (!bucket.includes(scene.id)) bucket.push(scene.id);
    }
  }

  const senses = senseIds
    .map((id) => {
      const coveredBy = [...(bySense.get(id) ?? [])].sort();
      return {
        id,
        entryId: entryIdOf(id),
        sceneCount: coveredBy.length,
        scenes: coveredBy,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const counts = senses.map((sense) => sense.sceneCount);
  const covered = counts.filter((count) => count > 0).length;

  return {
    schemaVersion: 1,
    sourceFiles: {
      catalogue: "public/data/enhanced/index.json",
      curriculum: "content/curriculum/A1.json",
      scenes: "content/pilot/scenes.json",
    },
    // No numeric release threshold exists in the frozen plan yet. Report the
    // evidence honestly; a later threshold must be explicit and versioned.
    threshold: null,
    thresholdStatus: "UNSET",
    summary: {
      senses: senses.length,
      scenes: scenes.length,
      covered,
      uncovered: senses.length - covered,
      coverageRatio: senses.length ? Number((covered / senses.length).toFixed(6)) : 0,
      coveredByTwoOrMore: counts.filter((count) => count >= 2).length,
      maxScenesPerSense: counts.length ? Math.max(...counts) : 0,
    },
    scenes: scenes
      .map((scene) => ({
        id: scene.id,
        kind: scene.kind,
        targetCount: scene.targets.length,
        checkCount: scene.check.length,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    senses,
  };
}

function serialized(report: SceneCoverageReport): string {
  return JSON.stringify(report, null, 2) + "\n";
}

function main() {
  const catalogue = readJson<Catalogue>(CATALOGUE);
  const curriculum = readJson<Curriculum>(CURRICULUM);
  const scenes = readJson<Scene[]>(SCENES);
  const expected = serialized(buildSceneCoverage(catalogue, curriculum, scenes));
  const check = process.argv.includes("--check");

  if (check) {
    const actual = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, "utf8") : "";
    if (actual !== expected) {
      console.error(
        "Scene coverage matrix is stale. Run npm run assurance:scene-coverage and commit content/assurance/scene-coverage.json.",
      );
      process.exitCode = 1;
      return;
    }
    const report = JSON.parse(actual) as SceneCoverageReport;
    console.log(
      `Scene coverage: ${report.summary.covered}/${report.summary.senses} senses across ${report.summary.scenes} scenes; threshold UNSET.`,
    );
    return;
  }

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, expected);
  const report = JSON.parse(expected) as SceneCoverageReport;
  console.log(
    `Wrote scene coverage: ${report.summary.covered}/${report.summary.senses} senses across ${report.summary.scenes} scenes; threshold UNSET.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
