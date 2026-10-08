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
| F06 | Example duplication and diversity detection | DONE | `c426776` | `b649c42` | #82; `scripts/content-assurance.ts` | release-gate | Exact duplicates, near-duplicates (one or two changed words) and sentences reused from an earlier word are detected and ratcheted. Repeated grammatical patterns and examples that obscure a distinction need semantic judgment, so they belong to the pedagogical judge (plan §7 C7). |
| F07 | Three-mode Practice: Smart Practice, Listening, Spelling | DONE | `86f86ca` | `86f86ca` | `src/routes/drill.tsx`; `tests/e2e/smart-practice.spec.ts` | scope | — |
| F08 | Remove deprecated A1 routes and code (match, sprint, extra decks and quiz modes) | DONE | `86f86ca` | `86f86ca` | `src/routes/drill.tsx`; `src/lib/learn/quiz.ts`; `src/lib/learn/i18n.ts` | scope | Pairs, the sprint, meaning and cloze quizzes and the deck drills are gone from Practice, with their components, builders and 50 unused copy keys. The reference decks still load in the Library; that is P1-CHUNK-DECKS. |
| F09 | A1-only initial data loading | DONE | `34b85e0` | `34b85e0` | `public/sw.js`; `src/routes/index.tsx`; `tests/e2e/app.spec.ts` | scope | The install is the A1 course only. Higher levels and reference decks are cached on first use. Today fetches the synonym notes only above A1. |
| F10 | Machine Assurance Record infrastructure | DONE | `a2d5b50` | `5cb59a0` | #82; `src/lib/learn/assurance.ts`; `scripts/assurance-records.ts`; `content/assurance/records/A1.json` | release-gate | One fail-closed record per A1 sense (1,027), bound to the semantic input hash and checked fresh in CI. Today 0 PASS, 20 UNCERTAIN (Unit 1) and 1,007 FAIL. |
| F11 | Model, prompt and rubric provenance | DONE | `066d7a3` | `fd17ae2` | #85; #86; `content/assurance/semantic-rubrics.json`; `content/assurance/generation.json`; `scripts/generation-provenance.ts` | release-gate | Judges record model, prompt and rubric versions. Every A1 entry has a generation record, and the 900 existing entries are historical-unknown. A content change fails CI until its generator is recorded. |
| F12 | Status ledger with the plan's state model, checked in CI | DONE | `03a8659` | `dc47f1c` | #108; `docs/A1_PLAN_STATUS.md`; `scripts/plan-status.ts`; `src/lib/learn/status-ledger.ts` | none | — |
| P1-PERSIAN-FIELDS | Persian-script checks on learner-facing Persian fields | DONE | `c426776` | `6e6a44b` | #82; `scripts/content-assurance.ts` | none | — |
| P1-CHUNK-DECKS | Keep chunk decks out of A1 loading | IN_PROGRESS | `86f86ca` | — | `src/routes/drill.tsx`; `public/sw.js` | scope | Decks are no longer in Practice, the install or Today. The Library can still add deck items to an A1 learner's Review ("Learn this"). Reducing the Library to material linked from A1 is a product decision still open (plan §4). |
| P1-XP | Remove XP from primary screens | DONE | `86f86ca` | `86f86ca` | `src/routes/progress.tsx` | scope | The Progress stat was the only place XP showed. The stored count stays for backups and older saves. |
| P1-FEATURES | Feature ledger `docs/FEATURES.md` (plan §30) | DONE | `92980fe` | `92980fe` | `docs/FEATURES.md`; `scripts/feature-ledger.ts` | scope | — |
| P1-PRONUNCIATION | Pronunciation normalization that removes notation noise from audio flags | DONE | `57114b5` | `57114b5` | `scripts/audio/generate_audio.py`; `content/pilot/audio-report.json`; `docs/AUDIO.md` | none | Notation-only differences no longer flag: 292 flags became 174 (114 US, 60 GB, across 123 senses). Strong and weak forms, dropped sounds and vowel differences still flag; they belong to P3-AUDIO-CERT. |
| UNIT1-DETERMINISTIC | Unit 1 content passes every deterministic check | MACHINE_PASS | `eea2301` | `6714cce` | #84; `scripts/content-assurance.ts` | canary-gate | — |
| A1-DETERMINISTIC | All A1 content passes every deterministic check | IN_PROGRESS | `c426776` | — | #82; #84; #109; `scripts/content-assurance.ts`; `content/assurance/deterministic-baseline.json` | release-gate | Unit 1 passes. The full corpus has 10,382 findings across 1,027 senses and 14 scenes (`npm run assurance:content`), including 32 reused example sentences and the frontier findings in A1-FRONTIER-REPAIR. |
| A1-FRONTIER-REPAIR | Tasks and scenes use only vocabulary taught by that point | IN_PROGRESS | `68143e3` | — | `scripts/content-assurance.ts`; `scripts/frontier-repair.ts`; `content/curriculum/A1.json` | release-gate | Frontier findings now carry structured dependency metadata and a deterministic planner accounts for all 5,406 findings: 4,935 map to 614 explicit curriculum-promotion candidates, while 471 require support or rewording across 238 tokens. The planner also identifies promotions that would alter the frozen Units 1–3 roster. No curriculum order or learner content has changed yet; the next slice must apply explicit repairs and rerun the full deterministic ratchet. |
| P2-SEMANTIC-STACK | Semantic judge roles, rubrics, arbitration, packets, runner and evidence ingestion | DONE | `066d7a3` | `0704d5f` | #85; #86; #87; #88; #138; `scripts/semantic-assurance.ts`; `scripts/run-semantic-judge.ts`; `scripts/merge-semantic-evidence.ts`; `scripts/build-semantic-packets.ts`; `content/assurance/semantic/packets/01-introductions.json` | none | Unit 1 packet identity is scoped to the exact Unit 1 source/curriculum inputs it consumes. Unrelated Units 4–12 reorderings no longer stale the Unit 1 semantic packet; any Unit 1 target/prerequisite/rubric/prompt change still changes packet identity and invalidates stale evidence. |
| P2-KEYLESS-GATEWAY | Keyless GitHub OIDC to Workers AI judge gateway with a Neuron budget gate | DONE | `9cd71f4` | `8203831` | #93; #95; #97; #99; #107; `content/assurance/semantic/KEYLESS_GATEWAY.md`; `scripts/semantic-neuron-budget.ts` | none | — |
| P2-CALIBRATION | Judge calibration v1 qualifies all four roles | IN_PROGRESS | `90e06f2` | — | #91; #92; #142; `content/assurance/semantic/calibration/qualified.json`; `content/assurance/semantic/calibration/rejected.json`; `content/assurance/semantic/calibration/automation-log.json` | release-gate | 0 of 4 roles qualified. Calibration runs unattended; its ledgers hold the latest outcome. English rejected GPT-OSS 120B and Llama 3.3 70B under frozen v1. Nemotron 3 with reasoning on returned no answer three times (all output tokens spent reasoning), so reasoning-capable candidates now run with reasoning off (`+no-thinking`). The least-recently-attempted ready role goes first, so Persian (Kimi K2.5) gets its turn. Pedagogy and adversarial wait for English to settle. |
| P2-CAL-AUTOMATION | Unattended free-allocation judge calibration and qualification | DONE | `89b6caf` | `e216272` | #114; `content/assurance/semantic/AUTOMATION.md`; `content/assurance/semantic/automation.json`; `content/assurance/semantic/calibration/automation-log.json`; `scripts/semantic-automation.ts`; `src/lib/learn/semantic-automation.ts`; `.github/workflows/semantic-calibrate.yml` | none | The first scheduled production campaign ran unattended on 2026-10-07 and committed its measured outcome to main. English/Nemotron 3 120B failed with `http-502-empty-model-content` after one request and 412 charged Neurons; this proves the reservation→inference→record→commit loop works in production. Candidate selection, retry/rejection policy and daily free-allocation ceiling remain frozen and automatic. |
| P2-SEMANTIC-UNIT1 | Unit 1 semantic certification by the qualified judges | NOT_STARTED | — | — | — | canary-gate | — |
| P2-REPAIR-LOOP | Automatic repair loop (plan §8) | NOT_STARTED | — | — | — | none | — |
| P3-AUDIO-CERT | Audio certification (plan §12, A1–A8) | IN_PROGRESS | `7941c9e` | — | #131; #133; #139; `.github/workflows/audio-certify.yml`; `scripts/check-audio-certify-workflow.ts`; `src/lib/learn/audio-assurance.ts`; `scripts/audio-certification.ts`; `scripts/audio/certify_audio.py`; `scripts/audio-repair-plan.ts`; `scripts/audio-repair-evaluate.ts`; `scripts/audio/generate_repair_candidates.py`; `scripts/audio/promote_repair_candidates.py`; `scripts/audio/rollback_unstable_promotions.py`; `content/assurance/audio/recognition.json`; `content/assurance/audio/certificates.json`; `content/assurance/audio/repair-policy.json`; `content/assurance/audio/repair-log.json`; `src/lib/learn/audio-pack.ts`; `public/sw.js`; `public/data/enhanced/audio-pack.json`; `docs/AUDIO.md` | release-gate | Production run 37693801383.1 independently certified 189/386 baseline targets, then isolated repair rounds certified/promoted 59 + 43 + 38 + 3 candidates. The exact promoted-state full-corpus pass reached 330/386 certified with 56 quarantined; artifact analysis shows 142 current promotions remained certified and exactly one (`lex:A1:your:us`) lost certification (`vosk-lexical`, `multi-system-disagreement`). Final-pass promotions are now transactional: the scoped release is snapshotted before repair, only unstable promoted targets are SHA-restored and recorded in `repair-log.json.finalFailures`, stable promotions are preserved, and the rolled-back exact state is recertified before commit. A rolled-back isolated-certified candidate counts as tried so a later PARTIAL retry can advance to the next frozen candidate; PARTIAL retries run only while an untried candidate exists. The 386/386 release gate and all recognition criteria remain unchanged; committed release evidence is still fail-closed and Phase 3 remains IN_PROGRESS. |
| P4-LESSON-CALIBRATION | Measured lesson time, recycling and backlog-aware load (plan §11) | DONE | `6c7542e` | `68a0758` | #125; #126; #127; #128; #130; `src/lib/learn/active-time.ts`; `src/lib/learn/lesson-time.ts`; `src/lib/learn/lesson.ts`; `src/lib/learn/learner-state.ts`; `src/lib/learn/planner.ts`; `src/routes/learn.tsx`; `content/assurance/scene-coverage.json`; `docs/LEARNING_MEASURES.md`; `docs/SCENE_COVERAGE.md` | none | L1–L5 are implemented: active lesson timing excludes 60-second idle periods and derives robust measured duration estimates; due reviews are bounded, oldest-first, prompt-fresh authored context that consume review budget but not the new-word allowance; adaptive shortening requires exact first-attempt evidence across required checks and never skips delayed retrieval or uses speed as a gate; overdue burden reduces new words; and New/Learning/Ready for now/Due/Retained have formal evidence definitions. Recycled-review time is excluded from per-new timing to avoid double-counting. The scene matrix currently observes 51/1,027 senses with a later scene-recycling candidate; its threshold remains explicitly UNSET, so that structural gap is not represented as a pass claim. |
| P5-UX-AGENTS | Autonomous usability, bidi and device-profile tests (plan §14) | MACHINE_PASS | `693d100` | `b607177` | #115; `tests/e2e/bidi.spec.ts`; `tests/e2e/journeys.spec.ts`; `tests/e2e/support/learner.ts`; `tests/e2e/support/journey.ts`; `docs/INTERFACE.md` | canary-gate | U3–U7 are now covered by machine checks: zero-finding bidi/accessibility coverage; goal-driven first-lesson journeys across eight device profiles; interrupted and offline lessons; a month-long absence; repeated wrong answers; an update that waits instead of swapping a live lesson client; real backup/export/import restoration; repeated online/offline transitions; and IndexedDB quota pressure with live export plus journal retry. This is machine evidence only; canary/outcome evidence remains P6/P8. |
| P5-DEPENDABILITY | Long-history, low-storage and crash/reload tests (plan §15, D2–D4) | MACHINE_PASS | `29614e9` | `29614e9` | `tests/e2e/dependability.spec.ts`; `tests/e2e/support/release-server.ts`; `docs/PROGRESS_STORAGE.md` | canary-gate | Browser tests cover three areas. D2: two years of history (2,000 cards, 10,000 reviews, a 400-day streak) migrates, opens in under 5 s, takes a new answer once and exports in full. D3: persistent storage refused, an interrupted unit audio download that resumes only the missing clips, and a failed update download that leaves the installed release working offline. D4: a review tab killed at each of five steps reopens with every answer recorded once and its schedule intact. Quota failures during lessons and answers were already covered by P5-UX-AGENTS and `tests/e2e/storage-recovery.spec.ts`. Machine evidence only; real devices are not covered. |
| P6-CANARY | Production canary with rollback (plan §20–22) | NOT_STARTED | — | — | — | release-gate | — |
| P6-ROLLBACK | Rollback tested, not merely documented (plan §22) | IN_PROGRESS | `514f4a3` | — | `scripts/rollback-rehearsal.mjs`; `tests/rollback/rollback.spec.ts`; `.github/workflows/rollback-rehearsal.yml`; `.github/workflows/smoke.yml`; `docs/OPERATIONS.md` | canary-gate | Every pull request and push to `main` rehearses a rollback with two real builds behind one origin. It checks `/api/version` (revision and channel), the offline release on each side, and that a learner's answers survive exactly once through a rollback and a roll forward. A save the older release cannot read must be held and downloadable, never overwritten. Remaining: rolling back a real Cloudflare deployment and checking it with the smoke workflow's `expect_revision`. That needs `SITE_URL` and a live production deployment. |
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
  main action and the other modes are folded away. (Later replaced by the three
  Practice modes; see F07 in the status ledger.)
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
