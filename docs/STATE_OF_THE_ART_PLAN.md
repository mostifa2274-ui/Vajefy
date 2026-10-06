# Vajefy: the state-of-the-art plan

> **Superseded for implementation on 6 October 2026.** The authoritative roadmap is now [AUTONOMOUS_ASSURANCE_PLAN.md](AUTONOMOUS_ASSURANCE_PLAN.md). This file is retained as the measured baseline that motivated the autonomous-assurance redesign.

Written 6 October 2026 against main at `62a416a`. This is an analysis of
where the product stands and a plan for making it the best A1 English
vocabulary course for Persian speakers in every aspect that matters, without
letting the feature set grow past what one small team can keep correct.

Every number below was measured in the repository. Nothing here is a reviewer
approval, a listening result or a learner outcome. Where a step needs people,
it says so.

## 1. What "state of the art" means here

A vocabulary course is state of the art when, for its learners, it is the
**most accurate, the most durable, the most dependable and the least
wasteful** option. In order:

| Aspect | The standard |
|---|---|
| Teaching accuracy | Every meaning, example, note and task is correct English and natural Persian, checked by a named bilingual reviewer at the exact content version shown to learners |
| Durable learning | Words are met through retrieval, interleaving and spacing, with evidence recorded per skill, and recall is measured after a delay rather than assumed |
| A clear daily path | One obvious next action, a small daily load, nothing that overwhelms a returning learner |
| Audio | Natural, correct pronunciation in both accents, every required clip heard by a person |
| Dependability | Works offline, never loses an answer, survives bad updates and low storage, on the phones Persian speakers actually use |
| Honesty | Labels say what was measured ("ready for now" is not "mastered"), and the study can tell whether the course works |
| Restraint | Every feature serves A1 mastery, has a measure, and can be removed by deleting one directory |

The last row is the one most apps fail. Vajefy already shows the symptom: 12
practice modes, 5 chunk decks, 4 higher levels, a 2,950-note reference library,
a coach and a sync service, around a 900-word course nobody has reviewed yet.
The plan treats removal as a first-class deliverable.

## 2. Where the product stands

### 2.1 What is strong

