# A1 plan: status

This file is the authoritative record of implementation state (plan §31 of
[AUTONOMOUS_ASSURANCE_PLAN.md](AUTONOMOUS_ASSURANCE_PLAN.md)). Read it before
starting work, and update it in the same pull request as the work. The ledger
below is checked in CI by `npm run status:check`.

For a semantic-assurance session handoff (current branch, what was tried,
what not to repeat), also read `content/assurance/progress.json` and
[AUTONOMOUS_ASSURANCE_PROGRESS.md](AUTONOMOUS_ASSURANCE_PROGRESS.md).

Nothing in this file is a reviewer approval, a listening result, a device
result or a learning outcome. MACHINE_PASS means machine checks pass, nothing
more.

## Status ledger

States:

- **NOT_STARTED**: nothing merged.
- **IN_PROGRESS**: partly merged. The note says what remains.
- **BLOCKED**: cannot proceed without a decision or action outside the
  repository. The note names it.
- **MACHINE_PASS**: built and passing every machine check, and not yet
  deployed to a canary.
- **CANARY**: deployed to a canary cohort (plan §20, R3).
- **DONE**: finished. Nothing remains.
- **DEFERRED**: postponed by the plan. The note says until when.
- **REMOVED**: dropped. The note says why.

Release impact:

- **release-gate**: public release (R4) waits until the row is DONE, and a
  canary (R3) waits until it is MACHINE_PASS or later.
- **canary-gate**: a canary waits until the row is MACHINE_PASS or later.
- **scope**: product surface and focus. Does not gate a release by itself.
- **none**: supporting work.

Rules that CI enforces:

- IDs are unique, and rows F01–F12 (the first implementation package, plan
  §41), GATE0-RIGHTS and P2-CALIBRATION exist.
- MACHINE_PASS, CANARY and DONE rows have a first and a completion commit.
  Other rows have no completion commit, except REMOVED.
- NOT_STARTED rows have no commits. Every other row names evidence: pull
  requests (`#84`) or backticked paths that exist.
- IN_PROGRESS, BLOCKED, DEFERRED and REMOVED rows have a note.
- Commits exist and are in the history of the checked revision. The first
  commit comes before the completion commit.
- GATE0-RIGHTS is BLOCKED exactly while `content/assurance/provenance.json`
  has blockers. Each BLOCKED blocker in `content/assurance/progress.json` has
  a BLOCKED row with the same ID in capitals.
- P2-CALIBRATION is not MACHINE_PASS or later until all four judge roles are
  qualified in `content/assurance/semantic/calibration/qualified.json`.

The completion commit is the commit that finished the work. It can be a
commit in the same pull request, since merges keep branch commits in main's
history. Or it can be the merge commit, recorded in the next pull request. Do
not squash-merge: the check would then fail on main.

