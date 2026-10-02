import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const isWorkersBuild = process.env.WORKERS_CI === "1";

if (!isWorkersBuild) {
  console.log("Cloudflare bootstrap skipped outside Workers Builds.");
  process.exit(0);
}

const deployPointer = path.join(process.cwd(), ".wrangler", "deploy", "config.json");
const builtWorker = path.join(process.cwd(), "dist", "server");

if (fs.existsSync(deployPointer) && fs.existsSync(builtWorker)) {
  console.log("Cloudflare build output already exists; deploy bootstrap skipped.");
  process.exit(0);
}

console.log("Workers Builds detected; generating Cloudflare Vite deployment output before deploy.");

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npm, ["run", "build"], {
  stdio: "inherit",
  env: { ...process.env, VAJEFY_WORKERS_BOOTSTRAP: "1" },
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

if (!fs.existsSync(deployPointer)) {
  throw new Error("Vite build completed without .wrangler/deploy/config.json; Wrangler cannot discover the generated deployment config.");
}

console.log("Cloudflare deploy bootstrap ready: .wrangler/deploy/config.json exists.");
