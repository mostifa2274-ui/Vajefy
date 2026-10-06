# A1-first plan: status

> **Autonomous-assurance migration started 6 October 2026.** The implementation roadmap is [AUTONOMOUS_ASSURANCE_PLAN.md](AUTONOMOUS_ASSURANCE_PLAN.md). Human review is no longer the intended routine release gate; machine certification will replace it in staged PRs. Current human-review counts below remain historical baseline evidence until the qualification pipeline is migrated.

## Autonomous assurance migration

| Item | State | Evidence |
|---|---|---|
| Gate 0 provenance manifest | IN_PROGRESS | `content/assurance/provenance.json` exists; current Oxford-derived source intentionally remains `unverified` |
| Fail-closed assurance schema | IN_PROGRESS | `src/lib/learn/assurance.ts` defines PASS/FAIL/UNCERTAIN/DISAGREEMENT/QUARANTINED and machine-assurance records |
| Deterministic A1 assurance audit | IN_PROGRESS | `scripts/content-assurance.ts` reports structural/Persian/mistake/example/usage defects without pretending the current corpus is certified |
| Autonomous semantic judges | NOT_STARTED | English, Persian, pedagogical and adversarial judges still to be implemented |
| Audio certification | NOT_STARTED | Existing heuristic remains provisional |
| Autonomous UX agents | NOT_STARTED | Existing Playwright/axe remains the foundation |
| Machine-certified release qualification | NOT_STARTED | Existing human approval gate remains active until replacement evidence is complete |

This file tracks the A1-first product plan (4 October 2026) against the
repository. Each stage and gate item is marked as one of:

- **Done**: implemented and tested, with the pull request or file that shows it.
- **Open (machine)**: work that code or content tooling can still do.
- **Human**: work only people can do, such as review approvals, listening to
  clips, device sessions or learner studies.

The status is as of 5 October 2026. Nothing here is a reviewer approval, a
listening result, a device result or a learning outcome. Where a script reports
readiness, that is machine readiness only.

## Where things stand

| Item | Plan baseline (4 Oct) | Now |
|---|---:|---:|
| A1 entries with enhanced teaching | 650 / 900 | 900 / 900 |
| Enhanced senses | 758 | 1,027 |
| Curriculum units mapped (entries) | — | 12 (900 / 900) |
| Units machine-ready for human review | — | 12 / 12 |
| Units release-qualified (current approvals) | — | 0 / 12 |
| Entries released | 0 | 0 |
| Recorded review decisions (`content/pilot/review.json`) | — | 0 |
| Generated audio clips | 4,286 (≈ 36.8 MB) | 5,850 (≈ 50.2 MB) |
| Word clips flagged for listening | 211 | 292, across 183 senses |

Sources: `npm run curriculum:status`, `npm run content:qualification`,
`npm run content:review-queue -- --scope all-a1`,
`content/pilot/audio-manifest.json` and `content/pilot/audio-report.json`.

| Stage | Machine work | Human work |
|---|---|---|
| 1. Protect learning records | Done | None required to exit |
| 2. Unify the learning flow | Done | None required to exit |
| 3. Establish the A1 standard | Done | Pending: no approvals recorded yet |
| 4. Prove the pilot experience | Mostly done; scene comprehension tasks open | Pending: device, usability and learning sessions |
| 5. Complete A1 | Structurally done (900 / 900, all units machine-ready) | Pending: approvals, listening and scene review |
| 6. Qualify the A1 release | Partly done; production configuration open | Pending: device matrix and sign-off |

## Product decision

