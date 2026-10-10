# Autonomous Assurance Progress Ledger

**Purpose:** authoritative handoff so future work resumes from repository evidence and does not repeat completed analysis or implementation.

## Resume rule

Before starting new autonomous-assurance work:

1. read `content/assurance/progress.json`;
2. verify current `main`;
3. compare current repository state with the recorded merge commits;
4. continue from `currentWork.nextSteps`;
5. update both progress files after every merged implementation slice.

Do **not** restart from chat memory when repository evidence exists.

## Current authoritative state

- Verified main after PR #207: `af0cc6d4df5c12b71df03229d1462740691dcd1d`.
- Roadmap: `docs/AUTONOMOUS_ASSURANCE_PLAN.md`; implementation status: `docs/A1_PLAN_STATUS.md`.
- Current handoff: `content/assurance/progress.json` → `currentWork.nextSteps`.
- PRs #188–#191 and #193–#207 are merged. Source authentication, 140 contextual supports,
  A1 reference/Review scope and four language-field repairs are complete.
- Mistake-pair Persian covers every sense in course Units 4–12 (831). The 173
  remaining pairs, 36 usage notes, 161 grammar notes and 114 feedback lines are
  in frozen Units 1–3 and wait for an owner scope decision. Later-unit usage
  notes, grammar notes and answer feedback are complete. The frontier triage
  queue holds only frozen Units 1–3 cases (71); later-unit rewording is done.
- Remaining: 6,640 deterministic findings; 900/900 unreviewed independent
  NGSL drafts; Gate 0 BLOCKED; 0/4 qualified judges; 328/386 certified audio.
