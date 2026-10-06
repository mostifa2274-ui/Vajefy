# Zero-cost semantic judge selection

Verified: 2026-10-06

This document records why the default judges were selected. It exists so future
work does not replace a judge merely because another model is newer or larger.

## Selection criteria

A candidate must satisfy all of these before becoming a default:

1. zero-cost API path suitable for the 20-target Unit 1 run;
2. OpenAI-compatible chat-completions path or compatible adapter;
3. stable enough model identifier to record in evidence;
4. structured/JSON output support compatible with the repository parser;
5. enough context/output capacity for the complete role rubric;
6. credible capability for the assigned role;
7. provider/model-family diversity across the four judges;
8. no automatic billing dependency.

Quality ranking then emphasizes different signals per role:

- English: linguistic precision, instruction following, reasoning;
- Persian: multilingual semantic fidelity, translation nuance, structured output;
- Pedagogical: instruction following, non-hallucination, reasoning, multilingual comprehension;
- Adversarial: reasoning depth, error discovery, multilingual comprehension, independence.

## Current champions

| Role | Champion | Why |
|---|---|---|
| English | Groq Free / `openai/gpt-oss-120b` | Large high-capability reasoning model, JSON Schema/Object support, generous Groq free request allowance |
| Persian | Google Free / `gemini-3.8-flash` | Current most intelligent stable Gemini Flash, free-tier input/output, structured outputs and tunable thinking |
| Pedagogical | OpenRouter Free / `minimax/minimax-m2.7:free` | Strong evaluator-style reasoning/instruction-following and non-hallucination signals, structured output, multilingual capability |
| Adversarial | Cloudflare Workers AI Free / `@cf/qwen/qwen3.8-27b` | New reasoning model, 262k context, high reasoning mode, multilingual model family, separate serving stack |

## Replaced defaults

### Persian: Gemini 3.5 Flash-Lite -> Gemini 3.8 Flash

Flash-Lite was selected originally for translation efficiency. That is no longer
the best quality choice because Gemini 3.8 Flash is also available on the Free
Tier and is Google's current most intelligent stable Flash model.

### Pedagogical: Gemma 4 31B -> MiniMax M2.7

Gemma 4 remains a strong multilingual fallback. MiniMax M2.7 was promoted because
the current OpenRouter benchmark display gives it stronger evaluator-relevant
signals, including:

- IFBench 75.7;
- GPQA Diamond 87.4%;
- HLE 29.6%;
- AA-Omniscience non-hallucination rate 64.4%.

The model also supports structured output through OpenRouter.

This is not proof that M2.7 is universally better at language teaching. It is a
better current default for the role, pending direct Vajefy calibration.

### Adversarial: GLM-4.7-Flash -> Qwen 3.8 27B

GLM-4.7-Flash remains an acceptable fallback. Qwen 3.8 27B is newer, supports
reasoning and a 262k context window, and Cloudflare exposes high reasoning
settings. It is not on Cloudflare's list of models requiring paid billing, so
the normal 10,000-Neuron/day free allocation applies.

## Important limitation: public benchmarks are not the release truth

Generic benchmarks only choose **candidates**.

Before semantic assurance becomes release-critical at scale, the repository
should build a small frozen Vajefy judge-calibration set containing:

- deliberately correct A1 senses;
- known English grammar/collocation defects;
- subtle English/Persian mistranslations;
- literal-but-unnatural Persian;
- misleading common-error explanations;
- A2+ curriculum leakage;
- ambiguous distractors;
- duplicated/non-diverse examples;
- cases where a judge should abstain.

Each role's candidate models should be measured on that frozen set for:

- defect recall;
- false-positive rate;
- abstention calibration;
- exact-schema compliance;
- cross-run stability.

The champion should then be chosen by Vajefy-specific calibration, not marketing
claims or aggregate benchmarks.

## Current source references

- Groq supported models and GPT-OSS 120B:
  https://console.groq.com/docs/models
- Groq free rate limits:
  https://console.groq.com/docs/rate-limits
- Gemini 3.8 Flash:
  https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash
- Gemini pricing:
  https://ai.google.dev/gemini-api/docs/pricing
- Gemini OpenAI compatibility:
  https://ai.google.dev/gemini-api/docs/openai
- OpenRouter MiniMax M2.7 free:
  https://openrouter.ai/minimax/minimax-m2.7:free
- OpenRouter MiniMax M2.7 performance:
  https://openrouter.ai/minimax/minimax-m2.7/performance
- OpenRouter free-plan limits:
  https://openrouter.ai/pricing/
- Cloudflare Qwen 3.8 27B:
  https://developers.cloudflare.com/workers-ai/models/qwen3.8-27b/
- Cloudflare Workers AI pricing:
  https://developers.cloudflare.com/workers-ai/platform/pricing/


## Authoritative keyless candidates — 2026-10-06

The external-provider allocation above is now historical candidate research.
The authoritative execution path is keyless and uses Cloudflare Workers AI
through the deployed Worker's `AI` binding.

Current candidates:

| Role | Model family | Keyless model |
|---|---|---|
| English | OpenAI GPT-OSS | `@cf/openai/gpt-oss-120b` |
| Persian | Zhipu GLM | `@cf/zai-org/glm-4.7-flash` |
| Pedagogical | Google Gemma | `@cf/google/gemma-4-26b-a4b-it` |
| Adversarial | Qwen | `@cf/qwen/qwen3.8-27b` |

Why the allocation changed:

- eliminating long-lived provider credentials is now a hard architecture goal;
- Workers AI bindings require no API key in Worker code;
- GitHub Actions authenticates to the Worker with short-lived OIDC identity;
- the four roles still use four different model families;
- the frozen Vajefy calibration gate, not generic benchmark prestige, remains the
  final judge-selection authority.

Tradeoff: the four models share Cloudflare as a serving platform, so provider
serving-stack independence is lower than in the earlier multi-provider plan.
This is explicit and must not be disguised by relabeling the provider. The
qualification record will therefore use `cloudflare-workers-ai` as provider
for all four roles while preserving distinct model IDs/families.

No candidate is trusted until it passes `vajefy-semantic-v1`.
