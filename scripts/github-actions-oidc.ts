export async function requestGitHubActionsOidcToken(
  audience: string,
): Promise<string> {
  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!requestUrl || !requestToken) {
    throw new Error(
      "GitHub Actions OIDC environment is unavailable; workflow requires id-token: write.",
    );
  }

  const separator = requestUrl.includes("?") ? "&" : "?";
  const response = await fetch(
    `${requestUrl}${separator}audience=${encodeURIComponent(audience)}`,
    {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${requestToken}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(
      `GitHub Actions OIDC token request failed: HTTP ${response.status}`,
    );
  }

  const data = (await response.json()) as { value?: string };
  if (!data.value) {
    throw new Error("GitHub Actions OIDC provider returned no token.");
  }
  return data.value;
}
