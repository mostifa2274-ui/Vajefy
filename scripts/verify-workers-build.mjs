import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const deployDir = path.join(root, ".wrangler", "deploy");
const dryRunDir = path.join(root, ".wrangler", "dry-run");

for (const dir of [dist, deployDir, dryRunDir]) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const node = process.execPath;
run(node, ["scripts/cloudflare-ci-bootstrap.mjs"], { ...process.env, WORKERS_CI: "1" });

const deployPointer = path.join(deployDir, "config.json");
const sw = path.join(dist, "client", "sw.js");
if (!fs.existsSync(deployPointer)) throw new Error("Workers bootstrap did not generate the Wrangler deploy pointer.");
if (!fs.existsSync(sw)) throw new Error("Workers bootstrap did not produce the client service worker.");

const builtServiceWorker = fs.readFileSync(sw, "utf8");
if (/__VAJEFY_BUILD_ASSETS__ \*\/ \[\]/.test(builtServiceWorker)) {
  throw new Error("Built service worker still contains an empty build asset manifest.");
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
run(npx, ["wrangler", "deploy", "--dry-run", "--outdir", dryRunDir]);

console.log("Workers Builds contract OK: deploy-only Wrangler command can use generated Vite output.");
