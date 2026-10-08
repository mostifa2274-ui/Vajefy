# Unattended judge calibration and qualification

Updated: 2026-10-06

The four semantic judge roles (English, Persian, pedagogical, adversarial)
calibrate and qualify without a person in the loop. The automation uses free
Workers AI models only and never spends more than the free daily allocation.

The owner authorized this on 2026-10-06 in
[`automation.json`](automation.json). Setting `enabled` to `false` there
stops all scheduled calibration. A manual dispatch still plans, but runs
nothing while the automation is disabled.

## What runs, and when

[`semantic-calibrate.yml`](../../../.github/workflows/semantic-calibrate.yml)
runs at 17 minutes past every sixth hour (UTC). It can also be dispatched by
hand from `main`. Each run does these steps in order:

1. **Plan, offline.** `npm run assurance:semantic:automation -- plan` picks an
   active judge for every role and at most one calibration campaign to run.
   It stops here if every role is qualified or the day's ceiling is used up.
2. **Re-verify rates.** `npm run assurance:semantic:rates:refresh` reads
   Cloudflare's pricing page. It updates each candidate's Neuron rates and
   paid-billing status. It fails, and nothing runs, if the page cannot be read
   or the free allocation no longer covers the ceiling.
3. **Plan again** on the verified rates, then run the budget gate
   (`budget:current`) and the no-inference OIDC preflight.
4. **Reserve.** The run charges the campaign's full Neuron upper bound to
   today and pushes that reservation to `main`. If the push fails, no
   inference runs.
5. **Calibrate.** Three isolated repeats run against the frozen
   `vajefy-semantic-v1` packet. A failed repeat stops the campaign, so no more
   of the allocation is spent.
6. **Record.** `npm run assurance:semantic:automation -- record` scores the
   repeats against the frozen thresholds and records one of these outcomes:
   - **qualified**: the candidate passed every threshold. It is written to
     `calibration/qualified.json` and its report to `calibration/results/`.
   - **rejected**: the candidate missed a threshold. It is written to
     `calibration/rejected.json` with its metrics.
   - **failed**: no complete campaign ran. The attempt is logged, and the
     candidate is tried again on a later run.
7. **Commit.** `scripts/semantic-calibration-commit.sh` runs the semantic
   checks and commits only the automation's own records to `main`.

## Choosing judges

Each role has pre-registered candidates in
[`keyless-provider-presets.json`](keyless-provider-presets.json)
(`candidates`), strongest first. The Worker's allowlist in
`src/api/semantic-gateway-config.ts` must match the list exactly. The gateway
smoke test checks the deployed allowlist after every push to `main`.

For each role that is not yet qualified, the planner activates the first
candidate that meets all of these conditions:

- it is not rejected for that role, model version, token limit, prompt version
  and rubric version;
- it needs no paid billing, and its full campaign fits the 8,500-Neuron daily
  ceiling;
- no other active judge uses its model family.

A qualified role keeps its judge.

Roles are settled in order: English, then Persian, pedagogical and adversarial.
A role waits while an earlier role might still free a stronger model family
for it. For example, pedagogy and adversarial rank Nemotron first. English
holds Nemotron, so both wait until English qualifies or rejects it. This keeps
the pre-registered order, so the strongest judge each role can get is the one
it gets.

Among the roles that are ready, the one attempted least recently goes first.
A role that keeps failing then cannot take every day's allocation while a
larger campaign never fits. Persian's 8,202-Neuron campaign waited two days
behind English's failed attempts until this rule was added.

### Reasoning off

Nemotron 3, Gemma 4, GLM 4.7 Flash and Qwen 3.8 reason before answering by
default. On 2026-10-07, Nemotron 3 used all 1,200 output tokens reasoning on
three runs and returned no answer. A judge on the free budget has to answer
directly, so these candidates run with `chat_template_kwargs.enable_thinking`
off. Their catalog entries document that switch. The `+no-thinking` suffix on
`modelVersion` records this, so a reasoning-off candidate is a different
candidate from its reasoning-on version: earlier failures do not count
against it. No judgement from any of them had been seen, and the candidate
order did not change.

Do not edit `roles` in the presets by hand. CI fails unless `roles` is exactly
what the planner selects. Run
`npm run assurance:semantic:automation -- plan` to update it.

## Spending only the free allocation

- Workers AI gives 10,000 free Neurons per day, reset at 00:00 UTC. Vajefy's
  ceiling is 8,500.
- Every candidate's campaign has a deterministic upper bound in
  `calibration/v1/neuron-budget.json`: each UTF-8 byte counts as one token,
  plus 512 tokens per request, with output at the token limit.
- [`calibration/automation-log.json`](calibration/automation-log.json) charges
  each attempt to its UTC day. Before inference starts, the full campaign is
  reserved on `main`. The record then replaces the reservation with the
  attempt's own charge:
  - a finished repeat is charged its full upper bound;
  - a failed repeat is charged the most its sent requests could cost;
  - a repeat that stopped without a record is charged in full.

  If the record is lost, the reservation stays, so a later run cannot spend the
  same allocation twice.
- The gateway reports the token usage Workers AI measured, and the log keeps
  it next to the charge. The charge, not the measurement, decides whether the
  next campaign fits.
- Manual runs of `semantic-judge.yml` (Unit 1 judging) use the same allocation
  and are not in this log. Run them only on a day the log leaves room for.

## Failures

The runner records whether the model's output or the gateway failed:

- **Model failures.** No content, invalid JSON, wrong criteria, or an empty
  final answer. A candidate is rejected as `no-valid-output` after 3 such
  attempts on at least 2 UTC days (`failurePolicy`).
- **Gateway failures.** Authentication, capacity, the allocation running out,
  network faults, or an interrupted repeat. These never reject a model. The
  run turns red so that a repeated fault is visible, and later runs try again.

## When a person is still needed

- A role runs out of candidates. Its `status` becomes `exhausted`, and the
  planner reports `candidates-exhausted`. Pre-register a new candidate in the
  gateway allowlist and the presets, or create a new calibration version.
  Do not change v1's thresholds or gold labels.
- Adding or removing a candidate changes the Worker, so it goes through a
  pull request and a deploy.
- Unit 1 judging (`semantic-judge.yml`) stays a manual dispatch with explicit
  acknowledgement. Calibration does not judge course content.