<!-- status-ledger:start -->
| ID | Task | State | First commit | Completion commit | Evidence | Release impact | Notes |
|---|---|---|---|---|---|---|---|
| F01 | Gate 0 provenance framework | DONE | `a2d5b50` | `6e6a44b` | #82; `content/assurance/provenance.json`; `scripts/assurance-gate.ts`; `docs/CONTENT_PROVENANCE.md` | release-gate | — |
| GATE0-RIGHTS | Gate 0 rights for every distributed source | BLOCKED | `a2d5b50` | — | `content/assurance/provenance.json` | release-gate | The Oxford-derived workbook's licence, redistribution and derivative rights are UNVERIFIED. Needs the owner to document the rights, or a migration to an openly licensed source (plan §5). Never mark it cleared without evidence. |
| F02 | Content assurance schema (PASS/FAIL/UNCERTAIN/DISAGREEMENT/QUARANTINED) | DONE | `a2d5b50` | `6e6a44b` | #82; `src/lib/learn/assurance.ts`; `src/lib/learn/assurance.test.ts` | none | — |
| F03 | C1 strict deterministic validator | DONE | `c426776` | `948daba` | #82; #83; `scripts/content-assurance.ts`; `content/assurance/deterministic-baseline.json`; `scripts/build-content.ts`; `scripts/curriculum-a1.ts` | release-gate | Plan §7 C1 map: `scripts/build-content.ts` covers the schema, duplicate IDs, unresolved references and version-bound review records. `scripts/curriculum-a1.ts` covers prerequisites. `scripts/content-assurance.ts` covers the rest, plus C2 Persian-in-English, and every finding code is ratcheted, unknown codes at zero. Untaught target references are F05. |
| F04 | Translation and wrong/right sanity validation | DONE | `c426776` | `6e6a44b` | #82; #83; `scripts/content-assurance.ts` | none | Deterministic checks only: missing or identical `wrongFa`/`rightFa`, identical English pairs. Semantic translation checks belong to P2-SEMANTIC-UNIT1. |
| F05 | Curriculum-frontier validator | DONE | `ac90c46` | `d3f6bb0` | `scripts/content-assurance.ts`; `src/lib/learn/learner-language.ts`; `scripts/a1-calibration.ts` | release-gate | Every entry task and scene task is checked course-wide (`FRONTIER_TASK_VOCABULARY`, `FRONTIER_SCENE_VOCABULARY`). Teaching copy is exempt because it is paired with its Persian translation. The repair is A1-FRONTIER-REPAIR. |
| F06 | Example duplication and diversity detection | IN_PROGRESS | `c426776` | — | #82; `scripts/content-assurance.ts` | release-gate | Exact duplicate English and Persian examples are detected. Near-duplicates, superficial noun substitution and repeated patterns (plan §9) are not. |
| F07 | Three-mode Practice: Smart Practice, Listening, Spelling | NOT_STARTED | — | — | — | scope | — |
| F08 | Remove deprecated A1 routes and code (match, sprint, extra decks and quiz modes) | NOT_STARTED | — | — | — | scope | — |
| F09 | A1-only initial data loading | NOT_STARTED | — | — | — | scope | — |
| F10 | Machine Assurance Record infrastructure | IN_PROGRESS | `a2d5b50` | — | #82; `src/lib/learn/assurance.ts` | release-gate | The record schema and aggregation exist. No per-sense records are generated, stored or invalidated on content change yet (plan §17). |
| F11 | Model, prompt and rubric provenance | IN_PROGRESS | `066d7a3` | — | #85; #86; `content/assurance/semantic-rubrics.json`; `content/assurance/semantic/prompts` | release-gate | Judge records carry model, prompt and rubric versions. Generated content has no generation provenance yet; it is needed before the repair loop (plan §8, §18). |
| F12 | Status ledger with the plan's state model, checked in CI | DONE | `03a8659` | `dc47f1c` | #108; `docs/A1_PLAN_STATUS.md`; `scripts/plan-status.ts`; `src/lib/learn/status-ledger.ts` | none | — |
| P1-PERSIAN-FIELDS | Persian-script checks on learner-facing Persian fields | DONE | `c426776` | `6e6a44b` | #82; `scripts/content-assurance.ts` | none | — |
| P1-CHUNK-DECKS | Keep chunk decks out of A1 loading | NOT_STARTED | — | — | — | scope | — |
| P1-XP | Remove XP from primary screens | NOT_STARTED | — | — | — | scope | — |
| P1-FEATURES | Feature ledger `docs/FEATURES.md` (plan §30) | NOT_STARTED | — | — | — | scope | — |
| P1-PRONUNCIATION | Pronunciation normalization that removes notation noise from audio flags | NOT_STARTED | — | — | — | none | — |
| UNIT1-DETERMINISTIC | Unit 1 content passes every deterministic check | MACHINE_PASS | `eea2301` | `6714cce` | #84; `scripts/content-assurance.ts` | canary-gate | — |
| A1-DETERMINISTIC | All A1 content passes every deterministic check | IN_PROGRESS | `c426776` | — | #82; #84; `scripts/content-assurance.ts`; `content/assurance/deterministic-baseline.json` | release-gate | Unit 1 passes. The full corpus has 10,350 findings across 1,027 senses and 14 scenes (`npm run assurance:content`), including the frontier findings in A1-FRONTIER-REPAIR. |
| A1-FRONTIER-REPAIR | Tasks and scenes use only vocabulary taught by that point | NOT_STARTED | — | — | — | release-gate | 5,341 entry-task and 65 scene-task findings. 41% of the entry-task findings come from 30 high-frequency words the curriculum places late: do, not, can and please in Unit 12, and to, at and for in Unit 7. Moving them earlier is likely the cheapest repair. It changes the curriculum version and the frozen Units 1–3 study roster, so it needs its own slice. |
| P2-SEMANTIC-STACK | Semantic judge roles, rubrics, arbitration, packets, runner and evidence ingestion | DONE | `066d7a3` | `0704d5f` | #85; #86; #87; #88; `scripts/semantic-assurance.ts`; `scripts/run-semantic-judge.ts`; `scripts/merge-semantic-evidence.ts` | none | — |
| P2-KEYLESS-GATEWAY | Keyless GitHub OIDC to Workers AI judge gateway with a Neuron budget gate | DONE | `9cd71f4` | `8203831` | #93; #95; #97; #99; #107; `content/assurance/semantic/KEYLESS_GATEWAY.md`; `scripts/semantic-neuron-budget.ts` | none | — |
| P2-CALIBRATION | Judge calibration v1 qualifies all four roles | IN_PROGRESS | `90e06f2` | — | #91; #92; `content/assurance/semantic/calibration/qualified.json` | release-gate | 0 of 4 roles qualified. English: GPT-OSS 120B and Llama 3.3 70B were both rejected under frozen v1 (Llama: 0% defect recall, run 37473550090 attempt 10). Persian, pedagogical and adversarial have not run; each needs one owner `workflow_dispatch`. |
| P2-SEMANTIC-UNIT1 | Unit 1 semantic certification by the qualified judges | NOT_STARTED | — | — | — | canary-gate | — |
| P2-REPAIR-LOOP | Automatic repair loop (plan §8) | NOT_STARTED | — | — | — | none | — |
| P3-AUDIO-CERT | Audio certification (plan §12, A1–A8) | NOT_STARTED | — | — | — | release-gate | — |
| P4-LESSON-CALIBRATION | Measured lesson time, recycling and backlog-aware load (plan §11) | NOT_STARTED | — | — | — | none | — |
| P5-UX-AGENTS | Autonomous usability, bidi and device-profile tests (plan §14) | NOT_STARTED | — | — | — | canary-gate | — |
| P6-CANARY | Production canary with rollback (plan §20–22) | NOT_STARTED | — | — | — | release-gate | — |
| P8-OUTCOME-PILOT | 30-day learner outcome pilot (plan §24) | NOT_STARTED | — | — | — | none | — |
| SCOPE-SYNC | Sync engineering | DEFERRED | — | — | `docs/AUTONOMOUS_ASSURANCE_PLAN.md` | scope | Off the A1 roadmap (plan §4, §32). The code stays off behind `SYNC=on`. |
| SCOPE-COACH | AI coach | DEFERRED | — | — | `docs/AUTONOMOUS_ASSURANCE_PLAN.md` | scope | Kept off; not needed for A1 mastery (plan §4). |
| SCOPE-A2-C1 | A2–C1 curriculum work | DEFERRED | — | — | `docs/AUTONOMOUS_ASSURANCE_PLAN.md` | scope | Frozen until the A1 completion gate (plan §4, §32). |
<!-- status-ledger:end -->

