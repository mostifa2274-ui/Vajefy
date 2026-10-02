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

function cacheVersion(source) {
  const match = source.match(/__VAJEFY_BUILD_VERSION__ \*\/ "([0-9a-f]{16})"/);
  if (!match) throw new Error("Built service worker is missing its injected cache fingerprint.");
  return match[1];
}

const builtServiceWorker = fs.readFileSync(sw, "utf8");
if (/__VAJEFY_BUILD_ASSETS__ \*\/ \[\]/.test(builtServiceWorker)) {
  throw new Error("Built service worker still contains an empty build asset manifest.");
}
if (builtServiceWorker.includes('/* __VAJEFY_BUILD_VERSION__ */ "dev"')) {
  throw new Error("Built service worker still contains the development cache version.");
}
if (!/vajefy-offline-/.test(builtServiceWorker)) {
  throw new Error("Built service worker is missing its versioned offline cache.");
}

const originalVersion = cacheVersion(builtServiceWorker);
const dataFile = path.join(dist, "client", "data", "meta.json");
const sourceSw = path.join(root, "public", "sw.js");
const originalData = fs.readFileSync(dataFile);

try {
  // Change only deployed data, not application code. The cache fingerprint must
  // change so installed learners cannot remain pinned to stale vocabulary.
  fs.writeFileSync(dataFile, Buffer.concat([originalData, Buffer.from("\n ")]));
  fs.copyFileSync(sourceSw, sw);
  run(node, ["scripts/inject-sw-assets.mjs"]);
  const changedVersion = cacheVersion(fs.readFileSync(sw, "utf8"));
  if (changedVersion === originalVersion) {
    throw new Error("A data-only change did not change the service-worker cache fingerprint.");
  }
} finally {
  fs.writeFileSync(dataFile, originalData);
  fs.copyFileSync(sourceSw, sw);
  run(node, ["scripts/inject-sw-assets.mjs"]);
}

const restoredVersion = cacheVersion(fs.readFileSync(sw, "utf8"));
if (restoredVersion !== originalVersion) {
  throw new Error(`Restored build fingerprint changed: ${originalVersion} -> ${restoredVersion}`);
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
run(npx, ["wrangler", "deploy", "--dry-run", "--outdir", dryRunDir]);

console.log("Workers Builds contract OK: deploy-only Wrangler command can use generated Vite output.");
