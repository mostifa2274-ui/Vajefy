# Semantic judge endpoint resolution

Recorded: 2026-10-06

This file records the endpoint investigation so future work does not repeat it.

## Current conclusion

The semantic assurance infrastructure is ready and four viable **zero-cost**
provider/model paths have now been verified. Paid inference is no longer a
design dependency.

Real judge evidence is blocked only on creating/configuring the free API
credentials and, for Cloudflare, the account id.

No model inference was launched during this investigation.

## Verified zero-cost judge allocation

The machine-readable source of truth is:

`content/assurance/semantic/free-provider-presets.json`

Recommended role allocation as verified on 2026-10-06:

| Role | Provider | Model | Free constraint |
|---|---|---|---|
| English | Groq Free Plan | `openai/gpt-oss-120b` | Free-plan limits currently list 30 RPM, 1,000 RPD and 200,000 TPD |
| Persian | Google Gemini Developer API Free Tier | `gemini-3.5-flash-lite` | Input/output are free of charge on the Free Tier; model is optimized for translation/high-volume tasks |
| Pedagogical | OpenRouter Free | `google/gemma-4-31b-it:free` | Named model is $0/M input and output; Free plan currently permits 50 requests/day |
| Adversarial | Cloudflare Workers AI Free | `@cf/zai-org/glm-4.7-flash` | Workers Free includes 10,000 Neurons/day and GLM-4.7-Flash remains allowed on the Free plan |

Official references:

- Groq free limits: https://console.groq.com/docs/rate-limits
- Groq billing FAQ: https://console.groq.com/docs/billing-faqs
- Gemini pricing: https://ai.google.dev/gemini-api/docs/pricing
- Gemini OpenAI compatibility: https://ai.google.dev/gemini-api/docs/openai
- OpenRouter pricing: https://openrouter.ai/pricing
- OpenRouter Gemma 4 31B free: https://openrouter.ai/google/gemma-4-31b-it:free
- Cloudflare Workers AI pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
- Cloudflare OpenAI compatibility: https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/
- Cloudflare GLM-4.7-Flash: https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/

These are free tiers/allocations, not permanent contractual guarantees. Before
a future large rerun, re-check provider availability/pricing and update the
preset verification date rather than silently assuming the 2026-10-06 state.

### Why these four

The allocation deliberately avoids using one provider or one model family for
all judgments:

- Groq + GPT-OSS for strong English reasoning;
- Google's own Gemini endpoint for Persian/translation;
- OpenRouter + Gemma for an independent pedagogical view;
- Cloudflare + GLM for adversarial multilingual reasoning.

This improves failure independence while keeping normal Unit 1 evaluation at
zero inference cost within the stated free limits.

### Free credentials still required

Free does not mean anonymous. The following credentials must be created:

- Groq free API key -> `SEMANTIC_JUDGE_ENGLISH_API_KEY`
- Google AI Studio free API key -> `SEMANTIC_JUDGE_PERSIAN_API_KEY`
- OpenRouter free API key -> `SEMANTIC_JUDGE_PEDAGOGICAL_API_KEY`
- Cloudflare API token -> `SEMANTIC_JUDGE_ADVERSARIAL_API_KEY`
- Cloudflare account id (repository variable) ->
  `SEMANTIC_JUDGE_CLOUDFLARE_ACCOUNT_ID`

No payment method is required by the design. Do not upgrade a provider to a
paid tier merely to make semantic certification pass.

### GitHub Models

Do not use GitHub Models. GitHub retired the playground, catalog, inference API
and BYOK service on 2026-07-30.

Official notice:
https://github.blog/changelog/2026-07-30-github-models-is-now-retired/

### Hugging Face Jobs

The connected Hugging Face tool can inspect models and run Jobs, but Jobs are
billable compute. Hugging Face documents that Jobs require a positive credit
balance and are billed by hardware usage/time.

Official pricing:
https://huggingface.co/docs/hub/jobs-pricing

No Hugging Face Job has been started for semantic judging.

### ChatGPT plugin inventory

A plugin search on 2026-10-06 did not surface an installed generic text
inference connector for Groq, OpenRouter or Together AI. Hugging Face is
installed, but its available tool surface does not provide a free generic
chat-completions endpoint to this repository.

Because this can change, re-run plugin discovery only when the endpoint stage is
resumed. Do not repeat the packet/runner/ingestion implementation.

## Endpoint acceptance criteria

A judge endpoint is acceptable only when all of these are known:

1. provider name;
2. base URL for an OpenAI-compatible `/chat/completions` endpoint;
3. exact model id;
4. explicit model/build/version identifier that can be recorded in evidence;
5. authentication method, if required;
6. whether JSON response format is supported;
7. enough context/output capacity for the Unit 1 target and complete criterion
   response;
8. stable enough availability to complete all 20 Unit 1 targets for one role;
9. acceptable English/Persian competence for the assigned role;
10. explicit authorization before any billed execution.

Provider diversity is preferred: do not deliberately use one identical
model/context for all four roles. The repository independently enforces unique
context keys across roles.

## Manual GitHub workflow

`.github/workflows/semantic-judge.yml` is intentionally
`workflow_dispatch`-only. It has read-only repository permission and requires
the explicit `acknowledge_inference` input.

The workflow runs exactly one role and uploads a structured evidence artifact.
It does not commit evidence.

CI checks these safety properties with:

```sh
npm run assurance:semantic:workflow:check
```

## Repository Variables

The verified zero-cost presets now provide the normal base URL/model/provider
defaults automatically. Role-specific variables below are optional overrides,
not required configuration.

The only required non-secret variable for the default zero-cost allocation is:

- `SEMANTIC_JUDGE_CLOUDFLARE_ACCOUNT_ID`

Optional overrides:

### English

- `SEMANTIC_JUDGE_ENGLISH_BASE_URL`
- `SEMANTIC_JUDGE_ENGLISH_MODEL`
- `SEMANTIC_JUDGE_ENGLISH_MODEL_VERSION`
- `SEMANTIC_JUDGE_ENGLISH_PROVIDER` (optional; defaults to
  `openai-compatible`)
- `SEMANTIC_JUDGE_ENGLISH_MAX_TOKENS` (optional; defaults to 2400)
- `SEMANTIC_JUDGE_ENGLISH_JSON_RESPONSE_FORMAT` (optional; defaults to true)

### Persian

- `SEMANTIC_JUDGE_PERSIAN_BASE_URL`
- `SEMANTIC_JUDGE_PERSIAN_MODEL`
- `SEMANTIC_JUDGE_PERSIAN_MODEL_VERSION`
- `SEMANTIC_JUDGE_PERSIAN_PROVIDER`
- `SEMANTIC_JUDGE_PERSIAN_MAX_TOKENS`
- `SEMANTIC_JUDGE_PERSIAN_JSON_RESPONSE_FORMAT`

### Pedagogical

- `SEMANTIC_JUDGE_PEDAGOGICAL_BASE_URL`
- `SEMANTIC_JUDGE_PEDAGOGICAL_MODEL`
- `SEMANTIC_JUDGE_PEDAGOGICAL_MODEL_VERSION`
- `SEMANTIC_JUDGE_PEDAGOGICAL_PROVIDER`
- `SEMANTIC_JUDGE_PEDAGOGICAL_MAX_TOKENS`
- `SEMANTIC_JUDGE_PEDAGOGICAL_JSON_RESPONSE_FORMAT`

### Adversarial

- `SEMANTIC_JUDGE_ADVERSARIAL_BASE_URL`
- `SEMANTIC_JUDGE_ADVERSARIAL_MODEL`
- `SEMANTIC_JUDGE_ADVERSARIAL_MODEL_VERSION`
- `SEMANTIC_JUDGE_ADVERSARIAL_PROVIDER`
- `SEMANTIC_JUDGE_ADVERSARIAL_MAX_TOKENS`
- `SEMANTIC_JUDGE_ADVERSARIAL_JSON_RESPONSE_FORMAT`

## Repository Secrets

Only API credentials are secrets:

- `SEMANTIC_JUDGE_ENGLISH_API_KEY`
- `SEMANTIC_JUDGE_PERSIAN_API_KEY`
- `SEMANTIC_JUDGE_PEDAGOGICAL_API_KEY`
- `SEMANTIC_JUDGE_ADVERSARIAL_API_KEY`

Endpoints that require no API key may leave the corresponding secret unset.

## Resume sequence

Once endpoints are configured:

1. run `npm run assurance:semantic:preflight:strict` locally if the variables
   are present locally, or manually dispatch each GitHub judge role;
2. run one isolated role at a time;
3. download the four structured role artifacts;
4. merge with `npm run assurance:semantic:merge -- --require-complete ...`;
5. run `npm run assurance:semantic:unit1:check`;
6. run `npm run assurance:semantic:unit1:strict`;
7. commit evidence only if the fail-closed checks accept it;
8. never convert FAIL, UNCERTAIN, DISAGREEMENT or QUARANTINED into PASS by
   editorial override.
