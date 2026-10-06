import assert from "node:assert/strict";
import test from "node:test";
import { verifyGitHubOidcToken } from "./github-oidc";

function base64Url(input: Uint8Array | string): string {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function fixtureToken(
  claims: Record<string, unknown>,
  mutateSignature = false,
) {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const publicJwk = (await crypto.subtle.exportKey(
    "jwk",
    pair.publicKey,
  )) as JsonWebKey & { kid?: string };
  publicJwk.kid = "fixture-key";

  const header = base64Url(
    JSON.stringify({ alg: "RS256", typ: "JWT", kid: "fixture-key" }),
  );
  const payload = base64Url(JSON.stringify(claims));
  const input = `${header}.${payload}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      pair.privateKey,
      new TextEncoder().encode(input),
    ),
  );
  if (mutateSignature) signature[0] = signature[0]! ^ 0xff;

  return {
    token: `${input}.${base64Url(signature)}`,
    jwks: { keys: [publicJwk] },
  };
}

const now = 1_800_000_000;
const workflow =
  "mostifa2274-ui/Vajefy/.github/workflows/semantic-calibrate.yml@refs/heads/main";

function claims(overrides: Record<string, unknown> = {}) {
  return {
    iss: "https://token.actions.githubusercontent.com",
    aud: "vajefy-semantic-gateway",
    sub: "repo:mostifa2274-ui/Vajefy:ref:refs/heads/main",
    exp: now + 300,
    iat: now,
    nbf: now - 5,
    repository: "mostifa2274-ui/Vajefy",
    ref: "refs/heads/main",
    event_name: "workflow_dispatch",
    workflow_ref: workflow,
    run_id: "12345",
    jti: "fixture-jti",
    ...overrides,
  };
}

const expected = {
  audience: "vajefy-semantic-gateway",
  repository: "mostifa2274-ui/Vajefy",
  ref: "refs/heads/main",
  workflows: [workflow],
  nowSeconds: now,
};

test("accepts a correctly signed GitHub Actions OIDC token", async () => {
  const fixture = await fixtureToken(claims());
  const verified = await verifyGitHubOidcToken(
    fixture.token,
    fixture.jwks,
    expected,
  );
  assert.equal(verified.repository, "mostifa2274-ui/Vajefy");
  assert.equal(verified.workflow_ref, workflow);
});

test("rejects a tampered OIDC signature", async () => {
  const fixture = await fixtureToken(claims(), true);
  await assert.rejects(
    verifyGitHubOidcToken(fixture.token, fixture.jwks, expected),
    /oidc-signature/,
  );
});

test("rejects an unexpected repository", async () => {
  const fixture = await fixtureToken(claims({ repository: "evil/fork" }));
  await assert.rejects(
    verifyGitHubOidcToken(fixture.token, fixture.jwks, expected),
    /oidc-repository/,
  );
});

test("rejects an unexpected workflow", async () => {
  const fixture = await fixtureToken(
    claims({
      workflow_ref:
        "mostifa2274-ui/Vajefy/.github/workflows/other.yml@refs/heads/main",
    }),
  );
  await assert.rejects(
    verifyGitHubOidcToken(fixture.token, fixture.jwks, expected),
    /oidc-workflow/,
  );
});

test("rejects an expired OIDC token", async () => {
  const fixture = await fixtureToken(claims({ exp: now - 31 }));
  await assert.rejects(
    verifyGitHubOidcToken(fixture.token, fixture.jwks, expected),
    /oidc-expired/,
  );
});

test("rejects a token for a non-main ref", async () => {
  const fixture = await fixtureToken(claims({ ref: "refs/heads/feature" }));
  await assert.rejects(
    verifyGitHubOidcToken(fixture.token, fixture.jwks, expected),
    /oidc-ref/,
  );
});
