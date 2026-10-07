import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { audioSourceScopeProjection } from "../src/lib/learn/audio-source-scope";

export type AudioSourceHashes = {
  curriculumSha256: string;
  enhancedSha256: string;
  audioManifestSha256: string;
  audioReportSha256: string;
};

function read(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
}

function hashJson(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildAudioSourceHashes(root = process.cwd()): AudioSourceHashes {
  const projection = audioSourceScopeProjection(
    read(path.join(root, "content", "curriculum", "A1.json")) as Parameters<typeof audioSourceScopeProjection>[0],
    read(path.join(root, "content", "compiled", "enhanced.json")) as Parameters<typeof audioSourceScopeProjection>[1],
    read(path.join(root, "content", "pilot", "audio-manifest.json")) as Parameters<typeof audioSourceScopeProjection>[2],
    read(path.join(root, "content", "pilot", "audio-report.json")) as Parameters<typeof audioSourceScopeProjection>[3],
  );
  return {
    curriculumSha256: hashJson(projection.curriculum),
    enhancedSha256: hashJson(projection.enhanced),
    audioManifestSha256: hashJson(projection.audioManifest),
    audioReportSha256: hashJson(projection.audioReport),
  };
}

function main(): void {
  const hashes = buildAudioSourceHashes();
  const json = JSON.stringify(hashes, null, 2) + "\n";
  const at = process.argv.indexOf("--output");
  if (at >= 0) {
    const output = process.argv[at + 1];
    if (!output) throw new Error("--output requires a path");
    fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
    fs.writeFileSync(path.resolve(output), json);
    console.log("Wrote scoped audio source hashes to " + output);
  } else {
    process.stdout.write(json);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