## A1-first plan history (4–5 October 2026)

The sections below record the earlier A1-first plan, before the
autonomous-assurance migration. Human-review counts in them are historical
baseline evidence; routine human review is no longer the intended release
gate. Each item there was marked:

- **Done**: implemented and tested, with the pull request or file that shows it.
- **Open (machine)**: work that code or content tooling can still do.
- **Human**: work only people can do, such as review approvals, listening to
  clips, device sessions or learner studies.

The status is as of 5 October 2026. Nothing here is a reviewer approval, a
listening result, a device result or a learning outcome. Where a script reports
readiness, that is machine readiness only.

### Where things stand

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

### Product decision

- **Done**: new learners start the A1 course only. Onboarding no longer offers
  higher levels or the placement check (#76). Higher-level data, and learners'
  existing progress and saved levels, are unchanged.
- **Done**: lessons follow the A1 curriculum (#77). Unit 1 to Unit 12, each word
  after its prerequisites, for every learning goal. A word's further senses come
  one unit later. Learn shows the current unit.

### Stage 1: protect progress and offline access

- **Done**: F1 and F2 were resolved in #21.
  - Failed journal operations stay visible, exportable and retryable.
  - The save indicator covers startup replay.
  - An offline release activates only when complete, and the last complete
    release survives an interrupted update.
  - Fault tests cover quota failures, closing mid-answer, partial downloads and
    open tabs. See [PROGRESS_STORAGE.md](PROGRESS_STORAGE.md) and the offline
    section of [OPERATIONS.md](OPERATIONS.md).

### Stage 2: one target, one plan

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

### Stage 3: the A1 standard

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

### Stage 4: the lesson and the pilot

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

### Stage 5: all 900 entries

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

### Stage 6: qualify the release

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

### A1 completion gate

| Gate | Status |
|---|---|
| Coverage | Structurally complete and machine-ready; reviewed teaching is pending (human) |
| Editorial release | 0 approvals and 292 flagged clips (human) |
| Coherent learning | Done: shared targets and plan, separate skill evidence, readiness apart from mastery, held-out assessment bank |
| Reliability | Done for the automated scenarios; confirm on devices (human) |
| Device usability | Pending (human) |
| Learning | Pending: thresholds, then the pilot (human) |
| Operations | Partly done: revision and channel are verifiable; the production channel choice, `SITE_URL` and field vitals are open |

### Deferred, as planned

- A2+ content and onboarding are not offered to new learners. Existing data and
  progress are kept.
- The coach and sync are off unless enabled: `COACH=on` with its key and rate
  limiter, `SYNC=on` with its database (`src/api/index.ts`).
- Before sync is enabled, F3 needs epoch validation, write and accounting in
  one atomic step. Today the server checks the epoch, writes operations and
  updates the space in separate statements.
- FSRS-7 and personalised scheduling run in shadow only, in the analysis.
- No social features. No framework change.