- **Learning records are safe.** Write-ahead journal, transactional IndexedDB,
  atomic offline releases, recovery screens, and fault tests for quota loss,
  mid-answer closure, partial downloads and two open tabs (#21).
- **One plan, one target.** Today, Learn and Review share one daily-plan
  decision and one sense-aware target interface with stable ids, content
  version, release state, unit and prerequisites (#22, #77).
- **The lesson is built on the right mechanisms.** Teach → typed recall →
  listening → context → delayed recall, interleaved across words, one prompted
  retry after feedback, readiness kept apart from mastery (#78, #80).
- **The curriculum is real.** 12 units, 900/900 entries, explicit
  prerequisites, no forward references, a machine-readiness gate per unit, a
  review queue, reviewer packets and a version-bound assessment bank (#26–#74).
- **Measurement is designed before data exists.** Per-skill evidence, held-out
  delayed assessment, study export with protocol provenance, a frozen roster,
  and an analysis that fails closed on protocol drift.
- **Engineering discipline.** 33 unit test files, 12 browser suites (60 tests),
  axe on every screen, lab Web Vitals budgets in CI, data contracts, content
  lint, a smoke check that verifies the deployed revision and channel.

### 2.2 What is weak, with numbers

| # | Finding | Evidence |
|---|---|---|
| W1 | **No content has been reviewed.** | 0 of 900 entries approved; 0 records in `content/pilot/review.json`; 0 released |
| W2 | **Generated content has systematic gaps.** | 967 of 2,808 grammar notes are English sentences where the schema asks for a Persian explanation; 1,007 of 1,027 senses have no Persian translation of the "wrong" sentence, and 17 have a translation identical to the right one, which hides the mistake; every sense has exactly 2 examples (the minimum); 53 senses carry a usage note; 20 have translated collocations; 52 tasks or examples use words above A2 |
| W3 | **Audio is provisional and unheard.** | Kokoro v1 voices chosen without a learner test; 292 word clips flagged, 163 US and 129 GB; the flag heuristic compares a phonemizer's output with the entry IPA, so many flags are notation differences (/ɹ/ vs /r/, /ɝː/ vs /ɜː/) rather than errors |
| W4 | **Lesson load is untested.** | 5 checks per word, so 10, 15 or 25 steps for 2, 3 or 5 words; the planner assumes 90 s per word; no learner has timed it |
| W5 | **Scenes test recognition, not comprehension.** | 14 scenes, 5.4 lines and 3 checks each; checks are mostly "which word fits", not "what happened" |
| W6 | **The feature surface is far wider than the course.** | 12 practice modes + 5 chunk decks on one screen; coach and sync services; speaking practice; 5,322 entries at A2–C1; 2,950 reference notes; a 958 KB occupations file; `public/data` is 6.2 MB of which A1 needs under 1 MB |
| W7 | **No field evidence.** | Lab LCP 0.6–2.2 s and INP ≤ 136 ms, but no real-user Web Vitals; error reports are opt-in; no usability session has been run |
| W8 | **Offline audio is one 50 MB pack.** | 5,850 clips, 50.2 MB; a learner on a cheap phone must take all of it or none |
| W9 | **Two question engines.** | `quiz.ts` generates questions from the raw dataset for the practice modes; `lesson.ts` generates from enhanced senses; they grade, record and label differently and both need copy, tests and bidi care |
| W10 | **Rights are unverified.** | The vocabulary is the Oxford 3000/5000 lists; `CONTENT_PROVENANCE.md` records that redistribution rights have not been confirmed |
| W11 | **Sync is not yet safe to enable.** | Epoch check, writes and accounting are separate statements (audit F3); sync stays off |
| W12 | **Study thresholds are unset.** | Decision rules are proposals; the numeric target must be recorded before pilot outcomes are seen |

W1 and W2 are the whole game. A course whose teaching text is 34 % wrong-field
and 98 % missing a scaffold is not state of the art no matter how good the
scheduler is. Everything else in this plan is ordered around getting the
content right and proving it.

## 3. The restraint rule

Before adding anything, the product sheds what does not serve the A1 promise.
Each item below is a decision, not a suggestion; the "why" is the test every
future feature must pass.

| Decision | Item | Why |
|---|---|---|
| **Remove from the A1 path** | 9 of the 12 practice modes (Persian→English, English→Persian, Spell, Cloze, Listen, Irregular, Antonyms, Confusing, Chunks) as separate choices | Smart Practice already mixes meaning, spelling, listening and context by evidence. Nine parallel entry points teach nothing extra and cost copy, tests and bidi bugs. Practice becomes: **Smart Practice**, **Listening**, **Spelling** |
| **Remove from the A1 path** | Chunk decks (phrasal, collocations, prepositions, patterns, occupations) | None is A1 vocabulary; occupations alone is 958 KB. Keep the data for the A2 decision |
| **Remove from the A1 path** | Pairs and the 45-second sprint as destinations | Keep Pairs as one Smart Practice format if the evidence shows it helps; the sprint is a game, not evidence |
| **Freeze** | A2–C1 lexicon and lessons | Existing learners keep access and progress; no new work, no onboarding, no content until the A1 gate |
| **Freeze** | Reference library | Show only notes that an A1 word links to (its irregular form, its confusable pair). The other ~2,800 notes stay in the data, hidden |
| **Keep off** | Coach, sync | Off until their own gates pass (reviewed coach evaluation; atomic epochs for sync). Neither is a dependency of learning |
| **Keep small** | Speaking practice, XP, streak | Speaking stays record-and-compare, never scored. XP is removed from the primary screens; the streak stays as the one motivation signal |

**The rule for anything new:** it must (1) serve A1 mastery, (2) carry a
measure that would show it failing, (3) live in one directory with its own
tests and copy, and (4) be deletable without touching the lesson, the store or
the planner. A quarterly removal review asks of every feature: what did its
measure show?

## 4. The plan, aspect by aspect

Each step gives what to do, why, how, and what "done" looks like. Sizes are
S (a day or two), M (a week), L (longer). "Machine" means code or tooling;
"Human" means reviewers, listeners, testers or learners.

### 4.1 Content accuracy (the largest gap)

**Standard.** Every A1 sense has: a precise Persian gloss and a one-sentence
meaning; three or more natural examples with Persian; grammar patterns with
Persian notes; a common mistake whose wrong and right sentences are both
translated and genuinely differ; usage notes for every function word and
every word with a false friend; tasks that use only already-taught words; and
a review record at the current version from a named bilingual reviewer and a
named pronunciation reviewer.

| Step | What | Why | How | Done when |
|---|---|---|---|---|
| C1 (M, machine) | Make the lint enforce the standard | Today the schema allows English in `grammar.note` and a missing `wrongFa`; the defects in W2 are invisible to CI | Add strict rules: `note` must contain Persian; `wrongFa` required and must differ from `rightFa`; ≥ 3 examples; usage note required for determiners, pronouns, prepositions, modals and particles; task vocabulary ≤ A1 unless glossed in `support` | `npm run validate:data` fails on the current content with counted reasons |
| C2 (L, machine then human) | Repair the 967 notes, 1,007 missing translations, third examples and 52 over-level tasks | These are mechanical gaps generated content left behind | Regenerate per unit with the existing drafting tools, in curriculum order, Units 1–3 first; every regenerated field changes the content version, so nothing reviewed is silently altered | Lint passes for Units 1–3 within two weeks, all units within six |
| C3 (S, machine) | Add a translation-sanity check | 17 mistake pairs translate wrong and right identically; similar slips will recur | Flag any Persian field equal to another Persian field in the same sense; flag Persian that contains no verb for a sentence example | Zero identical pairs |
| C4 (L, human) | Review in curriculum order | The study and the public release both start at Unit 1 | Two reviewers per unit using `npm run content:review-queue -- --unit <id> --packet`; decisions recorded with `content:approve` against the exact version; disagreements go back to authoring | Units 1–3 fully approved before the pilot; one unit a week after |
| C5 (M, machine) | Scenes with comprehension | Reading and listening need "what happened" questions, not "which word fits" | For each scene add two comprehension items (who/where/why, true-or-false in Persian) and one inference item; keep the existing fill items; lint that every unit has at least two scenes whose targets are all introduced by its end | 24+ scenes, ≥ 2 per unit, each with ≥ 2 comprehension items |
| C6 (S, human, legal) | Verify rights | A public or commercial release of an Oxford-derived list without confirmed rights is a risk no amount of engineering offsets | Owner obtains written confirmation or replaces the selection with an openly licensed frequency list using the same stable ids | A rights statement in `CONTENT_PROVENANCE.md` |

### 4.2 Durable learning

**Standard.** Each word is retrieved (typed), heard, used and recalled after a
delay in its first session; it is spaced by FSRS-6 afterwards; old words are
recycled inside new lessons; the delayed check-up measures recall and use with
held-out items; and the daily load adapts to the backlog so no learner is
buried.

| Step | What | Why | How | Done when |
|---|---|---|---|---|
| L1 (S, machine) | Time the lesson | W4: 15 steps for 3 words is plausible for 10 minutes and tight for 5; nobody has measured | Record teach-card dwell time and per-step active time (the instrumentation exists); show "about N minutes" on the Learn card from the planner | A lesson's estimate is within 20 % of measured median after the usability round |
| L2 (M, machine) | Recycle old words inside lessons | Spacing research favours returning to earlier items in new contexts, and the plan's coverage matrix asks for "later recycling" | Each lesson adds one or two due or nearly due earlier words as context items between new words, counted against the review budget, never against the new-word budget | Every lesson after the fifth contains ≥ 1 recycled item; Review's due count falls accordingly |
| L3 (S, machine) | A short path for words that are ready | Repeating five checks for a word the learner clearly knows is waste | If typed recall and listening are both correct and fast, drop the context item for that word in this lesson; the delayed recall stays, because it starts the schedule | Lesson length varies with performance; evidence unchanged for scheduled answers |
| L4 (S, machine) | Measure active treatment time | The plan notes that response time omits teaching and listening time | Count visible, active time on teach cards and audio playback into the study's active-time measure, with the same 60-second idle rule | The export carries treatment time per word |
| L5 (M, human then machine) | Record the thresholds | W12: decision rules must be fixed before outcomes are seen | After the usability round, the owner records numeric targets for delayed recall-and-use per hour, review burden and first-session completion, in `EVALUATION.md`, with the date | A dated thresholds section exists before enrolment |
| L6 (L, human) | The 30-day pilot | The only way to know whether the course works | `npm run study:roster` at 10 minutes a day, Units 1–3 released, both arms, exports at day 30, `npm run evaluate` | A report with intervals and attrition, and the corrections it implies |

### 4.3 Audio

**Standard.** Both accents, natural and correct, every required clip heard by
a person, and offline audio that fits a phone.

| Step | What | Why | How | Done when |
|---|---|---|---|---|
| A1 (S, machine) | Make the flag heuristic phoneme-aware | W3: notation differences are drowning real errors | Normalise both sides to one phoneme set before comparing (/ɹ/→/r/, /ɝː/→/ɜː/, syllabic consonants, stress marks); flag only consonant or vowel-class changes and missing syllables | Flags fall to a list a person can hear in a day; every flag is a candidate error |
| A2 (M, human) | Voice test with learners | The voices are provisional; changing one regenerates everything, so decide once | Five to eight Persian-speaking learners hear 20 words in three candidate voices per accent and rate clarity and comfort; pick by rating | A recorded choice in `AUDIO.md`; regeneration if the choice changes |
| A3 (M, human) | Listen to the release clips | A generated clip is not a pronunciation approval | Pronunciation reviewer listens to every flagged clip and a 10 % sample of the rest per unit, records decisions with `content:approve` | Units 1–3 approved before the pilot |
| A4 (M, machine) | Per-unit audio packs | W8: 50 MB all-or-nothing excludes cheap phones | Build one pack per unit; Today offers "download this unit's pronunciation" (≈ 4 MB); the service worker keeps packs by unit | A learner can study Unit 1 offline with a 4 MB download |

### 4.4 Interface and accessibility

**Standard.** Four destinations, one next action, three practice choices,
Persian-first with clean direction boundaries, usable with one thumb, a screen
reader, a keyboard or 200 % text, on the phones learners own.

| Step | What | Why | How | Done when |
|---|---|---|---|---|
| U1 (M, machine) | Consolidate Practice | Section 3 | `/drill` shows Smart Practice, Listening, Spelling; the other modes and chunk decks are removed from the route and their code deleted with their tests and copy | The drill route and `quiz.ts` shrink by more than half; e2e suites updated |
| U2 (S, machine) | A bidi lint in the browser tests | Direction bugs keep recurring ("Answer: I" rendered backwards) | A test walks every screen's text nodes and fails when Latin and Persian runs share an element without a `lang`/`dir` boundary | Zero findings on every screen |
| U3 (M, human) | Device and assistive sessions | Automated checks cannot judge VoiceOver flow or a 5-inch Android keyboard | Android Chrome, Android tablet, iPhone Safari, desktop; TalkBack, VoiceOver, keyboard, 200 % text; the scripted path: first use, a lesson, a review, undo, offline, update, backup | A recorded matrix with defects filed and fixed |
| U4 (M, human) | Five to eight observed first sessions | The plan's usability target cannot be met by inspection | Watch onboarding → first lesson → first review; note every moment of help needed; count unaided completions | Counts and obstacles recorded; fixes shipped before the pilot |
| U5 (S, machine) | Remove XP from Today and Progress | Section 3: it is a motivation indicator, not evidence, and it competes with the real numbers | Keep the streak; move XP out of the primary screens | Today shows the next action, due count, streak, and nothing else numeric |

### 4.5 Dependability and performance

**Standard.** Nothing a learner answers is ever lost; the app works offline on
a low-storage phone; updates never strand a tab; field p75 LCP ≤ 2.5 s,
INP ≤ 200 ms, CLS ≤ 0.1 on mobile.

| Step | What | Why | How | Done when |
|---|---|---|---|---|
| D1 (S, machine) | Field Web Vitals | W7: lab numbers describe one container | `web-vitals` reports LCP, INP and CLS to `/api/telemetry` under the existing privacy rules (no ids, once per load); the Worker logs them; a weekly p75 by device class | A p75 line per metric in the operations log |
| D2 (S, machine) | Trim the A1 first load | A new learner's first visit fetches data A1 does not need | Load `usefulness.json` and non-A1 level files only on Words or when another level is opened; keep `enhanced-order.json` small by unit | First-visit transfer for a new learner falls by the measured amount; LCP budget tightened |
| D3 (M, machine) | Long-history and low-storage tests | The plan asks for them; neither exists | Browser tests with 10,000 events and 2,000 cards; a `persist()`-denied path and a quota-exceeded path during a lesson | Both pass with the save indicator honest |
| D4 (M, machine) | Atomic sync epochs (F3) | Required before sync is ever enabled | One D1 transaction for epoch check, inserts and accounting; monotonic epochs; tests for concurrent resets | `sync.test.ts` covers the race; sync may then be enabled by its own gate |

### 4.6 Honest measurement and operations

**Standard.** A release can be verified against the commit and channel it was
meant to have; required checks run on every change; the owner can see errors,
vitals and smoke results without asking; labels never claim more than the data.

| Step | What | Why | How | Done when |
|---|---|---|---|---|
| O1 (S, owner) | Choose the production channel | Production still serves `draft` | Set `VITE_CONTENT_CHANNEL=released` in Cloudflare and `CONTENT_CHANNEL=released` in the repository once Unit 1 is approved; set `SITE_URL` | The scheduled smoke check runs and enforces the channel |
| O2 (S, machine) | Release per unit | Learners should get reviewed content as soon as each unit is approved | The released channel already filters by approval; add a per-unit release note in `A1_PLAN_STATUS.md` and a smoke check that the live index lists the expected released count | Each unit's release is a dated line with the count it shipped |
| O3 (S, machine) | A rollback drill | Cloudflare keeps deployments; nobody has rehearsed | Document and rehearse: roll back in the dashboard, confirm `/api/version`, confirm the offline release on a phone | A dated drill note |
| O4 (S, machine) | Label audit | "Settled", "Ready for now", accuracy and XP must mean one thing each | One table in `INTERFACE.md` listing every learner-facing number, its source event and its boundary; tests assert the copy | Every number has a row |

### 4.7 Codebase and scope control

**Standard.** One question engine over one target interface; features live in
their own directories; the test suite runs in minutes; no dead modes.

| Step | What | Why | How | Done when |
|---|---|---|---|---|
| K1 (L, machine) | One question engine | W9: two generators with different grading and labels | Smart Practice, Listening and Spelling generate from the enhanced target interface; the raw-dataset generator is kept only for frozen higher levels, behind one function | `quiz.ts` no longer produces A1 questions; grading and prompt ids are shared with lessons |
| K2 (M, machine) | Delete what Section 3 removed | Dead code is maintenance | Remove modes, chunk decks, sprint, their copy keys, tests and e2e steps | Line counts fall; lint has no unused copy keys |
| K3 (S, machine) | A feature ledger | The removal review needs a list | `docs/FEATURES.md`: each feature, its directory, its measure, its last review date | Every shipped feature has a row |
| K4 (S, machine) | Keep the plan status current | The status document is the owner's map | Each PR that closes a step updates `A1_PLAN_STATUS.md` in the same change | CI fails when a closed step is still listed open (a simple marker check) |

## 5. Sequence and gates

The order follows dependencies, not effort. Machine work runs in parallel
with human review from the start; the pilot waits for both.

**Phase 1, weeks 1–2 (machine): make the content checkable and the product
smaller.** C1, C3, A1, U1, U5, K2, D1, D2, O1 (owner), K3. Output: a lint that
fails on the real gaps, a Practice screen with three choices, field vitals
flowing, a feature ledger.

**Phase 2, weeks 2–6 (machine + human, in parallel):** C2 for Units 1–3, then
the rest; A2 voice test; U3 and U4 sessions; C4 review of Units 1–3; A3
listening for Units 1–3; L1, L2, L3, L4; A4 per-unit packs; C5 scenes for
Units 1–3; L5 thresholds recorded. Output: Units 1–3 approved and released,
scenes with comprehension, a measured lesson length, recorded thresholds.

**Gate to the pilot:** Units 1–3 approved at current versions; audio for them
heard; no open usability defect that blocked a first session; thresholds
recorded; `released` channel live and verified by the smoke check.

**Phase 3, 30 days (human): the pilot (L6).** Machine work continues on C2,
C4, C5 for Units 4–12, D3, D4, K1, O2, O3, O4, U2.

**Gate to "A1 complete":** 900/900 approved and heard; every unit with ≥ 2
comprehension scenes; pilot report with intervals and attrition; device matrix
recorded; field p75 within budget; rights confirmed (C6). Only then does the
A2 question open, and it opens with the same ids, pipeline and gates.

## 6. What will not be built

Each of these was considered and rejected for the reason given. The list is
part of the product.

- **Conversational AI or automatic pronunciation scoring.** No reviewed
  evaluation exists; a wrong correction in a learner's first week costs more
  than the feature earns.
- **More practice modes, games or a sprint.** Three entry points are enough;
  Smart Practice chooses the format from evidence.
- **Leaderboards, badges, reward shops, social features.** They move the
  measure from learning to engagement.
- **Accounts, email, push notifications.** The streak and the local plan are
  the reminder; the data stays on the device.
- **Custom decks, imports, a CMS.** The curriculum is the product; an editor's
  tool is a text file and a review queue.
- **Native apps or a second backend.** The PWA with offline packs covers the
  devices; Workers is enough.
- **A2 content before the A1 gate.** Not one entry.
- **A new scheduler.** FSRS-6 stays until the shadow analysis shows FSRS-7 or
  personalisation beats it on the pilot's own data.

## 7. Where the effort goes

| Area | Machine | Human |
|---|---|---|
| Content repair and review | 3 weeks | 2 reviewers, ~1 unit a week for 12 weeks |
| Audio | 1 week | 5–8 learners for one hour; a listener, ~2 days per 3 units |
| Lesson tuning and recycling | 1–2 weeks | — |
| Practice consolidation and engine unification | 2–3 weeks | — |
| Dependability, performance, operations | 1–2 weeks | an hour for the rollback drill |
| Sessions and pilot | — | 5–8 observed sessions; 20–40 learners for 30 days |

The machine work is about two months for one engineer. The human review is the
critical path, which is why the plan starts it in week 2 and never waits for
engineering to finish.
