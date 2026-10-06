# Keyless semantic judge gateway

Verified: 2026-10-06

Vajefy's semantic judge path no longer requires provider API keys.

## Architecture

```text
GitHub Actions workflow_dispatch
        |
        | GitHub OIDC (short-lived signed identity)
        v
https://vajefy.mostifa2273.workers.dev/api/internal/semantic-judge
        |
        | Cloudflare Workers AI binding (env.AI)
        v
fixed free-allocation model for the selected judge role
```

There are no Groq, Gemini, OpenRouter or Cloudflare AI API tokens in the
authoritative path.

GitHub Actions requests a fresh OIDC token from GitHub's built-in identity
provider for each judge call. The Worker verifies the token signature against
GitHub's JWKS and checks:

- issuer;
- audience;
- repository;
- `refs/heads/main`;
- `workflow_dispatch`;
- exact allowed workflow path;
- expiration / issued-at / not-before times.

The Worker chooses the model. A workflow cannot send an arbitrary model id.

## Fixed keyless role map

| Role | Workers AI model family | Model |
|---|---|---|
| English | OpenAI GPT-OSS | `@cf/openai/gpt-oss-120b` |
| Persian | Zhipu GLM | `@cf/zai-org/glm-4.7-flash` |
| Pedagogical | Google Gemma | `@cf/google/gemma-4-26b-a4b-it` |
| Adversarial | Qwen | `@cf/qwen/qwen3-30b-a3b-fp8` |

All four are Cloudflare-hosted, but they are four distinct model families.

This intentionally trades **provider-serving independence** for a zero-key
identity plane. Model-family independence remains. The frozen Vajefy calibration
gate remains mandatory and decides whether any model is actually qualified.

## Zero-cost boundary

Workers AI provides a daily free allocation. The repository caps semantic judge
responses at 1,200 tokens per request and rejects model IDs currently documented
as requiring paid billing.

If the free allocation is exhausted, inference must fail. The workflow must not
silently upgrade to paid billing or a paid-only model.

## Production origin

The production Worker origin was verified from GitHub Actions on 2026-10-06:

`https://vajefy.mostifa2273.workers.dev`

At verification, `/api/version` returned the exact production revision being
tested.

The origin is committed in
`content/assurance/semantic/keyless-provider-presets.json`; no `SITE_URL`
repository variable is required for semantic judging.

## Security properties

- no long-lived semantic API key;
- no provider credential in GitHub;
- no model credential in Worker code;
- fresh OIDC identity per inference call;
- exact repository/workflow/main-branch trust policy;
- fixed server-side model allowlist;
- no arbitrary public inference endpoint;
- no inference on push or pull request;
- calibration still requires explicit workflow dispatch;
- Unit 1 still requires a current qualification record.

## Authoritative commands

Offline CI contract:

```sh
npm run assurance:semantic:keyless:check
```

Online OIDC + Worker binding preflight (inside an authorized workflow):

```sh
npm run assurance:semantic:keyless:preflight -- --role english
```

Judge execution uses the existing runner with:

```sh
SEMANTIC_JUDGE_TRANSPORT=keyless npm run assurance:semantic:judge -- ...
```

The workflows set the transport automatically.


## Free Neuron budget — 2026-10-06

The authoritative calibration path now has a fail-closed machine-readable budget
at `content/assurance/semantic/keyless-neuron-budget.json`.

Cloudflare currently provides 10,000 free Workers AI Neurons/day. Vajefy sets a
stricter 9,000-Neuron maximum planned calibration ceiling and reserves at least
1,000 Neurons of headroom.

The budget checker derives usage from the frozen calibration packets, current
prompt bytes, three required repeats, current model output caps and the verified
per-model Neuron rates. UTF-8 bytes are treated as a conservative input-token
upper bound, plus 512 framing tokens per request.

The adversarial candidate was changed from Qwen 3.8 27B to Qwen3 30B A3B
because the former made the full calibration exceed the free allocation under
the conservative maximum-output calculation. The Qwen3 30B A3B candidate keeps
Qwen reasoning, instruction-following and multilingual capability while
dramatically lowering Neuron cost.

Calibration must fail before inference if the calculated maximum exceeds the
configured zero-cost ceiling.
