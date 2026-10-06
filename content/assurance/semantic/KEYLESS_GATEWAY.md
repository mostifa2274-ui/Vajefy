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
| Adversarial | Qwen | `@cf/qwen/qwen3.8-27b` |

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


## Free-allocation budget gate — 2026-10-06

Cloudflare Workers AI currently provides 10,000 Neurons/day at no charge on
Workers Free. Vajefy uses a stricter calibration ceiling of **8,500 Neurons/day**
to preserve safety reserve.

The current machine-readable pricing source is:

`content/assurance/semantic/workers-ai-neuron-rates.json`

The deterministic frozen-calibration budget is:

`content/assurance/semantic/calibration/v1/neuron-budget.json`

Current full calibration campaign:

- 84 requests total;
- English: 3,936 Neurons upper bound;
- Persian: 1,014;
- pedagogical: 1,398;
- adversarial: 1,440;
- total: **7,788 Neurons upper bound**;
- free-allocation reserve: **2,212 Neurons**;
- safety-ceiling reserve: **712 Neurons**.

The input bound intentionally treats every UTF-8 byte as up to one token and
adds another 512 protocol tokens/request. Output is budgeted at each role's
configured maximum, not expected average output.

To fit the free allocation with reserve, the adversarial candidate is:

`@cf/qwen/qwen3-30b-a3b-fp8`

rather than the much higher-Neuron Qwen 3.8 27B candidate.

Calibration execution runs:

```sh
npm run assurance:semantic:budget:current
```

before OIDC preflight or inference. It fails if:

- the committed budget is stale;
- the campaign exceeds the 8,500-Neuron safety ceiling;
- a selected model is marked paid-billing-required;
- pricing verification is older than 30 days.

Normal CI also verifies the committed budget snapshot for drift.
