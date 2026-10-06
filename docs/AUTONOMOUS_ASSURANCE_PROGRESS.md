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
