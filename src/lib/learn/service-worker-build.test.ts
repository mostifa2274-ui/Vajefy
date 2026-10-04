import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const injector = path.resolve("scripts/inject-sw-assets.mjs");
const template = readFileSync("public/sw.js", "utf8");

function injectVersion(worker: string) {
  const root = mkdtempSync(path.join(tmpdir(), "vajefy-sw-"));
  try {
    const client = path.join(root, "dist", "client");
    mkdirSync(path.join(client, "assets"), { recursive: true });
    mkdirSync(path.join(client, "data", "enhanced"), { recursive: true });
    writeFileSync(path.join(client, "assets", "app.js"), "export const app = true;\n");
    writeFileSync(path.join(client, "data", "enhanced", "part-000.json"), "{}\n");
    writeFileSync(path.join(client, "sw.js"), worker);
    const result = spawnSync(process.execPath, [injector], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const output = readFileSync(path.join(client, "sw.js"), "utf8");
    const version = output.match(/\/\* __VAJEFY_BUILD_VERSION__ \*\/ "([^"]+)"/)?.[1];
    assert.ok(version, "the injector writes a release version");
    return version;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("a worker-only change receives a different offline release identity", () => {
  const before = injectVersion(template);
  const after = injectVersion(template.replace("const CACHE_PREFIX", "// worker-only behavior change\nconst CACHE_PREFIX"));

  assert.notEqual(after, before);
});
