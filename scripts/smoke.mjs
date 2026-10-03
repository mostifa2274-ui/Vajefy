/**
 * After a deployment, check that the live site still works
 * (docs/OPERATIONS.md):
 *
 *   node scripts/smoke.mjs https://vajefy.example.workers.dev
 *
 * Every screen renders with its security headers, the learning data and a
 * pronunciation clip load, the service worker and manifest are served, and the
 * optional services answer their status checks. Exits non-zero on any failure.
 */

const base = (process.argv[2] ?? process.env.SITE_URL ?? "").replace(/\/+$/, "");
if (!/^https?:\/\//.test(base)) {
  console.error("Usage: node scripts/smoke.mjs <site URL>");
  process.exit(2);
}

const failures = [];
const passed = [];

async function check(name, run) {
  try {
    await run();
    passed.push(name);
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function get(path, expectType) {
  const response = await fetch(base + path, { redirect: "follow", headers: { "Accept-Encoding": "gzip, br" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get("content-type") ?? "";
  if (expectType && !type.includes(expectType)) throw new Error(`content-type ${type}`);
  return response;
}

for (const path of ["/", "/learn", "/study", "/drill", "/lexicon", "/library", "/progress"]) {
  await check(`page ${path}`, async () => {
    const response = await get(path, "text/html");
    const html = await response.text();
    if (!html.includes("Vajefy")) throw new Error("the page does not name the app");
    const policy = response.headers.get("content-security-policy") ?? "";
    if (!/script-src 'self' 'nonce-[0-9a-f]{32}'/.test(policy)) throw new Error("missing the script policy with a nonce");
    if (response.headers.get("x-frame-options") !== "DENY") throw new Error("missing X-Frame-Options");
    if (!(response.headers.get("permissions-policy") ?? "").includes("microphone=(self)")) throw new Error("unexpected Permissions-Policy");
  });
}

let pilot = null;
for (const file of ["meta.json", "pilot-order.json", "pilot-a1.json", "lex-a1.json", "usefulness.json"]) {
  await check(`data ${file}`, async () => {
    const data = await (await get(`/data/${file}`, "json")).json();
    if (file === "pilot-a1.json") pilot = data;
    if (file === "meta.json" && !Array.isArray(data.levels)) throw new Error("no levels");
  });
}

await check("pronunciation clip", async () => {
  const file = pilot?.audioPack?.gb?.files?.[0];
  if (!file) throw new Error("the pilot lists no clips");
  const response = await get(`/audio/${file}`, "audio/mpeg");
  if ((await response.arrayBuffer()).byteLength < 1000) throw new Error("the clip is empty");
});

await check("service worker", async () => {
  const script = await (await get("/sw.js", "javascript")).text();
  if (!script.includes("CACHE")) throw new Error("unexpected service worker");
});

await check("manifest", async () => {
  const manifest = await (await get("/manifest.json", "json")).json();
  if (manifest.name !== "Vajefy") throw new Error(`name ${manifest.name}`);
});

for (const service of ["coach", "sync"]) {
  await check(`${service} status`, async () => {
    const status = await (await get(`/api/${service}/status`, "json")).json();
    if (typeof status.enabled !== "boolean") throw new Error("no enabled flag");
  });
}

console.log(`Smoke checks against ${base}: ${passed.length} passed, ${failures.length} failed.`);
for (const failure of failures) console.error(`  ✗ ${failure}`);
process.exit(failures.length ? 1 : 0);
