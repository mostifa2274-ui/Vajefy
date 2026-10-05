/**
 * After a deployment, check that the live site still works
 * (docs/OPERATIONS.md):
 *
 *   node scripts/smoke.mjs https://vajefy.example.workers.dev
 *   node scripts/smoke.mjs <url> --expect-channel released --expect-revision 1a2b3c4d5e6f
 *
 * Every screen renders with its security headers, the learning data and a
 * pronunciation clip load, the service worker and manifest are served, and the
 * optional services answer their status checks. The deployed revision and
 * content channel are reported, and checked when expected values are given
 * (also as SMOKE_EXPECT_CHANNEL and SMOKE_EXPECT_REVISION). Exits non-zero on
 * any failure.
 */

function option(flag) {
  const at = process.argv.indexOf(flag);
  return at >= 0 ? process.argv[at + 1] : undefined;
}
const expectChannel = option("--expect-channel") ?? process.env.SMOKE_EXPECT_CHANNEL ?? "";
const expectRevision = option("--expect-revision") ?? process.env.SMOKE_EXPECT_REVISION ?? "";
const base = (process.argv[2]?.startsWith("--") ? "" : (process.argv[2] ?? "")) || process.env.SITE_URL || "";
const site = base.replace(/\/+$/, "");
if (!/^https?:\/\//.test(site)) {
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
  const response = await fetch(site + path, { redirect: "follow", headers: { "Accept-Encoding": "gzip, br" } });
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

let catalogue = null;
let pack = null;
for (const file of ["meta.json", "enhanced-order.json", "enhanced/index.json", "enhanced/audio-pack.json", "lex-a1.json", "usefulness.json"]) {
  await check(`data ${file}`, async () => {
    const data = await (await get(`/data/${file}`, "json")).json();
    if (file === "enhanced/index.json") catalogue = data;
    if (file === "enhanced/audio-pack.json") pack = data;
    if (file === "meta.json" && !Array.isArray(data.levels)) throw new Error("no levels");
  });
}

await check("enhanced content part", async () => {
  const file = catalogue?.parts?.[0];
  if (!file) throw new Error("the index lists no parts");
  const part = await (await get(`/data/${file}`, "json")).json();
  if (!Array.isArray(part.entries) || !part.entries.length) throw new Error("the part holds no entries");
});

await check("pronunciation clip", async () => {
  const file = pack?.gb?.files?.[0];
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

let deployed = null;
await check("deployed revision and channel", async () => {
  deployed = await (await get("/api/version", "json")).json();
  if (typeof deployed.revision !== "string" || !deployed.revision) throw new Error("no revision");
  if (!["draft", "released", "none"].includes(deployed.channel)) throw new Error(`unknown channel ${deployed.channel}`);
  if (expectChannel && deployed.channel !== expectChannel) throw new Error(`channel ${deployed.channel}, expected ${expectChannel}`);
  if (expectRevision && !expectRevision.startsWith(deployed.revision) && !deployed.revision.startsWith(expectRevision)) {
    throw new Error(`revision ${deployed.revision}, expected ${expectRevision}`);
  }
});

for (const service of ["coach", "sync"]) {
  await check(`${service} status`, async () => {
    const status = await (await get(`/api/${service}/status`, "json")).json();
    if (typeof status.enabled !== "boolean") throw new Error("no enabled flag");
  });
}

console.log(`Smoke checks against ${site}: ${passed.length} passed, ${failures.length} failed.`);
if (deployed) console.log(`Deployed revision ${deployed.revision}, content channel ${deployed.channel}.`);
for (const failure of failures) console.error(`  ✗ ${failure}`);
process.exit(failures.length ? 1 : 0);
