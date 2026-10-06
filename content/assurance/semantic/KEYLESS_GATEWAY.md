# Keyless semantic judge gateway

Verified: 2026-10-06

Vajefy's semantic judge path no longer requires provider API keys.

## Architecture

```text
GitHub Actions (workflow_dispatch, or the calibration schedule)
        |
        | GitHub OIDC (short-lived signed identity)
        v
https://vajefy.mostifa2273.workers.dev/api/internal/semantic-judge
        |
        | Cloudflare Workers AI binding (env.AI)
        v
an allowlisted free-allocation candidate for the selected judge role
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
- the event: `workflow_dispatch`; `schedule` only for
  `semantic-calibrate.yml`; `push` only for the smoke test's status check,
  which runs no inference;
- exact allowed workflow path;
- expiration / issued-at / not-before times.

The workflow names the role's active judge, and the Worker runs it only if
it is on that role's allowlist. A workflow cannot send an arbitrary model id.

## Keyless role map (historical)

The active judges and every role's candidates now live in
`keyless-provider-presets.json`. The calibration automation chooses them
(`AUTOMATION.md`). The map below was the first selection.

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
- scheduled inference only from `semantic-calibrate.yml`, only while
  `automation.json` enables it, and only within the free daily allocation;
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


## English JSON Mode compatibility correction — 2026-10-06

English now uses:

`@cf/meta/llama-3.3-70b-instruct-fp8-fast`

instead of GPT-OSS 120B.

The change was driven by live calibration evidence, not a generic benchmark:
GPT-OSS consumed its entire 900-token completion allowance on the first clean
case without producing canonical structured output. Cloudflare's current JSON
Mode support list explicitly includes Llama 3.3 70B FP8 Fast and does not list
GPT-OSS.

The semantic JSON transport was also bounded to keep structured output compact:

- exact criteria count remains unchanged;
- evidence: 1–3 paths, each <=120 characters;
- reasonCode: <=96 characters;
- English max output: 500 tokens.

Frozen calibration thresholds and gold labels are unchanged.

Regenerated full-campaign upper bound:

- total: **8,070 Neurons**;
- free daily allocation: 10,000;
- free reserve: **1,930**;
- Vajefy safety ceiling: 8,500;
- safety reserve: **430**.


## Candidate registry and unattended calibration — 2026-10-06

The owner asked for calibration without a person in the loop, at the highest
quality the free allocation allows. Each role now has pre-registered free
candidates, strongest first. They were registered before any of them produced
results.

| Role | Candidates in order |
|---|---|
| English | Llama 3.3 70B (rejected), Nemotron 3 120B, Mistral Small 3.1, Llama 4 Scout |
| Persian | Kimi K2.5, GLM 4.7 Flash, Qwen 3.8 27B, Mistral Small 3.1, Nemotron 3 120B |
| Pedagogical | Nemotron 3 120B, Gemma 4 26B, Qwen 3.8 27B, Llama 4 Scout, Mistral Small 3.1 |
| Adversarial | Nemotron 3 120B, Qwen3 30B, GPT-OSS 120B, Mistral Small 3.1, Llama 4 Scout |

Each candidate's token limit is set so that its full v1 campaign fits the
8,500-Neuron ceiling. Kimi K2.5, at 8,202 Neurons, is the largest. GPT-OSS 120B
stays rejected for English, and that rejection does not carry over to the
adversarial role, which has its own prompt.

The calibration workflow now runs on a schedule. `AUTOMATION.md` describes how
it chooses a judge, keeps to the free allocation and handles failures. The
Worker also returns the token usage Workers AI reports, so each attempt's
measured cost is logged next to its upper-bound charge.
