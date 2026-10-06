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

- Main at start of this slice: `b8da6dcfd154df32082157f26ebd084944bc01b9`
- Roadmap: `docs/AUTONOMOUS_ASSURANCE_PLAN.md`
- Current branch: `codex/unit1-autonomous-certification`
- Current objective: repair and deterministically certify A1 Unit 1 (`01-introductions`).

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

1. Repair Unit 1 grammar-note Persian.
2. Add pedagogically distinct third examples where required.
3. Repair identical wrong/right Persian mistake translations.
4. Add usage guidance where the deterministic rule requires it.
5. Add a Unit 1 zero-defect gate.
6. Rebuild and commit derived learning artifacts.
7. Pass generated-content consistency, `validate:data`, typecheck, lint, unit tests, production build, Playwright and Workers build contract.
8. Merge.
9. Update this ledger with the merge commit and the next unrepeated objective.


## In-progress checkpoint — Unit 1 certification

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

Current resume point: **final exact-head CI for PR #84**. Do not regenerate Unit 1 source content or derived artifacts again unless CI reports them stale or a later source edit changes them.

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

Current resume point: **final exact-head CI for PR #84**. Do not rerun Unit 1 audio generation unless content or CI proves the manifests are stale/incomplete.

## Checkpoint — version-bound derived artifacts refreshed

After controlled audio became complete, `validate:data` advanced to a stale `content/coach-eval/cases.json` snapshot. The safe content-derived artifacts were refreshed without modifying review decisions, release state, audit baselines or learner evidence.

Generated commit: `41689afc9000b80fc7d9355bb77c9a2321faa77d`.

Refreshed writers:

- `npm run coach:cases`;
- `scripts/reference-notes.ts build`;
- `scripts/build-usefulness.mjs`.

The temporary workflow was removed in `598e14b0a09cd2db9e82dbea533415324ba425de`.

Current resume point: **exact-head CI for PR #84**. Do not regenerate these artifacts again unless a source edit or CI explicitly reports them stale.

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

Current resume point: validate this foundation in CI, merge it if green, then produce independent Unit 1 judge evidence without editing the deterministically certified source content.

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

Current resume point: CI/merge this infrastructure, then resolve actual independent model endpoints before producing evidence. Do not rebuild the packet unless source/rubric/prompt drift makes its CI check fail.

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

Current resume point: full CI/merge this hardening branch. After merge, actual judge execution remains blocked only on selecting/connecting explicit independent model endpoints; do not repeat packet, runner or ingestion infrastructure.

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

No model inference has been run. Current resume point: CI/merge this slice, then wait for explicit endpoint configuration/authorization before evidence execution.


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

Current resume point: CI/merge this zero-cost provider slice, then configure the
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

Current resume point: full CI/merge this branch. After merge, configure the free
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

Current resume point: inspect free credential/variable availability, run
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
