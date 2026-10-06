# Legacy fallback only — API keys are no longer required

**Superseded on 2026-10-06 by
`content/assurance/semantic/KEYLESS_GATEWAY.md`.**

The authoritative semantic judge path now uses GitHub Actions OIDC plus the
Cloudflare Workers AI binding and requires **no provider API keys** and no
semantic repository secrets.

Keep the material below only as a disaster-recovery fallback if the keyless
Workers AI path is intentionally retired in a future version. Do not perform
this setup for normal Vajefy operation.

---

# Free semantic judge credential setup

Verified: 2026-10-06

This is the only remaining external setup before Vajefy can run its frozen
semantic judge calibration automatically.

Do **not** paste API keys into source files, issue comments, chat messages, or
workflow logs. Store sensitive values only as GitHub Actions repository secrets.

## 1. Groq Free — English judge

Official API keys page:

https://console.groq.com/keys

Steps:

1. Sign in or create a Groq account.
2. Open **API Keys**.
3. Select **Create API Key**.
4. Copy the new key.
5. In the Vajefy GitHub repository, save it as repository secret:

   `SEMANTIC_JUDGE_ENGLISH_API_KEY`

The repository's zero-cost preset selects:

`openai/gpt-oss-120b`

No model/base-URL variable is required unless intentionally overriding the
verified preset.

## 2. Google AI Studio Free — Persian judge

Official Gemini API key documentation:

https://ai.google.dev/gemini-api/docs/api-key

Google AI Studio:

https://aistudio.google.com/

Steps:

1. Sign in to Google AI Studio.
2. Open **Dashboard -> API Keys**.
3. If you are a new user, AI Studio may already have created a default project
   and key after Terms acceptance.
4. Otherwise select **Create API key** and choose/create a project.
5. Copy the key.
6. Save it in GitHub as:

   `SEMANTIC_JUDGE_PERSIAN_API_KEY`

The verified preset selects:

`gemini-3.8-flash`

## 3. OpenRouter Free — Pedagogical judge

Official developer page:

https://openrouter.ai/developers

Steps:

1. Sign in to OpenRouter.
2. Select **Get an API key** / open the API-key dashboard.
3. Create a key.
4. Copy it.
5. Save it in GitHub as:

   `SEMANTIC_JUDGE_PEDAGOGICAL_API_KEY`

The verified preset selects:

`minimax/minimax-m2.7:free`

Do not add a paid fallback model to the default configuration merely to make a
calibration run succeed.

## 4. Cloudflare Workers AI Free — Adversarial judge

Official Workers AI REST API setup:

https://developers.cloudflare.com/workers-ai/get-started/rest-api/

Steps:

1. Sign in to the Cloudflare dashboard.
2. Go to **AI -> Workers AI**.
3. Select **Use REST API**.
4. Select **Create a Workers AI API Token**.
5. Review the prefilled permissions and create the token.
6. Copy the API token.
7. On the same REST API page, copy the **Account ID**.
8. Save the token in GitHub as repository secret:

   `SEMANTIC_JUDGE_ADVERSARIAL_API_KEY`

9. Save the Account ID as a GitHub Actions **repository variable**:

   `SEMANTIC_JUDGE_CLOUDFLARE_ACCOUNT_ID`

If creating the Cloudflare token manually instead of using the Workers AI
template, follow Cloudflare's current Workers AI permission guidance.

The verified preset selects:

`@cf/qwen/qwen3.8-27b`

## 5. Add the values to GitHub

Repository:

`mostifa2274-ui/Vajefy`

GitHub path:

**Settings -> Secrets and variables -> Actions**

### Repository secrets

Create these four secrets:

- `SEMANTIC_JUDGE_ENGLISH_API_KEY`
- `SEMANTIC_JUDGE_PERSIAN_API_KEY`
- `SEMANTIC_JUDGE_PEDAGOGICAL_API_KEY`
- `SEMANTIC_JUDGE_ADVERSARIAL_API_KEY`

For each one:

1. open the **Secrets** section;
2. choose **New repository secret**;
3. enter the exact name above;
4. paste the provider key;
5. save.

### Repository variable

Open the **Variables** tab and choose **New repository variable**.

Create:

- name: `SEMANTIC_JUDGE_CLOUDFLARE_ACCOUNT_ID`
- value: the Cloudflare account ID copied from Workers AI.

The Cloudflare Account ID is configuration rather than a credential, so it is a
GitHub Actions variable, not a secret.

## 6. What to do after all five values exist

Do **not** run Unit 1 judging first.

Calibration no longer needs these values or a person to dispatch it. The
keyless **Semantic judge calibration and qualification** workflow runs on a
schedule and qualifies or rejects each role's candidates by itself. See
`AUTOMATION.md`.

After all four roles qualify, use the existing:

**Semantic judge (manual)**

workflow with target set:

`unit1`

The workflow itself blocks Unit 1 execution for any role that is not currently
qualified.

## 7. Current credential status

Last checked: 2026-10-06.

At that check all five required names were absent:

- English API key — absent
- Persian API key — absent
- Pedagogical API key — absent
- Adversarial API key — absent
- Cloudflare Account ID variable — absent

Do not repeat the presence probe unless settings have changed.

## Security rules

- Never commit a provider key to Git.
- Never put a key in `.env.example`.
- Never paste a key into a PR, issue, commit message, or chat.
- Never print keys from a workflow.
- Keep the semantic workflows manual-only.
- Do not change the frozen calibration thresholds after seeing candidate output.