- **Done**: new learners start the A1 course only. Onboarding no longer offers
  higher levels or the placement check (#76). Higher-level data, and learners'
  existing progress and saved levels, are unchanged.
- **Done**: lessons follow the A1 curriculum (#77). Unit 1 to Unit 12, each word
  after its prerequisites, for every learning goal. A word's further senses come
  one unit later. Learn shows the current unit.

## Stage 1: protect progress and offline access

- **Done**: F1 and F2 were resolved in #21.
  - Failed journal operations stay visible, exportable and retryable.
  - The save indicator covers startup replay.
  - An offline release activates only when complete, and the last complete
    release survives an interrupted update.
  - Fault tests cover quota failures, closing mid-answer, partial downloads and
    open tabs. See [PROGRESS_STORAGE.md](PROGRESS_STORAGE.md) and the offline
    section of [OPERATIONS.md](OPERATIONS.md).

## Stage 2: one target, one plan

- **Done**: one daily plan (`src/lib/learn/planner.ts`) decides new words for
  Today, Learn and Review (#22). It respects the daily allowance, session time
  and review backlog.
- **Done**: Smart Practice uses senses (#22). Additional senses keep their own
  evidence.
- **Done**: streaks survive undo, and progress labels are honest (#23).
- **Done**: calendar days use the learner's local date (`todayKey`).
- **Done**: the shared target interface. Each entry carries its stable ids,
  meaning, prompts, accepted forms, content version, release status, audio, and
  now its curriculum unit and prerequisites (#77).
- **Done**: each skill is recorded separately: recognition, typed form recall
  (`spelling`), listening, context and productive use (#22, #23, #78).
- **Done**: practice modes are disclosed progressively. Smart Practice is the
  main action and the other modes are folded away.
- **Done**: F6 no longer arises, because new learners no longer get a
  higher-level onboarding (#76).

## Stage 3: the A1 standard

**Done:**
- The curriculum: 12 practical units covering all 900 entries, with explicit
  prerequisites (#26, #37, #40, #42–#50, #53–#56). See
  [A1_CURRICULUM.md](A1_CURRICULUM.md).
- A sense-level coverage matrix (#41).
- The 20-entry calibration slice, with prerequisite-safe tasks, Persian
  scaffolds and a strict language audit (#25, #26, #28–#36, #38, #39).
- Version-bound review tooling:
  - review queue (#51) and reviewer packets (#71);
  - approvals tied to exact content versions (#52);
  - unit qualification gates (#57, #58);
  - every unit machine-ready (#59–#70).
- Held-out assessment, reserved from teaching (#24), with a version-bound
  assessment bank (#72).
- Study export and analysis provenance (#73) and a frozen roster (#74).
- The study is redefined around Units 1–3, 180 entries (#77). Lessons now follow
  the curriculum, so the original 150-entry selection no longer matches what
  learners meet first. Its review gate is `--scope study`.

**Human:**
- Review the 20-entry calibration slice: bilingual and pronunciation decisions
  for each entry's current version, corrections, then re-review.
- Approve the study's 180 entries (`npm run content:review-queue -- --scope study --packet`).

## Stage 4: the lesson and the pilot

**Done:**
- The lesson sequence (#78), for each word:
  - teach;
  - written retrieval: type the English from its Persian meaning;
  - listening: the recorded clip without its spelling, with a skip when the
    learner cannot hear it;
  - context;
  - feedback that reteaches, with one prompted retry;
  - delayed retrieval, which starts the schedule.
- Readiness for now ("unaided", "with help", "needs another try") is shown
  apart from long-term mastery ("Settled").
- The teaching card plays the model when it appears, after the learner's own
  press, with replay, slower playback and an autoplay switch. The switch is a
  mute control, remembered on the device.
- Restrained disclosure. Grammar, notes and contrasts appear in the lesson or on
  request; the daily workload shrinks as reviews accumulate.
- Speaking practice records the learner and compares with the model, without
  automatic scoring.
- Automated accessibility (axe, WCAG 2.2 AA) and lab performance budgets run in
  CI ([ACCESSIBILITY.md](ACCESSIBILITY.md), [PERFORMANCE.md](PERFORMANCE.md)).

**Open (machine):**
- Scenes need real comprehension tasks, not only recognition of the taught
  word, and more scenes against the coverage matrix. This is content authoring
  that then needs review.

**Human:**
- Device and manual accessibility sessions: TalkBack, VoiceOver, keyboard and
  enlarged text.
- 5–8 observed usability sessions. Report the counts and obstacles.
- Before the main pilot, record numeric learning thresholds. The decision rules
  in [EVALUATION.md](EVALUATION.md#decision-rules) are proposals until then.
- The 30-day delayed-learning pilot, run with `npm run study:roster` and the
  roster checks.

## Stage 5: all 900 entries

**Done:**
- Batches 7–9 were written with audio (#18–#20), so 900 / 900 entries have
  enhanced teaching.
- Every unit passes the machine-readiness gate (#70): content, three or more
  authored checks, audio in both accents, and prerequisites.

**Open (machine):**
- Scene coverage across the units, as in Stage 4.

**Human:**
- Revisit all entries under the calibrated standard.
- Record approvals for all 900.
- Listen to the 292 flagged word clips and resolve them or explicitly accept
  them.
- Compare the provisional voices with Persian learners.
- Review only the reference notes relevant to the A1 path.

## Stage 6: qualify the release

**Done:**
- The smoke check and workflow: `scripts/smoke.mjs` and `.github/workflows/smoke.yml`.
- Opt-in error reporting tagged with the deployed commit.
- Safe offline updates and recovery.
- The content channel switch: `VITE_CONTENT_CHANNEL=draft|released|none`.
- `/api/version` reports the deployed revision and content channel. The smoke
  check reports both. It fails when they differ from `--expect-channel` or
  `--expect-revision`, or from the repository variable `CONTENT_CHANNEL` in
  the scheduled workflow.

**Open (machine or configuration):**
- **The production channel must be chosen explicitly.** The build defaults to
  `draft`. No entry is released yet, so a `released` build would have no
  lessons. The production setting is a release decision for the owner. Set it
  in the Cloudflare build variables, and set the matching `CONTENT_CHANNEL`
  repository variable so the smoke check enforces it.
- **The scheduled smoke run only executes once the `SITE_URL` repository
  variable is set.** Confirm it is set.
- **Field Web Vitals** (p75 LCP, INP and CLS by device class) are not collected.
  Only lab budgets exist.

**Human:**
- Device matrix: Android Chrome, Android tablet, iPhone with Safari, desktop.
- Recorded release sign-off.

## A1 completion gate

| Gate | Status |
|---|---|
| Coverage | Structurally complete and machine-ready; reviewed teaching is pending (human) |
| Editorial release | 0 approvals and 292 flagged clips (human) |
| Coherent learning | Done: shared targets and plan, separate skill evidence, readiness apart from mastery, held-out assessment bank |
| Reliability | Done for the automated scenarios; confirm on devices (human) |
| Device usability | Pending (human) |
| Learning | Pending: thresholds, then the pilot (human) |
| Operations | Partly done: revision and channel are verifiable; the production channel choice, `SITE_URL` and field vitals are open |

## Deferred, as planned

- A2+ content and onboarding are not offered to new learners. Existing data and
  progress are kept.
- The coach and sync are off unless enabled: `COACH=on` with its key and rate
  limiter, `SYNC=on` with its database (`src/api/index.ts`).
- Before sync is enabled, F3 needs epoch validation, write and accounting in
  one atomic step. Today the server checks the epoch, writes operations and
  updates the space in separate statements.
- FSRS-7 and personalised scheduling run in shadow only, in the analysis.
- No social features. No framework change.
