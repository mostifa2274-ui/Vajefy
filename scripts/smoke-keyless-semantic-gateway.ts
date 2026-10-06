import fs from "node:fs";
import path from "node:path";
import { requestGitHubActionsOidcToken } from "./github-actions-oidc";

const ROOT = process.cwd();
const PRESETS = path.join(
  ROOT,
  "content",
  "assurance",
  "semantic",
  "keyless-provider-presets.json",
);

type Role = "english" | "persian" | "pedagogical" | "adversarial";
type Preset = {
  provider: string;
  modelFamily: string;
  model: string;
  modelVersion: string;
  maxTokens: number;
};
type Presets = {
  schemaVersion: 1;
  transport: "cloudflare-workers-ai-binding";
  gatewayOrigin: string;
  audience: string;
  roles: Record<Role, Preset>;
};

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const presets = JSON.parse(fs.readFileSync(PRESETS, "utf8")) as Presets;
const sha = process.env.GITHUB_SHA;
if (!sha || !/^[a-f0-9]{40}$/.test(sha)) {
  fail("GITHUB_SHA must be the exact 40-character main commit.");
}
const expectedRevision = sha.slice(0, 12);
const origin = presets.gatewayOrigin.replace(/\/$/, "");

let deployed = false;
let lastRevision = "unavailable";
for (let attempt = 1; attempt <= 40; attempt += 1) {
  try {
    const response = await fetch(`${origin}/api/version`, {
      headers: { "cache-control": "no-cache" },
    });
    if (response.ok) {
      const data = (await response.json()) as { revision?: string };
      lastRevision = data.revision ?? "missing";
      if (lastRevision === expectedRevision) {
        deployed = true;
        console.log(
          `Production revision ready after ${attempt} check(s): ${lastRevision}.`,
        );
        break;
      }
    } else {
      lastRevision = `HTTP-${response.status}`;
    }
  } catch (error) {
    lastRevision = error instanceof Error ? error.message : String(error);
  }

  console.log(
    `Production revision not ready [${attempt}/40]: expected ${expectedRevision}, observed ${lastRevision}.`,
  );
  if (attempt < 40) await sleep(15_000);
}

if (!deployed) {
  fail(
    `Production did not reach exact revision ${expectedRevision}; last observed ${lastRevision}.`,
  );
}

const token = await requestGitHubActionsOidcToken(presets.audience);
const response = await fetch(`${origin}/api/internal/semantic-judge`, {
  method: "GET",
  headers: {
    authorization: `Bearer ${token}`,
    "cache-control": "no-cache",
  },
});
if (!response.ok) {
  fail(
    `Keyless semantic gateway smoke failed: HTTP ${response.status} ${await response.text()}`,
  );
}

const data = (await response.json()) as {
  ok?: boolean;
  transport?: string;
  roles?: Record<Role, Preset>;
};
if (data.ok !== true || data.transport !== presets.transport) {
  fail("Keyless gateway returned an unexpected transport contract.");
}

for (const role of Object.keys(presets.roles) as Role[]) {
  const expected = presets.roles[role];
  const actual = data.roles?.[role];
  if (
    !actual ||
    actual.provider !== expected.provider ||
    actual.modelFamily !== expected.modelFamily ||
    actual.model !== expected.model ||
    actual.modelVersion !== expected.modelVersion ||
    actual.maxTokens !== expected.maxTokens
  ) {
    fail(`Keyless gateway model contract mismatch for ${role}.`);
  }
}

console.log(
  `Keyless semantic production smoke: PASS at revision ${expectedRevision}; OIDC verified; no inference executed.`,
);
