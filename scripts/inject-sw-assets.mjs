import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const clientDir = path.join(root, "dist", "client");
const assetsDir = path.join(clientDir, "assets");
const swPath = path.join(clientDir, "sw.js");
const marker = "/* __VAJEFY_BUILD_ASSETS__ */ []";

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

const original = fs.readFileSync(swPath, "utf8");
if (!original.includes(marker)) {
  throw new Error("Service-worker build asset marker is missing.");
}

const output = original.replace(
  marker,
  `/* __VAJEFY_BUILD_ASSETS__ */ ${JSON.stringify(assets)}`,
);
fs.writeFileSync(swPath, output);

console.log(`Injected ${assets.length} generated client assets into dist/client/sw.js.`);
