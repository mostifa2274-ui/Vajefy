const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_OIDC_JWKS = "https://token.actions.githubusercontent.com/.well-known/jwks";

export type GitHubOidcClaims = {
  iss: string;
  aud: string | string[];
  sub?: string;
  exp: number;
  iat: number;
  nbf?: number;
  repository: string;
  ref: string;
  event_name: string;
  workflow_ref: string;
  run_id?: string;
  jti?: string;
};

type Jwk = JsonWebKey & { kid?: string; alg?: string; use?: string };
type Jwks = { keys: Jwk[] };

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function decodeJson<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
}

function audienceIncludes(actual: string | string[], expected: string): boolean {
  return Array.isArray(actual) ? actual.includes(expected) : actual === expected;
}

export async function verifyGitHubOidcToken(
  token: string,
  jwks: Jwks,
  expected: {
    audience: string;
    repository: string;
    ref: string;
    workflows: string[];
    nowSeconds?: number;
  },
): Promise<GitHubOidcClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("oidc-format");

  const header = decodeJson<{ alg?: string; kid?: string; typ?: string }>(parts[0]!);
  const claims = decodeJson<GitHubOidcClaims>(parts[1]!);
  if (header.alg !== "RS256" || !header.kid) throw new Error("oidc-header");

  const jwk = jwks.keys.find((candidate) => candidate.kid === header.kid);
  if (!jwk) throw new Error("oidc-kid");

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = decodeBase64Url(parts[2]!);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signature,
    signed,
  );
  if (!valid) throw new Error("oidc-signature");

  const now = expected.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (claims.iss !== GITHUB_OIDC_ISSUER) throw new Error("oidc-issuer");
  if (!audienceIncludes(claims.aud, expected.audience)) throw new Error("oidc-audience");
  if (claims.repository !== expected.repository) throw new Error("oidc-repository");
  if (claims.ref !== expected.ref) throw new Error("oidc-ref");
  if (claims.event_name !== "workflow_dispatch") throw new Error("oidc-event");
  if (!expected.workflows.includes(claims.workflow_ref)) throw new Error("oidc-workflow");
  if (!Number.isFinite(claims.exp) || claims.exp < now - 30) throw new Error("oidc-expired");
  if (!Number.isFinite(claims.iat) || claims.iat > now + 60 || claims.iat < now - 900) {
    throw new Error("oidc-issued-at");
  }
  if (claims.nbf != null && claims.nbf > now + 30) throw new Error("oidc-not-before");

  return claims;
}

export async function verifyGitHubActionsRequest(
  request: Request,
  expected: {
    audience: string;
    repository: string;
    ref: string;
    workflows: string[];
  },
): Promise<GitHubOidcClaims> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) throw new Error("oidc-missing");
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) throw new Error("oidc-missing");

  const response = await fetch(GITHUB_OIDC_JWKS, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`oidc-jwks-http-${response.status}`);
  const jwks = (await response.json()) as Jwks;
  if (!Array.isArray(jwks.keys) || !jwks.keys.length) throw new Error("oidc-jwks-empty");

  return verifyGitHubOidcToken(token, jwks, expected);
}
