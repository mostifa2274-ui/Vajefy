import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const clientDir = path.join(root, "dist", "client");
const assetsDir = path.join(clientDir, "assets");
const swPath = path.join(clientDir, "sw.js");
const assetMarker = "/* __VAJEFY_BUILD_ASSETS__ */ []";
const versionMarker = '/* __VAJEFY_BUILD_VERSION__ */ "dev"';

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

if (!fs.existsSync(swPath)) {
  throw new Error(`Missing built service worker: ${swPath}`);
}
if (!fs.existsSync(assetsDir)) {
  throw new Error(`Missing Vite client assets directory: ${assetsDir}`);
}

const assets = walk(assetsDir)
  .map((file) => "/" + path.relative(clientDir, file).split(path.sep).join("/"))
  .sort();

if (!assets.length) {
  throw new Error("Vite produced no client assets to precache.");
}

// Fingerprint every deployed client/public file except sw.js itself. This makes
// the service-worker source change on data-only releases too, so installed PWAs
// activate a new cache instead of serving stale vocabulary indefinitely.
const fingerprintFiles = walk(clientDir)
  .filter((file) => file !== swPath)
  .sort((a, b) => path.relative(clientDir, a).localeCompare(path.relative(clientDir, b)));

const hash = createHash("sha256");
for (const file of fingerprintFiles) {
  const relative = path.relative(clientDir, file).split(path.sep).join("/");
  hash.update(relative);
  hash.update("\0");
  hash.update(fs.readFileSync(file));
  hash.update("\0");
}
const buildVersion = hash.digest("hex").slice(0, 16);

const original = fs.readFileSync(swPath, "utf8");
if (!original.includes(assetMarker)) {
  throw new Error("Service-worker build asset marker is missing.");
}
if (!original.includes(versionMarker)) {
  throw new Error("Service-worker build version marker is missing.");
}

const output = original
  .replace(assetMarker, `/* __VAJEFY_BUILD_ASSETS__ */ ${JSON.stringify(assets)}`)
  .replace(versionMarker, `/* __VAJEFY_BUILD_VERSION__ */ "${buildVersion}"`);

fs.writeFileSync(swPath, output);

console.log(
  `Injected ${assets.length} generated client assets and cache version ${buildVersion} into dist/client/sw.js.`,
);