- English judge: two appended candidates are awaiting scheduled calibration (PR #193): Gemma 4 26B first, then GLM 4.7 Flash.

Earlier checkpoints below are historical evidence. Their branch names and
resume instructions describe that earlier point, not unfinished current work.

## Completed — do not repeat

### PR #82 — autonomous assurance foundation

Merged as `6e6a44bf74c251615f21bc70939873ea54b059f9`.

Implemented:

- Gate 0 machine-readable provenance;
- explicit UNVERIFIED legal state for the Oxford-derived source;
- fail-closed assurance states;
- machine-assurance record schema;
- deterministic A1 content audit;
- unit tests and repository commands;
- autonomous-assurance roadmap/status documentation.

### PR #83 — deterministic assurance ratchet

Merged as `b8da6dcfd154df32082157f26ebd084944bc01b9`.

Implemented:

- measured deterministic-defect baseline;
- CI no-regression ratchet;
- existing debt may temporarily remain, but measured defect classes may not increase.

## Unit 1 measured baseline

Unit: `01-introductions` — 20 entries / 20 senses.

| Finding | Count |
|---|---:|
| Grammar notes without Persian explanation | 24 |
| Senses below the 3-example target | 20 |
| Identical wrong/right Persian translations | 17 |
| Required usage notes missing | 7 |
| Missing `wrongFa` | 0 |
| Missing `rightFa` | 0 |

This diagnosis is already complete. Do not repeat it unless Unit 1 source content changes.

## Known blocker

Gate 0 remains **BLOCKED**. The Oxford-derived workbook is still `UNVERIFIED`. Nothing in later content work may silently convert that state to cleared.

## Repository hygiene

Draft PR #75 predates the current autonomous-assurance main and must not be used as the base for new work. Reassess or close it separately; do not duplicate its old workflow in new branches.

## Current next actions

1. Continue from 9983 deterministic findings and the 105-case non-promotable frontier queue. Select later-unit source fields using actual curriculum membership; all 180 frozen Units 1–3 entries stay untouched without a separate study/audio scope decision.
2. Independent NGSL authoring is complete: all 900 candidates have staged drafts. Every draft requires independent lexical-sense, Persian, pedagogy, CEFR and rights review before any public replacement; build review packets with `npm run assurance:ngsl:review:packets -- --json --from N --limit M`. Do not record approvals without a real independent reviewer.
3. Check the scheduled calibration ledgers before doing semantic work. English rejected its four original v1 candidates. On 2026-10-10 (PR #193) Gemma 4 26B and GLM 4.7 Flash, both +no-thinking, were appended to the end of its list, and the planner selects Gemma 4. Do not register more English candidates while these are untried; let the scheduled runs calibrate them. Only if both are rejected does English need another candidate or a justified new calibration version. Preserve v1 gold and thresholds. Other roles continue through the authorised planner, with no manual budget or order bypass.
4. Preserve Gate 0 BLOCKED, 0/4 qualified judges and PARTIAL audio (328/386 certified, 58 quarantined). Live rollback needs the deployed URL and exact revision; learner canary and outcomes need real learner evidence.

## Historical checkpoint — Unit 1 certification

On branch `codex/unit1-autonomous-certification`:

- all 20 Unit 1 senses have source repairs applied;
- the measured Unit 1 deterministic findings are now 0 in the repaired source;
- a validator false positive was fixed so capitalization mistakes such as `i` → `I` remain detectable as meaningful differences;
- `scripts/content-assurance.ts --unit 01-introductions --strict` is now supported;
- `npm run assurance:unit1` is wired into `validate:data` so Unit 1 cannot regress once merged;
- derived enhanced-content artifacts still need regeneration and commit before merge;
- full CI has not yet completed for this branch.

If work resumes before this branch merges, continue from artifact regeneration/CI. Do not redo the Unit 1 content diagnosis or source repairs.

## Checkpoint — generated artifacts committed

The repository compiler regenerated the derived enhanced-content outputs and committed them as `5d51bd4d60909d46ed23cbd0bbe755594fcb921c`.

The one-use regeneration workflow was then removed in `edfbfeff4c3a810ba82a8d3ad54b6cae71f80f22`.

Resume point at that historical checkpoint: **final exact-head CI for PR #84**. Do not regenerate Unit 1 source content or derived artifacts again unless CI reports them stale or a later source edit changes them.

## Checkpoint — Unit 1 controlled audio complete

The first temporary audio run exposed a runner-only dependency issue: `ffmpeg` was not installed. The temporary workflow was corrected; no product/audio generator code was weakened.

Successful audio generation commit: `455ab84dd7b9ae1c20a3e5eca19d8e24dcdcc5d3`.

Evidence from the successful job:

- 38 new controlled clips generated;
- 5,888 clips total;
- about 50.6 MB total audio;
- heuristic flagged count stayed at 292 before/after, so the new example clips added no new heuristic flags;
- content rebuilt after synthesis, so Unit 1's third examples now have controlled GB/US audio attached.

The temporary audio workflow was removed in `f3f53e16564ba5e60090c3361fd35bc1ea801909`.

Resume point at that historical checkpoint: **final exact-head CI for PR #84**. Do not rerun Unit 1 audio generation unless content or CI proves the manifests are stale/incomplete.

## Checkpoint — version-bound derived artifacts refreshed

After controlled audio became complete, `validate:data` advanced to a stale `content/coach-eval/cases.json` snapshot. The safe content-derived artifacts were refreshed without modifying review decisions, release state, audit baselines or learner evidence.

Generated commit: `41689afc9000b80fc7d9355bb77c9a2321faa77d`.

Refreshed writers:

- `npm run coach:cases`;
- `scripts/reference-notes.ts build`;
- `scripts/build-usefulness.mjs`.

The temporary workflow was removed in `598e14b0a09cd2db9e82dbea533415324ba425de`.

Resume point at that historical checkpoint: **exact-head CI for PR #84**. Do not regenerate these artifacts again unless a source edit or CI explicitly reports them stale.

## Completed — PR #84 Unit 1 deterministic certification

PR #84 merged as `6714cce4a36939c38a3ede0afa3bbc57eb62efe3`.

Unit `01-introductions` is now **deterministically certified** under the current structural assurance contract:

- 20/20 senses repaired;
- strict Unit 1 deterministic findings = 0;
- controlled GB/US audio complete for the edited examples;
- 38 new controlled clips generated, 5,888 clips total;
- heuristic audio flags remained 292 before/after;
- version-bound generated artifacts refreshed;
- generated-content consistency, `validate:data`, typecheck, lint, unit tests, production build, Playwright and Workers build contract all passed on the exact merged head.

Do not repeat Unit 1 deterministic repairs or audio regeneration unless its source content changes or CI reports drift.

## Current work — semantic assurance foundation

Branch: `codex/semantic-assurance-foundation`.

Next unrepeated objective:

1. define versioned independent judge rubrics for English, Persian, pedagogy and adversarial review;
2. store complete judge provenance and evidence;
3. implement fail-closed arbitration with disagreement/uncertainty/quarantine states;
4. add fixture-based tests for every arbitration path;
5. add a Unit 1 semantic-assurance command that cannot produce PASS without complete independent evidence.

Gate 0 remains blocked and Unit 1's certified source content should not be edited during this foundation slice.

## In-progress checkpoint — semantic assurance foundation

On branch `codex/semantic-assurance-foundation`:

- PR #84 is recorded as merged at `6714cce4a36939c38a3ede0afa3bbc57eb62efe3`;
- Unit 1 is marked deterministically certified and must not be re-repaired unless its source changes;
- four versioned judge roles now exist: English, Persian, pedagogical and adversarial;
- each judge record is bound to the exact sense input hash and entry content version;
- evaluator provenance includes provider, model id/version, prompt version, rubric version, isolated context key and run id;
- arbitration is fail-closed: missing or stale evidence is quarantined, high-confidence failures veto, lower-confidence conflict becomes disagreement, and uncertainty never becomes PASS;
- CI now validates any committed semantic evidence for consistency, but semantic PASS is **not** claimed because no independent Unit 1 judge evidence has been committed yet;
- a strict semantic command exists for the later certification gate and will fail until every Unit 1 sense has complete independent evidence.

Resume point at that historical checkpoint: validate this foundation in CI, merge it if green, then produce independent Unit 1 judge evidence without editing the deterministically certified source content.

## Completed — PR #85 semantic assurance foundation

PR #85 merged as `ee3e7afe764520a71b9cb7fe17fd1c1ea66c25f8`.

The four-role semantic assurance schema, version/hash binding, fail-closed arbitration, evidence consistency checker and fixture tests are now on `main`. No semantic PASS judgments were fabricated or committed.

Current branch: `codex/semantic-judge-packets`.

Next unrepeated objective: produce deterministic judge packets and an opt-in provider-independent runner. GitHub Models must not be used: the standalone service was retired on 30 July 2026. No paid inference should be invoked without explicit authorization.

## In-progress checkpoint — semantic judge packet and runner

Branch: `codex/semantic-judge-packets`.

The first deterministic Unit 1 packet was generated and committed as `9c75db47b44f6f2031ca9fb88763b16843e8fea7`:

- 20 sense targets;
- 4 role specifications;
- curriculum-aware source hashes include unit, course order and prerequisites;
- exact prompt and rubric hashes are embedded;
- source generation context: `source-content:01-introductions:eb4d6476149ab0171f8b`.

Provider-independent execution infrastructure is present but **no model inference has been run**. The runner accepts an explicitly configured OpenAI-compatible/local endpoint, one isolated role per process, and writes schema-valid role evidence only after exact packet/prompt/rubric validation. A separate merge command combines isolated role bundles.

GitHub Models is not a candidate: the standalone inference service was retired on 30 July 2026. No paid endpoint should be invoked without explicit authorization.

Resume point at that historical checkpoint: CI/merge this infrastructure, then resolve actual independent model endpoints before producing evidence. Do not rebuild the packet unless source/rubric/prompt drift makes its CI check fail.

## Completed — PR #86 reproducible semantic judge packets and runner

PR #86 merged as `2a9677a78a458b04a504b9e5d8f52433f4e811d5`.

Do not repeat packet generation or runner construction unless packet freshness CI fails. The current Unit 1 packet remains the authoritative judge input.

Current branch: `codex/semantic-evidence-ingestion`.

Next unrepeated objective: harden evidence ingestion/preflight with deterministic tests before any real model endpoint is invoked. No paid inference or semantic PASS evidence should be created implicitly.

## In-progress checkpoint — semantic evidence ingestion hardening

Branch: `codex/semantic-evidence-ingestion`.

Completed on this branch:

- external evidence merge now rejects stale content versions and curriculum-aware input hashes before writing output;
- one run bundle may contain only one judge role;
- different roles may not reuse the same judge context key;
- source-generation context reuse, duplicate target/role pairs, wrong units/contexts and incomplete required evidence are rejected;
- fixture tests cover the ingestion barriers;
- endpoint configuration is centralized and test-covered;
- `npm run assurance:semantic:preflight` reports readiness without inference and without exposing API key values;
- JSON response-format mode can be disabled for compatible endpoints that do not implement that OpenAI extension;
- the no-inference preflight is exercised by `validate:data`.

Resume point at that historical checkpoint: full CI/merge this hardening branch. After merge, actual judge execution remains blocked only on selecting/connecting explicit independent model endpoints; do not repeat packet, runner or ingestion infrastructure.

## Completed — PR #87 semantic evidence ingestion hardening

PR #87 merged as `eaa36a7f57f0f50426cf3c6789d1c40262fceda1`.

The repository now has a complete fail-closed path from certified Unit 1 source -> deterministic judge packet -> isolated role runner -> external evidence ingestion -> semantic arbitration. No semantic evidence has been fabricated and no model inference has been run.

Current branch: `codex/semantic-endpoint-resolution`.

Next unrepeated objective: inventory actual connected inference options, distinguish no-cost/local execution from billed services, and resolve explicit endpoint/model/version provenance for all four judge roles. Do not rebuild the packet, runner, ingestion validator or preflight.

## In-progress checkpoint — semantic endpoint resolution

Branch: `codex/semantic-endpoint-resolution`.

Endpoint investigation is now recorded and should not be repeated unless the plugin/provider landscape changes:

- GitHub Models is retired and is not a candidate;
- Hugging Face Jobs are billable compute, so no job was launched;
- no installed generic Groq/OpenRouter/Together inference connector was discovered;
- real semantic evidence therefore remains blocked on explicit endpoint configuration, not on repository infrastructure.

Implemented on this branch:

- role-scoped no-inference preflight;
- manual-only `.github/workflows/semantic-judge.yml`;
- explicit `acknowledge_inference` dispatch gate;
- read-only repository permission;
- one-role-per-run structured evidence artifact upload;
- CI safety checker that forbids push/pull_request/schedule/workflow_run triggers and `contents: write`;
- endpoint variables/secrets and resume sequence documented in `content/assurance/semantic/ENDPOINT_RESOLUTION.md`.

No model inference has been run. Resume point at that historical checkpoint: CI/merge this slice, then wait for explicit endpoint configuration/authorization before evidence execution.


## Completed — PR #88 manual semantic judge execution

PR #88 merged as `0704d5fd85a194578cac03f42e981f1a4536a38e`.

The semantic-assurance infrastructure is now complete through the explicit inference boundary:

- Unit 1 deterministic certification is already merged;
- four-role semantic schemas and fail-closed arbitration are merged;
- deterministic Unit 1 judge packet and versioned prompts are merged;
- isolated provider-independent judge runner is merged;
- stale/non-independent evidence ingestion barriers are merged and tested;
- no-inference endpoint preflight is merged;
- manual-only GitHub judge workflow is merged;
- CI prevents that workflow from gaining automatic triggers or repository write permission.

**No semantic model inference has been run and no semantic PASS evidence has been committed.**

### Authoritative resume point

Do not repeat PRs #84–#88 or their analysis.

Resume only at endpoint configuration/execution:

1. read `content/assurance/progress.json`;
2. read `content/assurance/semantic/ENDPOINT_RESOLUTION.md`;
3. configure the documented per-role variables/secrets;
4. manually dispatch `.github/workflows/semantic-judge.yml` for English, Persian, pedagogical and adversarial roles;
5. merge the four structured artifacts with the existing fail-closed merge command;
6. run semantic Unit 1 strict certification;
7. edit Unit 1 source only if the judges produce a concrete defect that survives arbitration.

Current blocker: explicit independent judge endpoint configuration/authorization. This blocker is external configuration, not missing repository implementation.


## In-progress checkpoint — verified zero-cost semantic providers

Branch: `codex/free-semantic-providers`.

The earlier endpoint blocker has been narrowed materially: **paid inference is
not required**.

Verified 2026-10-06 zero-cost allocation:

- English -> Groq Free / `openai/gpt-oss-120b`;
- Persian -> Gemini Developer API Free Tier / `gemini-3.5-flash-lite`;
- Pedagogical -> OpenRouter Free / `google/gemma-4-31b-it:free`;
- Adversarial -> Cloudflare Workers AI Free / `@cf/zai-org/glm-4.7-flash`.

The machine-readable defaults are in
`content/assurance/semantic/free-provider-presets.json`.

The manual judge workflow now applies those presets automatically and keeps
explicit repository variables as overrides. CI checks that the preset policy is
`zero-cost-only` and that the four role defaults use four distinct provider
profiles and model ids.

Remaining external setup is only free credentials:

- three free API keys (Groq, Google AI Studio, OpenRouter);
- one Cloudflare API token;
- one Cloudflare account id repository variable.

No inference has been run and no semantic evidence has been fabricated.

Resume point at that historical checkpoint: CI/merge this zero-cost provider slice, then configure the
free credentials and execute the existing manual judge workflow. Do not repeat
provider research unless availability/pricing changes or the preset verification
date is intentionally refreshed.


## Completed — PR #89 verified zero-cost semantic providers

PR #89 merged as `c6c0682d331c9fb1634a890595ee5ff2933909d6`.

The semantic judge design no longer depends on paid inference.

Authoritative zero-cost defaults, verified 2026-10-06:

- English -> Groq Free / `openai/gpt-oss-120b`;
- Persian -> Gemini Free / `gemini-3.5-flash-lite`;
- Pedagogical -> OpenRouter Free / `google/gemma-4-31b-it:free`;
- Adversarial -> Cloudflare Workers AI Free / `@cf/zai-org/glm-4.7-flash`.

CI now enforces the `zero-cost-only` preset policy and requires four distinct
provider/model defaults. The manual workflow applies these presets automatically.

### Authoritative resume point

Do not repeat provider discovery or PRs #84–#89.

Only free credential setup remains:

1. `SEMANTIC_JUDGE_ENGLISH_API_KEY` (Groq Free);
2. `SEMANTIC_JUDGE_PERSIAN_API_KEY` (Google AI Studio Free);
3. `SEMANTIC_JUDGE_PEDAGOGICAL_API_KEY` (OpenRouter Free);
4. `SEMANTIC_JUDGE_ADVERSARIAL_API_KEY` (Cloudflare API token);
5. `SEMANTIC_JUDGE_CLOUDFLARE_ACCOUNT_ID`.

After those are configured, run the four existing manual judge workflows, merge
their structured artifacts, and execute strict Unit 1 semantic certification.


## In-progress checkpoint — stronger zero-cost judges

Branch: `codex/better-free-semantic-judges`.

The free judges were re-ranked by role fit rather than convenience.

Current champions:

- English: Groq Free / `openai/gpt-oss-120b` (unchanged);
- Persian: Google Free / `gemini-3.8-flash` (upgraded from Flash-Lite);
- Pedagogical: OpenRouter Free / `minimax/minimax-m2.7:free` (upgraded from Gemma 4 31B);
- Adversarial: Cloudflare Workers AI Free / `@cf/qwen/qwen3.8-27b` (upgraded from GLM-4.7-Flash).

Selection rationale and benchmark caveats are recorded in
`content/assurance/semantic/JUDGE_SELECTION.md`.

Do not treat generic public benchmarks as release evidence. The next quality
step after this branch is a frozen Vajefy-specific judge calibration set that
measures defect recall, false-positive rate, abstention calibration and exact
schema reliability.

No inference has been run and no semantic evidence has been fabricated.


## Completed — PR #90 stronger zero-cost judge champions

PR #90 merged as `5111c83aca61cb84f502e7b7c3edc7222fa15588`.

Authoritative free judge champions:

- English -> Groq Free / `openai/gpt-oss-120b`;
- Persian -> Google Free / `gemini-3.8-flash`;
- Pedagogical -> OpenRouter Free / `minimax/minimax-m2.7:free`;
- Adversarial -> Cloudflare Workers AI Free / `@cf/qwen/qwen3.8-27b`.

Three defaults were upgraded; GPT-OSS 120B remained the English champion.

Do not repeat this re-ranking from public model pages. The next quality step is a
frozen Vajefy-specific judge calibration set. Future champion changes should be
driven by measured defect recall, false-positive rate, abstention calibration,
schema reliability and repeat-run stability on that set.

No semantic inference has been run and no semantic PASS evidence has been
committed.


## In-progress checkpoint — frozen semantic judge calibration v1

Branch: `codex/semantic-judge-calibration`.

Implemented without running model inference:

- frozen calibration version: `vajefy-semantic-v1`;
- 28 cases total:
  - 8 clean controls;
  - 16 deliberately seeded defects;
  - 4 deliberate abstention cases;
- role distribution:
  - English 6;
  - Persian 6;
  - pedagogical 7;
  - adversarial 9;
- gold labels are controlled mutations/withheld evidence, not another model's votes;
- expected labels are not included in judge packets;
- three independent runs are required for each role;
- pre-registered promotion thresholds are strict:
  - 100% schema-complete runs;
  - 100% seeded-defect recall;
  - 0% false positives on clean controls;
  - 0% uncertainty on clean controls;
  - 100% correct abstention;
  - 100% expected-label stability;
- repeated runs must use the same candidate model/version/prompt/rubric but distinct run ids and isolated context keys;
- four calibration packets are committed and freshness-checked;
- the qualification ledger starts empty;
- changing a champion model automatically makes an existing qualification stale;
- the manual semantic workflow supports `calibration_v1` and `unit1`;
- `unit1` execution is blocked until the selected role has a current qualification record;
- workflow CI now requires this calibration gate to remain present.

Calibration packet generation commit:
`a02892ff11a24a820447efe51533d6661eca7c8f`.

No model inference has been run and no semantic qualification has been fabricated.

Resume point at that historical checkpoint: full CI/merge this branch. After merge, configure the free
credentials and run calibration first. Do not run release-bound Unit 1 semantic
judging before qualification.


## Completed — PR #91 frozen semantic judge calibration v1

PR #91 merged as `98c4121de458e1ae9117138b26642ccb7d7f8c84`.

The judge-calibration gate is now authoritative on `main`:

- 28 frozen cases;
- 8 clean controls;
- 16 seeded defects;
- 4 abstention cases;
- three independent runs required per role;
- strict pre-registered promotion thresholds;
- repeated-run replay and model-version mixing are rejected;
- an empty qualification ledger is present by design;
- changing a champion invalidates its prior qualification;
- Unit 1 judge execution is blocked until the selected role/model/version has passed calibration.

Do not modify calibration v1 after seeing candidate outputs. Any justified gold
or threshold correction must create a new calibration version.

Resume point at that historical checkpoint: inspect free credential/variable availability, run
`calibration_v1` first, qualify passing champions, then and only then run Unit
1 semantic judging.


## In-progress checkpoint — one-dispatch semantic calibration automation

Branch: `codex/semantic-calibration-automation`.

The manual burden after credentials are added has been reduced further.

New workflow: `.github/workflows/semantic-calibrate.yml`.

For one selected role, a single manual dispatch now:

1. requires execution from `main`;
2. requires explicit inference acknowledgement;
3. applies the verified zero-cost provider preset;
4. preflights the selected endpoint;
5. runs exactly three isolated `calibration_v1` repeats with distinct run ids;
6. scores the candidate against the frozen pre-registered v1 thresholds;
7. stops if any promotion criterion fails;
8. records qualification only after strict promotion;
9. writes an auditable JSON calibration report;
10. permits Git writes only to:
    - `content/assurance/semantic/calibration/qualified.json`;
    - `content/assurance/semantic/calibration/results/<role>.json`;
11. commits the qualification to `main`;
12. uploads the three raw calibration evidence bundles and report as a retained artifact.

A dedicated CI checker prevents the workflow from gaining automatic triggers,
broad git staging, or bypassing `--require-promote`.

The scorer writes the report file directly, avoiding npm/stdout contamination.

Once the five missing free credential/account names are configured, calibration
requires four manual dispatches total—one per role—not twelve individual runs.

No inference has been run yet.


## Completed — PR #92 one-dispatch semantic calibration automation

PR #92 merged as `fb31a9969463b1f69969b6be9b039c55b55f84cf`.

After credentials are configured, semantic judge qualification now requires only
one manual dispatch per role. Each dispatch performs all three frozen v1
repeats, scores them against the pre-registered gate, records qualification only
after strict promotion, commits only allowlisted qualification/report files, and
uploads the raw evidence.

Do not repeat the calibration automation work.

Current external blocker remains unchanged: all four API-key secrets and
`SEMANTIC_JUDGE_CLOUDFLARE_ACCOUNT_ID` were confirmed absent on 2026-10-06.


## In-progress checkpoint — zero-key semantic gateway

Branch: `codex/keyless-semantic-gateway`.

The old four-provider API-key setup is superseded.

Implemented on this branch:

- production origin discovered and verified:
  `https://vajefy.mostifa2273.workers.dev`;
- `SITE_URL` is not required for semantic execution;
- `wrangler.jsonc` now declares a Workers AI `AI` binding;
- GitHub Actions authenticates with short-lived OIDC identity
  (`id-token: write`), not provider API keys;
- the Worker verifies GitHub OIDC signature/JWKS plus exact audience,
  repository, main ref, workflow and timing claims;
- internal endpoint:
  `/api/internal/semantic-judge`;
- model selection is fixed on the Worker and cannot be supplied by callers;
- keyless role candidates:
  - English -> `@cf/openai/gpt-oss-120b`;
  - Persian -> `@cf/zai-org/glm-4.7-flash`;
  - pedagogical -> `@cf/google/gemma-4-26b-a4b-it`;
  - adversarial -> `@cf/qwen/qwen3.8-27b`;
- each inference call obtains a fresh GitHub OIDC token;
- semantic workflows contain no `SEMANTIC_JUDGE_*_API_KEY` references;
- qualification freshness is now tied to the keyless candidate map;
- CI rejects currently documented paid-only Workers AI model IDs and caps
  judge output to 1,200 tokens/request;
- old credential/setup documentation is explicitly marked legacy fallback.

Tradeoff recorded explicitly: model-family diversity remains four-way, but the
serving platform is Cloudflare for all four candidates. The frozen
`vajefy-semantic-v1` calibration remains the authority for promotion.

No model inference has been run on this branch.

Resume point at that historical checkpoint: full CI -> merge -> exact production revision check ->
OIDC no-inference gateway smoke -> keyless calibration.


## In-progress checkpoint — automatic keyless post-deploy smoke

Branch: `codex/keyless-postdeploy-smoke`.

This removes the manual no-inference gateway verification step.

On every push to `main`, the new
`.github/workflows/semantic-gateway-smoke.yml`:

1. waits until `/api/version` reports the exact pushed SHA;
2. requests a short-lived GitHub OIDC identity;
3. performs authenticated **GET-only** access to the internal semantic gateway;
4. verifies the Workers AI transport and all four fixed model IDs;
5. performs no model inference.

Security separation is explicit:

- the smoke workflow's `push` OIDC identity is accepted only for gateway
  status GETs;
- inference POSTs still require the exact manual semantic workflows and
  `workflow_dispatch`;
- the smoke contains no repository secrets;
- CI fails if the smoke gains a POST/inference path.

No model inference has been run by this branch.


## In-progress checkpoint — fail-closed Workers AI free budget

Branch: `codex/keyless-free-budget`.

Before any semantic inference, the complete frozen calibration campaign is now
budgeted against Cloudflare Workers AI's current free allocation.

Current machine-calculated upper bound:

- 84 requests total;
- English: 3,936 Neurons;
- Persian: 1,014;
- pedagogical: 1,398;
- adversarial: 1,440;
- total: **7,788 Neurons**;
- Workers Free daily allocation: 10,000;
- reserve: **2,212 Neurons**;
- stricter Vajefy safety ceiling: 8,500;
- safety-ceiling reserve: **712 Neurons**.

Budget assumptions are deliberately conservative:

- UTF-8 bytes are treated as an input-token upper bound;
- another 512 protocol tokens are added per request;
- every response is budgeted at its configured maximum output size;
- all three required repeats for every role are included.

To fit this boundary, the adversarial candidate changed from
`@cf/qwen/qwen3.8-27b` to
`@cf/qwen/qwen3-30b-a3b-fp8`.

Calibration now runs `assurance:semantic:budget:current` before gateway
preflight/inference and fails if the budget drifts above 8,500 Neurons, a model
requires paid billing, or the pricing verification is older than 30 days.

No semantic inference has been run.


## Completed — PR #97 fail-closed keyless free-budget gate

PR #97 merged as `5ecdb83013d217365369235823de81d0deb285ae`.

Post-merge evidence:

- CI run `37469172510`: PASS;
- core validation/typecheck/lint/tests/build: PASS;
- Workers build contract: PASS;
- Playwright: PASS;
- automatic keyless gateway smoke run `37469172696`: PASS;
- production exact revision: `5ecdb83013d`;
- authenticated GitHub OIDC GET to the gateway: PASS;
- no model inference occurred during the smoke.

The frozen calibration campaign now has a deterministic fail-closed budget:

- 84 requests total;
- 7,788 Neurons upper bound;
- 10,000 Neurons/day Workers Free allocation;
- 2,212 Neurons free-allocation reserve;
- stricter Vajefy ceiling: 8,500;
- 712 Neurons safety-ceiling reserve.

Current keyless judge candidates:

- English: `@cf/openai/gpt-oss-120b`;
- Persian: `@cf/zai-org/glm-4.7-flash`;
- pedagogical: `@cf/google/gemma-4-26b-a4b-it`;
- adversarial: `@cf/qwen/qwen3-30b-a3b-fp8`.

Calibration itself remains intentionally manual-dispatch-only. The currently
connected GitHub tool can inspect/rerun existing workflow runs but exposes no
`workflow_dispatch` action. Plugin discovery on 2026-10-06 found no alternate
GitHub Actions dispatch connector.

Do not weaken the inference guard with a push/schedule trigger merely to bypass
that tool limitation.

Authoritative resume point: dispatch
`.github/workflows/semantic-calibrate.yml` once per role from `main`.
Each dispatch performs all three frozen repeats, current pricing/budget check,
OIDC gateway preflight, strict calibration scoring and qualification recording.


## Checkpoint — keyless calibration execution boundary

Date: 2026-10-06.

The repository/runtime path is now complete through the calibration boundary:

- PR #97 free-budget gate is merged;
- full calibration upper bound is 7,788 Neurons for 84 requests;
- Cloudflare Workers Free allocation is 10,000 Neurons/day;
- current main post-merge CI is green;
- automatic exact-revision OIDC gateway smoke is green;
- no semantic API keys or repository variables are required;
- the qualification ledger is still empty;
- no semantic inference has been run.

The connected GitHub toolset was checked again and **does not expose
workflow_dispatch with inputs**. It can read workflow runs and rerun existing
jobs, but it cannot legitimately start the manual calibration workflow.

Do not weaken the inference boundary to work around that tooling limitation:

- do not add push/schedule/repository_dispatch inference triggers;
- do not create a temporary automatic calibration workflow;
- do not reintroduce API-key providers.

The next action is exactly four manual GitHub Actions dispatches from `main`:

1. English;
2. Persian;
3. pedagogical;
4. adversarial.

Workflow: **Semantic judge calibration and qualification**

For each dispatch set `acknowledge_inference=true`. The workflow itself
performs the current-budget check, OIDC preflight, three frozen repeats,
strict scoring and qualification recording.

After any role result exists, resume from that evidence. Do not repeat the
keyless architecture, calibration corpus, budget work, or workflow-dispatch
capability investigation.


## In-progress checkpoint — Workers AI Responses API extraction fix

Failed calibration run: `37473550090` (English).

What passed before the failure:

- frozen packet selection;
- current free-budget check: PASS;
- keyless GitHub OIDC gateway preflight: PASS.

Failure occurred on repeat 1, first target
`cal-en-clean-i` after the Workers AI model call:

`HTTP 502 {"error":"empty-model-content"}`

Root cause is transport-shape handling, not calibration quality. Cloudflare
GPT-OSS through the Workers AI binding returns the Responses API shape. The
gateway extractor handled legacy `response` strings and Chat Completions
`choices[].message.content`, but did not read Responses API
`output_text` / `output[].content[].text`.

Branch `codex/workers-ai-responses-extractor`:

- adds Responses API extraction;
- preserves legacy and Chat Completions extraction;
- ignores reasoning-only output as final text;
- adds safe diagnostics for status/incomplete_details/output types/usage;
- adds regression tests.

No calibration threshold or gold label changed. No qualification was recorded.
Do not rerun English until this fix is merged and deployed.


## In-progress checkpoint — structured response priority

English workflow `37473550090` was rerun after the Responses API extraction
and structured JSON changes reached production.

The rerun proved:

- current Neuron budget gate: PASS;
- keyless GitHub OIDC preflight: PASS;
- inference reached `@cf/openai/gpt-oss-120b`;
- failure moved to strict transport parsing:
  `cal-en-clean-i` was not seen as one JSON payload.

Cloudflare JSON Mode may return the validated object under `response` while
other Responses API representations are also present. The gateway previously
could serialize `response` and then append `output` / `output_text`,
creating multiple payloads.

Current branch `codex/workers-ai-structured-response-priority` now gives a
valid structured `criteria` response object/string strict priority and stops
before collecting alternate representations. Regression tests cover duplicate
structured representations plus noisy alternate output.

The downstream semantic schema, exact criteria requirements, frozen calibration
gold labels and promotion thresholds are unchanged.

Resume point: full CI -> merge -> exact production OIDC smoke -> rerun the same
already-authorized failed English workflow.


## Checkpoint — English Llama 3.3 70B rejected under frozen v1

English workflow `37473550090` was re-run (attempt 10, job `112401239923`)
after PR #107 deployed, checking out main at
`82038312e6e80b059ad1a69c1a3ef5cee8bd1162`.

- Neuron budget gate: PASS. Keyless OIDC preflight: PASS.
- Inference reached `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. All three
  repeats produced valid, schema-compliant output.
- Frozen v1 scoring: **DO NOT PROMOTE**. Defect recall 0.0%, clean
  false-positive rate 0.0%, clean uncertain rate 16.7%, abstain accuracy
  100.0%, expected-label stability 66.7%.

No repeat produced FAIL on a defect case's expected criterion. Overall FAIL
statuses on `cal-en-grammar-agreement` (repeats 2–3) and
`cal-en-sense-live` (repeat 1) do not count, because recall is measured on the
expected criterion. No qualification was recorded and no v1 threshold or gold
label changed.

English has now rejected GPT-OSS 120B and Llama 3.3 70B. The next English
candidate needs a fresh budget check, and v1 stays frozen.

## Status ledger — plan §41 item 12

`docs/A1_PLAN_STATUS.md` now holds the authoritative status ledger in the plan
§31 state model. It covers the §41 first package, the later phases, Gate 0 and
the scope deferrals. `npm run status:check` runs in `validate:data`. The CI
check job fetches full commit history and runs it with `--require-history`.

- The check fails on unknown states, malformed or unknown commits, a first
  commit that is not an ancestor of its completion commit, missing evidence
  paths, and unfinished rows without a note.
- GATE0-RIGHTS must be BLOCKED exactly while provenance has blockers.
- Every BLOCKED blocker in `progress.json` needs a matching BLOCKED row.
- P2-CALIBRATION cannot be claimed complete until all four roles are qualified.

`AGENTS.md` (with `CLAUDE.md` importing it) tells every session to read the
ledger first and update it in the same pull request as the work.

This file and `progress.json` remain the semantic-assurance handoff. The
ledger is where implementation state is decided.

## Completed — PR #108 status ledger

Merged as `dc47f1cfbc3da6a3b38ff61f2cb3d27c61005f23`. The ledger in
`docs/A1_PLAN_STATUS.md` is the authoritative implementation state.

## C1 ratchet and curriculum frontier — plan §41 items 3 and 5

- Every deterministic finding code is now bounded; a code missing from
  `content/assurance/deterministic-baseline.json` has a maximum of zero. A
  fixed defect fails CI until `npm run assurance:content:baseline` records it.
  That command only lowers maximums.
- New C1/C2 codes: `MALFORMED_UNICODE`, `BIDI_CONTROL`, `UNICODE_NOT_NFC`
  (all zero) and `PERSIAN_IN_ENGLISH` (4).
- New C3 codes: `FRONTIER_TASK_VOCABULARY` (5,341) and
  `FRONTIER_SCENE_VOCABULARY` (65). Every task in all 900 entries and every
  scene task is checked against the curriculum. Unit 1 has zero findings.
- 41% of entry-task frontier findings come from 30 high-frequency words placed
  late in the curriculum (do, not, can, please in Unit 12; to, at, for in
  Unit 7). The repair is tracked as `A1-FRONTIER-REPAIR`.

## Completed — PR #109 C1 ratchet and curriculum frontier

Merged as `cb789e6358128e9485e59eeed2b1a290cab5236e`.

## Example diversity and three-mode Practice — plan §41 items 6, 7 and 8

- `EXAMPLE_NEAR_DUPLICATE` (0) and `EXAMPLE_REUSED` (32) join the ratchet.
- Practice has three modes: Smart Practice, Listening and Spelling, all over
  studied words. Pairs, the sprint, meaning and cloze quizzes and the deck
  drills are removed with their components and 50 unused copy keys.
- XP no longer shows on Progress; the stored count is kept.

## Completed — PR #110 example diversity and three-mode Practice

Merged as `26ca377bd464ed7640603e0582169635614eea76`.

## A1-only loading and feature ledger — plan §41 item 9 and §30

- The service worker installs only the A1 course data (meta, `lex-a1.json`,
  enhanced index/order/audio-pack, `usefulness.json`), about 3.2 MB less.
  Higher levels and reference decks are cached on first use. An e2e test
  guards the first load.
- `docs/FEATURES.md` lists 19 features with measures and removal conditions;
  `npm run features:check` keeps it in step with the screens.

## Completed — PR #111 A1-only loading and feature ledger

Merged as `48168506acf43cce5524b69c8d0475040a615d42`.

## Machine Assurance Records and generation provenance — plan §41 items 10 and 11

- `content/assurance/records/A1.json`: one fail-closed record per A1 sense
  (1,027), bound to the semantic input hash judges sign. Criteria: Gate 0
  rights, generation provenance, schema, five deterministic groups, four
  semantic roles and audio per accent. Today 0 PASS, 20 UNCERTAIN, 1,007 FAIL.
  `npm run assurance:records` regenerates; `validate:data` checks freshness.
- `content/assurance/generation.json`: every A1 entry's content hash bound to
  its generator. Existing content is honestly `historical-unknown`; a content
  change fails CI until `npm run content:provenance -- --generator <id>`
  records a real generator.

With these, all twelve first-package items (plan §41) are DONE. Gate 0
rights remain BLOCKED on the owner. Automated repair (plan §8) may start.

## Completed — PR #112 Machine Assurance Records and generation provenance

Merged as `3bd542860f5a317caef30341a81c9132157e1b36`. All twelve
first-package items (plan §41) are DONE; Gate 0 rights remain BLOCKED.

## Pronunciation notation — plan Phase 1

The audio flag comparison now separates notation from pronunciation:
syllabic consonants, NEAR/CURE spelling, final happY and multi-form headwords
no longer flag. `generate_audio.py --rescore` re-checked the committed report
without the model: 292 flags became 174 (114 US, 60 GB, 123 senses). Real
differences (strong/weak forms, dropped sounds, vowel quality) still flag and
await audio certification (plan §12).

## Completed — PR #113 Pronunciation notation

Merged as `046eecb358f3cb3622fa558d29b900d533394f72`.

## Unattended judge calibration and qualification

The owner asked for calibration and qualification with no person in the loop,
at the highest quality the free allocation allows. There is no longer a manual
dispatch step. `content/assurance/semantic/AUTOMATION.md` has the full design.

- **Candidates.** Each role has free Workers AI candidates, strongest first.
  They were registered before any fallback produced results, and they are
  mirrored exactly in the Worker's allowlist. Paid-only models are excluded.
  Each candidate's token limit keeps its full v1 campaign at or under 8,500
  Neurons.
- **Planner.** The planner keeps qualified judges. For each other role, it
  activates the first candidate that is not rejected, is eligible, and uses a
  model family no other judge uses. Roles settle in order, so a later role
  never takes a weaker judge while an earlier role might still free a stronger
  family. Each run calibrates at most one role, and only if that role's
  campaign fits what the day's usage log leaves under the ceiling.
- **Outcomes.** Each campaign is scored against the frozen v1 gate. The
  candidate is then qualified (`qualified.json` and `results/`) or rejected
  (`rejected.json` with metrics). Model-output failures reject a candidate only
  after 3 attempts on 2 UTC days. Gateway faults never reject one.
- **Spending.** Attempts are charged at their upper bound. Measured Workers AI
  token usage is logged next to each charge. The rates and paid-only list are
  re-verified from Cloudflare's pricing page before each campaign. The check
  fails closed if the free allocation falls below the ceiling.
- **Seeded state.** English rejections: GPT-OSS 120B (no valid output, 900/900
  tokens) and Llama 3.3 70B (did not promote: 0.0% defect recall), both run
  37473550090. The 2026-10-06 allocation is reserved as spent, because that
  day's manual attempts were not measured.

Active judges are English Nemotron 3 120B, Persian Kimi K2.5, pedagogy
Gemma 4 26B and adversarial Qwen3 30B. Pedagogy and adversarial rank
Nemotron first, so they wait until English settles. Thresholds and gold labels
are unchanged.

## Completed — PR #114 Unattended judge calibration

Merged as `e2261f429eb08e10c6a100bb1fec512783e4d8d3`. Post-merge CI passed. The
gateway smoke test (run 37545667281) confirmed the deployed allowlist matches
the pre-registered candidates. The first scheduled campaign (English,
Nemotron 3 120B) runs on the `17 */6 * * *` schedule. Its outcome lands in
`content/assurance/semantic/calibration/`.

## Checkpoint — Unit 1 semantic packet identity scoped to Unit 1 inputs

PR #138 hardens semantic packet provenance without changing any semantic judgment or qualification threshold.

- The Unit 1 packet no longer embeds the global compiled-content build version.
- Its generation context remains derived from the exact Unit 1 target source state and prerequisites, with rubric/prompt hashes preserved.
- Reordering unrelated Units 4–12 therefore does not invalidate unchanged Unit 1 semantic evidence.
- Any change to Unit 1 source/prerequisites, rubric manifest or prompt/rubric versions still invalidates the packet as before.

Resume point: merge PR #138 after exact-head CI, then continue the existing P2 calibration/qualification automation. Do not regenerate Unit 1 semantic evidence merely because later A1 units move.

## Calibration: reasoning off, and fair turns

The first unattended runs (2026-10-07) showed two problems.

- **No answers.** English Nemotron 3 failed three times with
  `empty-model-content`: 1,200 of 1,200 completion tokens were spent
  reasoning, and no judgement was ever produced. Workers AI documents
  `chat_template_kwargs.enable_thinking` (on by default) for Nemotron 3,
  Gemma 4, GLM 4.7 Flash and Qwen 3.8. Those candidates now run with
  reasoning off. The `+no-thinking` suffix on `modelVersion` makes each one a
  new candidate. Kimi K2.5 and Qwen3 30B document no such switch and are
  unchanged.
- **Kimi K2.5 is really K2.6.** Persian finally ran on 2026-10-08. It returned
  no answer (700 of 700 completion tokens) and was charged 354.9 Neurons.
  That is Kimi K2.6's rate exactly; K2.5's would be 254.3. Cloudflare has
  served `kimi-k2.5` as the paid-only `kimi-k2.6` since 2026-05-30. The
  pricing page still lists K2.5 at its old rate, so the rates refresh could
  not tell. `servedBy` in `workers-ai-neuron-rates.json` now records the
  alias. The refresh prices K2.5 as K2.6, and the planner skips Kimi as
  `paid-billing-required`. Persian moves to GLM 4.7 Flash with reasoning off
  (≤ 1,014 Neurons).
- **Starvation.** English, first in role order, went first every day, and its
  failed attempts left too little of the day for Persian's 8,202-Neuron
  campaign. Among ready roles, the least recently attempted now goes first.

## Started — automatic repair loop (plan §8)

`src/lib/learn/repair-loop.ts` classifies every deterministic finding code as
field-only regeneration, a pure Unicode normalization, or immediate quarantine.
Unknown codes abstain and quarantine. Three failed attempts become
`QUARANTINED_AUTOMATICALLY`. A cleared field is `PENDING_REVERIFICATION`, not a
certificate and not a semantic PASS.

No learner-facing entry is rewritten. Regeneration is not executed, because no
model is authorized to invent teaching text from this loop. `npm run assurance:repair:check`
fails if `scripts/content-assurance.ts` emits a code the catalog does not cover.


## Contextual frontier repair — 2026-10-10

Codex (GPT-6) added 140 original Persian support glosses to 133 later-unit
entry/scene tasks. These are machine-authored teaching supports, not independent
semantic certificates. Task-frontier findings fell from 5,100 to 4,966 and
scene-frontier findings from 65 to 59; all other deterministic codes stayed
unchanged. The complete corpus has 9,994 findings.

All 180 source entries in frozen Units 1–3, the curriculum and the audio source
files remain unchanged. The non-promotable triage queue has 105 cases: 71 frozen,
2 context-sensitive gloss candidates and 32 requiring rewording or review. A
Persian gloss for `hardly` would answer the hard/hardly contrast task; glossing
`Pick ___` in isolation risks translating the entire tested pick-up expression.
Both therefore remain deferred. See
[the repair evidence](FRONTIER_CONTEXT_GLOSSES_2026-10-10.md).

Generated lessons, coach cases, real agent provenance, unverified rights
inventory/authorship hashes and fail-closed assurance records are refreshed.
The existing scheduled calibration ledgers remain authoritative: 0/4 judges
qualified. No threshold, gold label, active judge role or release gate changed.

PR #189 merged as `b00a9fa0f452333e9838e3470a1e188df8921dce` after full CI
(run 38012675795) and rollback rehearsal (38012675867) passed. PR #188
merged as `b6b43d82017648f49585ec31e43f555f96a73e5b`; its source authentication
and 360 staged drafts also passed full CI and rollback. Resume content repair
from the current triage queue and independent rights staging at rank 361;
do not repeat the 140 completed glosses.


## A1 reference and Review scope — 2026-10-10

P1-CHUNK-DECKS now uses a generated manifest of 853 unique reference notes
linked from 417 actual A1 catalogue entries. The Library is read-only in A1,
word details open exact note IDs, and direct links cannot expose unlinked
notes. A missing or invalid manifest fails closed. The manifest is installed
for offline use while full decks remain cached only when opened.

A1 enrolment rejects new reference and higher-level cards. Today, Learn and
Review count only A1 due cards; Review loads only their data. Mixed interrupted
reviews are archived with their queues and answer history intact, and existing
reference/higher-level cards remain saved. Higher-level behaviour is unchanged.
The public manifest has conservative UNVERIFIED lineage; no rights evidence
or semantic qualification was invented.

Unit and browser regressions cover manifest integrity, new enrolment, due
scope, exact note links, failed loading, higher-level compatibility and
preservation of a mixed interrupted review. PR #190 merged as
`bf0f19f444066424d367cc8b67cccc4904dc4146` after full CI 38019526492
(535 unit tests and all 95 browser tests), Workers contract and rollback
38019526393 passed. P1-CHUNK-DECKS is DONE; this follow-up records its actual
completion merge in the A1 ledger. Do not repeat the reference scope work.


## Later-unit language field repairs — 2026-10-10

All four Persian-in-English findings have been repaired in too, miss, hard
and afraid (actual course Units 4, 7, 10 and 11). Intended meaning explanations
now occupy the Persian notes; three mistake pairs have six literal translations,
and afraid has a Persian grammar-position explanation. These are Codex (GPT-6)
authoring changes without independent semantic certificates.

The complete deterministic corpus fell from 9,994 to 9,983 findings: Persian
in English 4 → 0, missing wrong/right Persian translations 1,007 → 1,004 each,
and grammar notes lacking Persian 943 → 942. No other code increased. All 180
frozen Units 1–3 source entries, audio, curriculum and scene sources are unchanged.
Generated content, coach cases, agent provenance, current UNVERIFIED rights
derivative names/authorship hashes and assurance records are refreshed. See
[the field repair evidence](LANGUAGE_FIELD_REPAIRS_2026-10-10.md).

PR #191 merged as `9556da47a635d706ede0bb794de9cd1f9d0643ed`. Its final head incorporated the scheduled
calibration commits through `6b731cb517f71c89b761dc014de6b5f261687d20`;
full CI 38043997584 passed 535 unit and all 95 browser tests, the Workers
contract passed, and rollback rehearsal 38043997585 passed. Both progress
files record the actual merge. The earlier PR #190 browser selector correction
scoped the Library search without weakening assertions; its final rerun passed.

## Latest calibration and audio evidence — 2026-10-10

English has exhausted its preregistered v1 candidates; its selected Llama 3.3
placeholder is not qualified or eligible for repeated inference. Latest English
Llama 4 Scout run 37936744749.1 was rejected with defect recall 0. Persian
Qwen 3.8 +no-thinking run 38029252396.1 was rejected with defect recall 8/9,
abstain accuracy 0 and expected-label stability 5/6. The planner now selects
Persian Mistral Small 3.1, pedagogy Nemotron 3 +no-thinking and adversarial
Qwen3 30B. These are selected candidates, not certificates. Qualification is
still 0/4. Continue through the authorised free-allocation schedule; never
hand-edit active roles, bypass the planner or change frozen v1 gold/thresholds.

Committed audio remains PARTIAL: 328/386 certified, 58 quarantined and 0
uncertain (generated 2026-10-09T02:12:38.939688Z). Scheduled run 38043072498
completed successfully by skipping a duplicate certification attempt, so it
provides no new listening/certification evidence and changes no audio count.
The strict 386/386 release gate remains unchanged.

## English: two candidates appended — 2026-10-10

English had rejected all four of its v1 candidates:
- Llama 3.3 70B did not promote;
- Nemotron 3 with reasoning off: defect recall 2/3;
- Mistral Small 3.1: defect recall 0;
- Llama 4 Scout: defect recall 0.

GPT-OSS 120B was rejected earlier for giving no valid output.

The scorer counts a defect only when the seeded criterion is marked FAIL, as the
frozen manifest says, and every rejected campaign had full schema compliance.
These are model misses, not transport failures.

Two free candidates are appended to the end of the English list. The earlier
order is unchanged:
- Gemma 4 26B (`google-gemma`, reasoning off, 800 tokens, ≤ 1,212 Neurons per campaign);
- GLM 4.7 Flash (`zhipu-glm`, reasoning off, 800 tokens).

Neither has been calibrated for English; GLM's Persian rejection is a different
role. Qwen models stay off the English list while the adversarial judge holds
the Qwen family. Other free text models were left off: QwQ 32B and the DeepSeek
R1 distill are reasoning-only, and GPT-OSS 20B is the sibling of the rejected
GPT-OSS 120B. v1 thresholds and gold labels are unchanged.

The new allowlist reaches the Worker with the next deploy of `main`. The next
scheduled run that fits the daily ceiling calibrates English with Gemma 4.

PR #193 merged as `571f7f9c243869de797f3bdf6b60994ca278effb` after check,
browser, Workers build contract, Workers Builds and rollback rehearsal passed.

## Mistake-pair translations, Units 4–6 — 2026-10-10

All 279 senses in course Units 4–6 now have Persian lines under both the
mistake and its correction. Membership comes from `content/curriculum/A1.json`.
`rightFa` is a natural translation. `wrongFa` takes one of two forms:
- the intended meaning (`منظور: …`) plus a short clause naming the English error;
- a literal reading (`ترجمهٔ تحت‌اللفظی: …`) when the wrong word changes the
  meaning.

Missing pairs fell from 1,004 to 725 each. Total findings fell from 9,983 to
9,425. No other code changed, and the baseline was lowered to these counts.
Frozen Units 1–3, audio, curriculum and scenes are unchanged.

The following were regenerated: compiled content, agent provenance, hashed
public chunk names in the rights lineage, the authorship map and the records.

This is deterministic coverage with no semantic certificate. See
[the evidence](MISTAKE_TRANSLATIONS_2026-10-10.md).

Next: Units 7–12, with the same pattern and in unit order.

PR #194 merged as `2853619dcb273e46cb5067bba6b11b54f6199139` after check,
browser, Workers build contract, Workers Builds and rollback rehearsal passed.
Codex found three overstated lines: emphatic *very much*, *product* for a
harvest, and an ungrammatical gloss for *share*. All three were fixed, and an
audit softened ten more before the merge.

## Mistake-pair translations, Units 7–12 — 2026-10-10

The remaining 552 senses in course Units 7–12 now have both Persian lines, in
the same pattern. Before applying them, the drafts were audited for the faults
found in #194, and 17 lines were softened where the "wrong" sentence is
acceptable but less usual.

Missing pairs fell from 725 to 173 each, and total findings from 9,425 to
8,321. No other code changed, and the baseline was lowered to match.

The 180 frozen Units 1–3 entries were verified byte-identical. The 173
remaining pairs are all in them, so changing them needs an owner decision on
the frozen study and audio scope.

PR #195 merged as `d7635deabe4d6a71f4cfb871c27c48a1510fa3d5` after check,
browser, Workers build contract, Workers Builds and rollback rehearsal passed.
Codex found two literal readings that ignored context (*a paper to write on*,
*happy for my new job*). Both were fixed, and an audit corrected eight similar
lines before the merge.

## Usage notes for later-unit function words — 2026-10-10

All 61 function-word senses in Units 4–12 (prepositions, conjunctions,
pronouns, determiners, modals, particles) now have a Persian `usage` note. Each
note adds a contrast, register point, fixed phrase or tense form, and does not
repeat the meaning or mistake. Five drafts were softened for overstated rules
before applying.

`USAGE_REQUIRED` fell from 97 to 36, and total findings from 8,321 to 8,260.
The 36 left are in frozen Units 1–3. See [the evidence](USAGE_NOTES_2026-10-10.md).

PR #196 merged as `adab88e599209452eb92d785ec4f1eeb1e6651b7` after check,
browser, Workers build contract, Workers Builds and rollback rehearsal passed.
Codex found five notes that stated a tendency as a rule: *both*/*neither*,
the comma before *but*, *next to*, *between* and *under*/*below*. All five were
fixed before the merge.

## Persian explanations for later-unit grammar notes — 2026-10-10

781 grammar notes in Units 4–12 held only English examples. Each now opens with
a short Persian explanation of what the pattern does, and the English examples
follow unchanged. Seven drafts were softened or corrected for absolute claims
before applying.

`PERSIAN_GRAMMAR_NOTE` fell from 942 to 161, and total findings from 8,260 to
7,479. The 161 left are in frozen Units 1–3. See
[the evidence](GRAMMAR_NOTES_2026-10-10.md).

PR #197 merged as `e9bb980c45973ff92e4cf60ee66bdf87cdbc415c` after check,
browser, Workers build contract, Workers Builds and rollback rehearsal passed.
Codex found the *-ing* adjectives described as things-only and *a box of*
restricted to plurals. Both were fixed, and five similar notes were corrected
before the merge.

## Persian reasons for later-unit answer feedback — 2026-10-10

758 check feedback lines in Units 4–12 held only an English fragment that
repeated the answer. Each now opens with a short Persian reason for why that
answer is right, and the English fragment follows unchanged. Five drafts were
softened for absolute claims before applying.

`PERSIAN_CHECK_FEEDBACK` fell from 872 to 114, and total findings from 7,479 to
6,721. The 114 left are in frozen Units 1–3. See
[the evidence](CHECK_FEEDBACK_2026-10-10.md).

## 2026-10-10 — Later-unit frontier task rewording

- PR #198 (answer feedback) merged as `f1f1842`.
- The 34 later-unit tasks left in the frontier triage queue were reworded with
  vocabulary taught by their frontier. They were 32 needing rewording or
  review, plus the deferred *hardly* and *pick up* gloss candidates. The
  generator is `claude-code-2026-10-10-frontier-rewording`.
- Task-frontier findings fell 4,966 → 4,897, scene-frontier 59 → 47, and
  total findings 6,721 → 6,640. The baseline was lowered and no other code rose.
- The triage queue is 71, all in frozen Units 1–3. The remaining task
  findings need core-word promotion into the frozen roster, which is an owner
  decision.
- Evidence: `docs/FRONTIER_REWORDING_2026-10-10.md`. There is no semantic
  certificate.

## 2026-10-10 — NGSL ranks 361–440

- PR #199 (frontier rewording) merged as `52f1429`.
- Four new original English/Persian staging batches cover NGSL ranks 361–380,
  381–400, 401–420 and 421–440, written by Claude Code in this session.
  Staging now holds 440/900 drafts and 880 paired examples in 22 contiguous
  batches.
- Each lesson scopes one sense explicitly. Usage notes were hedged before
  writing (*usually*, *in this sense*), the fault review found in earlier PRs.
- 25 short examples that exactly matched a sentence already in the course
  (for example *Someone is at the door.*) were replaced, so no new example
  repeats course or earlier draft text.
- `assurance:ngsl:drafts:check` and the review-packet integrity check pass.
  Every approval, rights and release count stays zero.

## 2026-10-10 — NGSL ranks 441–520

- PR #200 (ranks 361–440) merged as `a12621c` after review fixes that kept
  every example in its lesson's declared sense.
- Four more original staging batches cover ranks 441–520. Staging now holds
  520/900 drafts and 1,040 paired examples in 26 batches.
- This time each example was checked against its lesson's sense while
  drafting. Rank 478 keeps the source's literal lemma `TRUE`, a spreadsheet
  artifact in the pinned CSV, and its usage note explains the casing.
- 19 example lines that repeated a course sentence were rewritten. One
  Persian line that tripped the nine-token overlap guard was also rewritten.
  After review, the exact comparison was widened to every legacy string in
  `public/data/` and `content/`. That rewrote 11 more examples, three of them
  in the merged ranks 361–440, so ranks 361–520 have no exact legacy match.
  Seven matching lines remain in another agent's ranks 1–360 (ranks 8, 10,
  36, 63, 66 and 290) and wait for an owner decision.
- Every approval, rights and release count stays zero.

## 2026-10-10 — NGSL ranks 521–600

- PR #201 (ranks 441–520) merged as `ed9dc05` after review fixes: a month
  translated as Gregorian, and every exact legacy match removed.
- Four more original staging batches cover ranks 521–600. Staging now holds
  600/900 drafts and 1,200 paired examples in 30 batches.
- Each example was checked against its lesson's sense and part of speech
  while drafting. Rank 522 `accord` teaches *according to*, the use that
  gives it its frequency.
- The exact comparison against all ~95,000 legacy strings ran before the PR.
  It rewrote 9 matching lines, and 3 examples caught by the nine-token guard
  were also rewritten. Ranks 361–600 have no exact legacy match.
- Every approval, rights and release count stays zero.

## 2026-10-10 — NGSL ranks 601–680

- PR #202 (ranks 521–600) merged as `d5f0439`. Review fixes corrected a
  definition that contradicted its example and two phrasing errors.
- Four more original staging batches cover ranks 601–680. Staging now holds
  680/900 drafts and 1,360 paired examples in 34 batches.
- While drafting, each example was checked against its lesson's sense and
  each definition against its examples. Two examples were reworded: *private
  school* (privately run) and intransitive *relate to*.
- The exact legacy comparison rewrote 14 lines in 12 examples before the PR.
  Ranks 361–680 have no exact legacy match.
- Every approval, rights and release count stays zero.

## 2026-10-10 — NGSL ranks 681–760

- PR #203 (ranks 601–680) merged as `11781e3`. Review fixes corrected a
  Persian meaning shift (*met* translated as "saw") and two examples outside
  their declared sense.
- Four more original staging batches cover ranks 681–760. Staging now holds
  760/900 drafts and 1,520 paired examples in 38 batches.
- The pre-PR self-review now also checks each Persian line for meaning
  shifts in tense, verb choice and nuance. It fixed four lines. The
  ambiguous *old teacher* was reworded.
- The exact legacy comparison rewrote 9 lines in 8 examples. Ranks 361–760
  have no exact legacy match.
- Every approval, rights and release count stays zero.

## 2026-10-10 — NGSL ranks 761–840

- PR #204 (ranks 681–760) merged as `0d203e9`. Review fixes replaced
  *rainy season* and the adverbial *lives alone*, and corrected «تمام شب»
  to «تمام عصر» for *all evening*.
- Four more original staging batches cover ranks 761–840. Staging now holds
  840/900 drafts and 1,680 paired examples in 42 batches.
- The pre-PR self-review made 15 edits. They included tense and nuance
  shifts in Persian, two over-absolute usage notes (*solution to*, *attend*), a
  *village* definition that called a village a town, and two *loss*
  examples outside their declared sense.
- The exact legacy comparison rewrote 19 lines in 13 examples. Ranks
  361–840 have no exact legacy match.
- Every approval, rights and release count stays zero.

## 2026-10-10 — NGSL ranks 841–900 (staging complete)

- PR #205 (ranks 761–840) merged as `77efc69`. Review fixes covered
  emphatic *yourself*, a profit-only *investment* definition, *fur*
  translated as «پوست», a stray ezafe in «پایین‌تر از», *worth seeing* and
  *close the computer*.
- Three more original staging batches cover ranks 841–900. Staging now
  holds all **900/900 drafts** and 1,800 paired examples in 45 batches.
- Before the PR, each example was checked against its declared sense, each
  definition against its examples, and each Persian line against its English.
  Ten lines changed:
  - an idiomatic *take a seat* was replaced with a noun-sense *seat*;
  - an informal *theory* example was replaced;
  - *fly* now defines travel by plane as well;
  - three other examples were replaced;
  - four Persian renderings were tightened.
- The exact legacy comparison rewrote 10 lines in 8 examples. Ranks
  361–900 have no exact legacy match.
- Every approval, rights and release count stays zero. The next NGSL step
  is independent review, which needs a real reviewer.

## 2026-10-10 — A1 rebuild on CEFR-J A1 (phase 1)

- PR #206 (ranks 841–900) merged as `9655057`, completing NGSL staging at
  900/900 drafts.
- The owner stated that only the headword list came from the Oxford
  workbook, and that ChatGPT wrote everything else without Oxford text as
  input. The owner chose to replace the headword list with every CEFR-J 1.5
  A1 headword, using NGSL for order and attribution, and to unfreeze
  Units 1–3. The statement is kept verbatim in the owner attestation.
- `npm run assurance:a1:cefrj` builds and checks the selection (inside
  `validate:data`): 1,066 headwords, 728 already taught, 338 new, 171
  current entries retire. Plan: `docs/A1_CEFRJ_REBUILD.md`.
- No rights are cleared and no lesson is approved. Gate 0 stays BLOCKED.

## 2026-10-10 — whole-app level placement

- PR #207 (A1 selection) merged as `af0cc6d`. Review fixes kept CEFR-J words
  apart by capitals (May ≠ may) and bound the owner statement verbatim.
- The owner asked to "Do for all words in the app". Every CEFR-J (A1–B2) and
  Octanove (C1–C2) word goes to its lowest level, the app's levels become
  A1–C2 (B2+ merges into B2, C2 added), and no current word drops out.
- `npm run assurance:levels` (inside `validate:data`) builds the placement:
  8,649 listed words, 4,258 new to the app. Of the 5,322 current entries,
  1,961 stay, 2,798 move and 563 are owner-kept outside the lists.
- The A1 selection now reports 166 entries moving up and 5 owner-kept,
  instead of 171 retired.
- No rights are cleared. Gate 0 stays BLOCKED.
