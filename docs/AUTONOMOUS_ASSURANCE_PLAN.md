# Vajefy: State-of-the-Art A1 Plan
## Autonomous Assurance Edition

**Rewritten 6 October 2026 against the original plan based on `main` at `62a416a`.**

This plan defines how Vajefy becomes an exceptionally accurate, durable, dependable and efficient A1 English vocabulary course for Persian speakers while removing routine human review and operational work from the critical path.

The goal is not merely to automate the existing workflow.

The goal is to redesign the system so that quality is established by:

- deterministic invariants;
- independent machine verification;
- adversarial checking;
- reproducible evidence;
- automated audio certification;
- autonomous UX and accessibility testing;
- controlled releases;
- real learner outcomes;
- continuous post-release diagnostics.

Humans are not required to approve ordinary content, listen to routine audio, operate pilots, manually inspect devices, or decide whether a normal release may proceed.

Actual learners remain necessary because no synthetic system can establish whether real people retain vocabulary over time. Learners are therefore the **source of outcome evidence**, not reviewers standing inside the production pipeline.

Legal uncertainty is eliminated structurally wherever possible by using content with explicit redistribution rights and machine-verifiable provenance.

---

# 1. What “state of the art” means

Vajefy is state of the art only when it is measurably excellent in the dimensions that determine whether an A1 learner actually succeeds.

| Aspect | Standard |
|---|---|
| Teaching accuracy | Every meaning, example, Persian explanation, usage note, mistake pair and task passes deterministic checks plus independent semantic and pedagogical verification |
| Translation quality | Persian is accurate, natural, sense-specific and independently back-checked |
| Durable learning | Vocabulary is retrieved, heard, used, interleaved, spaced and tested again after meaningful delay |
| Daily clarity | One dominant next action and a small, adaptive workload |
| Audio | Both supported accents are automatically certified for pronunciation, intelligibility, acoustic integrity and expected phonological structure |
| Accessibility | The complete learning path survives automated accessibility checks plus agentic interaction tests |
| Dependability | No learner answer is silently lost; offline learning and recovery work under adverse conditions |
| Measurement | Claims derive from versioned evidence rather than labels or engagement metrics |
| Automation | Routine release decisions require no manual reviewer |
| Reproducibility | Every released artifact can be reconstructed from versions, models, prompts, rules and source data |
| Restraint | Every feature contributes to A1 mastery and has a measurable failure criterion |
| Honesty | “Ready”, “learned”, “retained” and “mastered” never mean more than the evidence supports |
| Legal provenance | Every distributed source item has a machine-readable rights/provenance record |
| Maintainability | A small team can keep the entire A1 product correct |

The objective is therefore not:

> the app with the greatest number of language-learning features.

The objective is:

> the smallest system capable of producing unusually reliable A1 learning outcomes.

---

# 2. Current baseline

The original audit already identifies a strong engineering foundation.

Vajefy currently has:

- transactional learning storage;
- write-ahead protection;
- IndexedDB persistence;
- offline release handling;
- recovery paths;
- fault tests;
- a shared daily planner;
- stable content identifiers;
- sense-aware targets;
- Teach → typed recall → listening → context → delayed recall;
- readiness separated from mastery;
- a real 12-unit A1 curriculum;
- per-skill evidence;
- held-out assessment infrastructure;
- study exports;
- protocol provenance;
- accessibility testing;
- Web Vitals budgets;
- content linting;
- deployment smoke verification.

The fundamental architecture does not need replacement.

The product needs **quality convergence**.

## 2.1 Current weaknesses

| # | Finding | Baseline |
|---|---|---|
| W1 | Content is not release-certified | 0/900 entries approved under the existing human-review model |
| W2 | Generated content has systematic structural defects | Large numbers of grammar notes, missing translations, minimum-example patterns and vocabulary-level leaks remain |
| W3 | Audio is provisional | Current pronunciation flags contain notation noise and release audio has not been comprehensively certified |
| W4 | Lesson duration is assumed rather than measured | Planner assumes approximately 90 seconds per word |
| W5 | Scenes emphasize recognition over comprehension | Existing scenes provide weak discourse-level evidence |
| W6 | Product scope exceeds the A1 promise | Too many practice modes, higher-level content and secondary reference surfaces |
| W7 | Real-world evidence is missing | Lab performance exists; learner and field evidence do not |
| W8 | Offline audio packaging is too coarse | One large pack creates unnecessary storage/network cost |
| W9 | Two A1-relevant question-generation paths exist | Grading and evidence semantics can diverge |
| W10 | Vocabulary provenance has unresolved redistribution risk | Public release cannot rely on uncertainty |
| W11 | Sync is not safe enough to justify activation | It is also unnecessary for A1 completion |
| W12 | Outcome thresholds have not been frozen | Interpretation could otherwise drift after results are observed |
| W13 | Existing review design makes people the critical path | Human throughput determines release speed |
| W14 | Generated artifacts do not yet carry complete machine assurance certificates | A passing file is not yet equivalent to a certified release artifact |
| W15 | Model/version drift can silently alter future generation or judging | Reproducibility requires model and rubric provenance |

W1, W2, W3 and W13 are the immediate constraints.

A sophisticated scheduler cannot compensate for incorrect teaching material.

A beautiful interface cannot compensate for unreliable translations.

More AI cannot compensate for poorly controlled AI.

The solution is not merely “use AI reviewers.”

The solution is to build an **assurance system in which no single generator, judge, metric or model is trusted on its own**.

---

# 3. Governing principle: zero-touch production, evidence-first release

The target production architecture is:

**source → generate → deterministic validation → independent semantic judges → adversarial verification → audio certification → curriculum checks → autonomous UX tests → immutable assurance certificate → canary release → real learner evidence → automatic diagnostics**

The system must be designed around four principles.

## 3.1 No self-approval

The same generation process must never be the sole evaluator of its own output.

Generation and judgment must be logically independent.

At minimum:

- generation context is separated from judgment context;
- judges do not inherit the generator's chain or rationale;
- independent judgments are stored individually;
- disagreement is visible;
- high-risk disagreement causes abstention rather than averaging.

## 3.2 Deterministic rules beat probabilistic judgment whenever possible

Anything that can be checked exactly should not be delegated to an LLM.

Examples:

- missing fields;
- duplicate values;
- invalid IDs;
- curriculum forward references;
- vocabulary-level violations;
- missing Persian;
- audio files missing;
- impossible release states;
- wrong content version;
- unknown provenance;
- unsupported learner-facing labels.

Probabilistic models are used only where semantic interpretation is unavoidable.

## 3.3 False rejection is preferable to silent false acceptance

The release system is intentionally conservative.

If verification is uncertain:

**do not ship the item.**

The result is quarantined, regenerated or escalated to another automated verification path.

The product should tolerate delayed content more readily than wrong instruction.

## 3.4 Humans are outside the routine critical path

Ordinary operation requires no:

- bilingual content reviewer;
- pronunciation reviewer;
- manual device tester;
- person to operate an experiment;
- person to calculate results;
- person to approve routine releases.

Optional external audits remain possible, but they do not block ordinary product operation.

---

# 4. Restraint rule

Before improving A1, Vajefy becomes smaller.

| Decision | Item | Result |
|---|---|---|
| Remove | Nine redundant practice destinations | Practice becomes Smart Practice, Listening and Spelling |
| Remove | Separate chunk decks from the A1 path | Their data is not loaded into ordinary A1 learning |
| Remove | Sprint as a destination | Engagement-only game mechanics do not consume product surface |
| Conditional | Pairs | It may exist only as an internal Smart Practice format if evidence supports it |
| Freeze | A2–C1 development | No new higher-level curriculum work before the A1 completion gate |
| Freeze | Large reference library | Only material directly linked from A1 appears |
| Keep off | Coach | Not required for A1 mastery |
| Remove from A1 roadmap | Sync engineering | Local-first A1 does not need it |
| Keep small | Speaking | Record-and-compare only; no unvalidated automatic score |
| Reduce | XP | Removed from primary learning decisions |
| Keep | Streak | One lightweight motivational signal |
| Keep | Offline PWA | Core capability |
| Keep | FSRS-6 | Scheduler changes require evidence rather than novelty |

Any proposed feature must answer four questions:

1. Does it improve A1 mastery?
2. What measurement would show that it fails?
3. Can it be isolated architecturally?
4. Can it be deleted without disturbing lesson, planner or learner records?

If those questions cannot be answered, the feature is not added.

---

# 5. Gate 0: legal provenance before public release

Rights verification moves from the end of the roadmap to the beginning.

No publicly released vocabulary or derived instructional artifact may depend on unclear redistribution rights.

Preferred solution:

- migrate the canonical selection to one or more explicitly redistributable/open sources;
- retain stable internal IDs where technically possible;
- record source lineage independently from learner-facing ordering;
- attach license/provenance metadata to every canonical item;
- make missing or incompatible provenance a CI failure.

Required machine-readable record:

```text
source_id
source_name
source_version
source_url_or_identifier
license
license_version
redistribution_allowed
derivative_work_allowed
attribution_requirement
retrieved_at
content_hash
```

**Gate 0 passes only when every distributed canonical source item has accepted provenance.**

If legal interpretation remains genuinely ambiguous, the item does not enter the production corpus.

---

# 6. Autonomous content assurance

## 6.1 Content standard

Every A1 sense must contain:

- exact English lemma;
- part of speech;
- precise A1-relevant sense;
- concise natural Persian gloss;
- one-sentence Persian explanation where helpful;
- grammatical information;
- Persian grammar explanation where needed;
- pedagogically distinct natural examples;
- Persian translations for every learner-facing example;
- a valid common-error pair where pedagogically appropriate;
- separate Persian translations of wrong and corrected sentences;
- usage guidance for relevant function words and ambiguity-prone items;
- curriculum-safe task vocabulary;
- machine-verifiable provenance;
- content version;
- assurance result.

The system must distinguish:

**required semantic fields** from **fields that only make sense for certain word classes**.

It must not manufacture fake usage notes or mistakes simply to satisfy a schema.

---

# 7. The content compiler

Content validation becomes compiler-like.

## Stage C1 — Structural validation

CI rejects:

- invalid schema;
- duplicate stable IDs;
- missing mandatory fields;
- malformed Unicode;
- unexpected language direction;
- missing translations;
- identical `wrongFa` and `rightFa`;
- duplicated examples;
- unresolved source references;
- release records pointing at the wrong version;
- unknown vocabulary dependencies;
- untaught target references.

## Stage C2 — Script/language validation

Automatically classify spans.

Examples:

- Persian fields must predominantly contain Persian script where appropriate;
- English fields must not accidentally contain untranslated Persian fragments;
- bilingual fields must explicitly declare direction boundaries.

Language detection is a structural signal, not a proof of correctness.

## Stage C3 — Curriculum-frontier validation

For every lesson, task and scene:

- identify lexical items;
- normalize inflections;
- map them to known lemma/sense records;
- compare against the learner's curriculum frontier;
- allow named entities or unavoidable support language only through explicit support metadata.

A task containing unsupported vocabulary fails.

## Stage C4 — Translation verification

For each English↔Persian semantic pair:

1. candidate translation;
2. independent back-translation;
3. semantic-equivalence scoring;
4. contradiction detection;
5. key-meaning preservation;
6. Persian naturalness judgment;
7. sense-disambiguation judgment.

No single translation metric determines release.

## Stage C5 — English linguistic judge

Independent model checks:

- grammar;
- naturalness;
- register;
- collocation;
- sense fidelity;
- grammatical pattern;
- example validity;
- common-error validity.

The judge receives a fixed rubric.

## Stage C6 — Persian linguistic judge

A separately prompted/configured judge checks:

- correctness;
- naturalness;
- educational clarity;
- colloquial versus formal appropriateness;
- ambiguity;
- false-friend risk;
- literal-translation artifacts.

## Stage C7 — Pedagogical judge

Checks:

- suitability for Persian-speaking A1 learners;
- cognitive load;
- whether the example actually teaches the target;
- whether distractors test the intended distinction;
- whether a mistake explanation explains the mistake;
- whether examples add distinct instructional value.

## Stage C8 — Adversarial judge

This judge's task is not to approve.

Its task is:

> Find a concrete reason this item should not be released.

Potential attack classes include:

- mistranslation;
- misleading gloss;
- incorrect collocation;
- example not matching sense;
- hidden higher-level vocabulary;
- ambiguous distractor;
- culturally confusing wording;
- answer leakage;
- wrong common-error explanation;
- syntactic mismatch;
- contradictory Persian text.

## Stage C9 — Cross-judge arbitration

Judges produce structured findings rather than prose approval.

Example:

```json
{
  "criterion": "sense_fidelity",
  "result": "pass",
  "confidence": 0.97,
  "evidence": ["example_2", "gloss_fa"],
  "reason_code": null
}
```

Release rules:

- deterministic hard failure → reject;
- high-confidence semantic failure → reject;
- material judge disagreement → quarantine;
- insufficient confidence → regenerate or re-evaluate;
- unanimous/qualified consensus → continue.

Majority voting is not enough for high-risk errors.

A strong minority veto may block release.

---

# 8. Automatic repair loop

Failure does not create a human ticket by default.

It creates a **machine diagnosis**.

Example:

```text
FAILED:
wrongFa_semantically_matches_rightFa

FIELD:
mistake.wrongFa

ACTION:
regenerate_field_only

PRESERVE:
lemma
sense
rightSentence
rightFa
examples
grammar
stableId
```

The system repairs only the defective field.

Then the entire dependent verification chain reruns.

Maximum retry count is bounded.

After repeated failure:

`QUARANTINED_AUTOMATICALLY`

The rest of the unit may continue if curriculum dependencies permit.

---

# 9. Example-quality requirements

A simple “≥3 examples” rule is insufficient.

Examples should be **pedagogically distinct**.

Where three examples are useful, aim for:

1. canonical/basic usage;
2. grammatical or collocational variation;
3. everyday contextual use.

Machine checks should detect:

- near-duplicate sentences;
- superficial noun substitution;
- identical grammatical pattern repeated unnecessarily;
- target-word misuse;
- examples whose translation obscures the intended distinction.

Some simple senses may legitimately need fewer examples.

The rubric should optimize instructional value, not raw count.

---

# 10. Scene and discourse redesign

Scenes must measure comprehension rather than merely vocabulary recognition.

Each unit should contain at least two meaningful scenes, but quantity alone is not sufficient.

Every scene should contain:

- already introduced target vocabulary;
- natural discourse;
- contextual clues;
- at least two comprehension questions;
- at least one higher-level relation/inference question where appropriate;
- minimal unnecessary vocabulary;
- listening-capable text where audio exists.

Question types should include:

- who;
- where;
- what happened;
- why;
- order of events;
- true/false;
- simple inference;
- reference resolution.

A **scene coverage matrix** tracks which senses are recycled through meaningful discourse.

A1 completion requires coverage, not merely a fixed number of scenes.

---

# 11. Learning architecture

The first-session learning path remains:

**Teach → typed retrieval → listening → context/use → delayed retrieval**

Afterward:

**FSRS-6 scheduling + interleaving + contextual recycling**

## L1 — Measure true lesson time

Record:

- teach-card dwell;
- response time;
- audio playback;
- correction time;
- context reading;
- active-visible time.

Idle periods are excluded using a defined timeout.

The planner's estimated duration is derived from real distributions.

## L2 — Recycle previous vocabulary

Later lessons inject due or nearly-due words into meaningful context.

Recycled words:

- consume review budget;
- do not consume new-word allowance;
- should not make the lesson unpredictable.

## L3 — Adaptive short path

The system may shorten unnecessary first-session repetition when evidence is strong.

Do **not** use raw speed as the primary criterion.

Primary criteria:

- first-attempt typed correctness;
- first-attempt listening correctness;
- confidence/consistency across required checks.

Response latency may contribute weakly, but must not penalize:

- careful readers;
- motor differences;
- assistive technologies;
- accessibility settings;
- slower devices.

Delayed retrieval remains mandatory.

## L4 — Backlog-aware daily load

New words are reduced when overdue review burden increases.

The learner should never be punished by an expanding queue created by the system itself.

## L5 — Mastery vocabulary

Learner-facing states have formal definitions.

Recommended:

**New**  
No sufficient evidence yet.

**Learning**  
Initial encounters are underway.

**Ready for now**  
Current-session evidence is satisfactory.

**Due**  
Scheduled retrieval is required.

**Retained**  
Successful retrieval after predefined delay criteria.

**Mastered**  
Only used if a strict longitudinal criterion is met.

Avoid labels implying permanent knowledge.

---

# 12. Automated audio certification

No routine human listening gate.

Every required release clip passes a machine audio pipeline.

## A1 — Canonical pronunciation representation

Normalize pronunciation into a common representation.

Handle systematic equivalences including:

- rhotic notation;
- stress markers;
- length notation;
- syllabic consonants;
- dialect-dependent vowel representations.

Literal IPA-string mismatch must not trigger false failures.

## A2 — TTS candidate generation

For each required item and accent:

- create multiple candidate renders where necessary;
- preserve voice/version parameters;
- store synthesis provenance.

## A3 — Signal integrity

Reject:

- clipping;
- truncation;
- excessive silence;
- anomalous duration;
- corrupt audio;
- unusable loudness;
- severe noise/artifact;
- missing beginning/end.

## A4 — ASR verification

Run independent recognition.

The recognized lexical form must match the intended item within accent-aware rules.

## A5 — Phoneme verification

Use phoneme recognition and/or forced alignment.

Check:

- consonant substitutions;
- vowel-class substitutions;
- syllable deletion/addition;
- stress anomalies where measurable;
- severe segment-duration anomalies.

## A6 — Multi-system agreement

No single recognizer is authoritative.

A release decision combines:

- ASR result;
- phoneme/alignment result;
- canonical pronunciation;
- acoustic quality;
- expected accent.

Disagreement triggers regeneration or quarantine.

## A7 — Audio assurance

Each word/variant receives an audio certificate.

Example:

```text
word: work
accent: en-GB
audio_version: 14

signal_integrity: PASS
asr_1: PASS
asr_2: PASS
phoneme_alignment: PASS
syllable_structure: PASS
duration: PASS
acoustic_quality: PASS

AUDIO_CERTIFIED
```

## A8 — Unit audio packs

Offline audio is packaged per unit.

Learners download only what they need.

The service worker:

- records pack version;
- validates integrity;
- supports replacement;
- survives interrupted download;
- preserves working previous packs until replacement is valid.

---

# 13. Voice selection without a manual voice panel

Voice choice should combine:

- intelligibility;
- pronunciation pass rate;
- phoneme/alignment quality;
- synthesis stability;
- acoustic-naturalness estimates;
- sentence-level consistency;
- real learner behavior after controlled exposure.

No voice wins solely because a model labels it “pleasant.”

After release, aggregate learner signals can expose:

- repeated replay;
- unusually high listening failures;
- accent-specific confusion;
- abandonment after audio;
- systematic word-level listening errors.

A voice change is a versioned intervention, never a silent global replacement.

---

# 14. Autonomous usability testing

Manual first-session observation is replaced by two layers:

1. deterministic browser/device testing;
2. goal-driven autonomous user agents.

## U1 — Core navigation

Four primary destinations maximum.

Today presents:

- one next action;
- due review;
- streak;
- minimal secondary information.

## U2 — Practice

Only:

- Smart Practice;
- Listening;
- Spelling.

Smart Practice selects exercise types according to learning evidence.

## U3 — Bidi correctness

Automated browser checks detect unsafe mixed-direction rendering.

Every bilingual run must carry explicit direction/language boundaries where needed.

## U4 — Accessibility automation

Every route is tested for:

- semantic landmarks;
- labels;
- focus order;
- keyboard navigation;
- touch-target size;
- contrast;
- text resizing;
- zoom;
- reduced motion;
- screen-reader semantics;
- dynamic announcements;
- error association.

## U5 — Synthetic learner agents

Goal-based agents execute:

- first launch;
- onboarding;
- first lesson;
- wrong answers;
- audio replay;
- review;
- lesson interruption;
- reload;
- offline transition;
- update;
- backup/export;
- restore;
- return after long absence.

Agents should operate from goals, not merely predetermined selectors.

## U6 — Device profiles

At minimum emulate:

- narrow Android phone;
- mid-size Android;
- Android tablet;
- iPhone Safari dimensions;
- desktop;
- slow CPU;
- slow connection;
- intermittent connection;
- 200% text;
- keyboard-only mode;
- reduced motion.

## U7 — Failure heuristics

Automatically flag:

- impossible completion;
- navigation loops;
- repeated backtracking;
- excessive interaction count;
- hidden actions;
- obstructed keyboard;
- overflow;
- unreachable focus target;
- ambiguous primary action;
- dead end;
- unexpected toast/error;
- lost progress.

---

# 15. Dependability

Standard:

> a learner action that appears saved must never silently disappear.

## D1 — Existing transactional protection

Preserve:

- write-ahead behavior;
- atomic state transitions;
- recovery UI;
- multi-tab protection;
- offline release integrity.

## D2 — Long-history stress

Run automated browser tests with large synthetic histories.

Examples:

- 10,000+ events;
- 2,000 scheduled cards;
- large streak history;
- repeated app updates;
- stale tabs.

## D3 — Low-storage stress

Test:

- persistence denied;
- quota exhaustion before lesson;
- quota exhaustion during answer;
- interrupted audio-pack install;
- failed update download.

UI must never claim persistence that did not occur.

## D4 — Crash/reload matrix

Interrupt at each state transition:

`before answer`  
`during answer`  
`after answer before next item`  
`during schedule update`  
`during lesson completion`

Reload must reconstruct a coherent state.

## D5 — Sync removed from A1 critical path

Do not spend A1 completion time making sync production-ready.

Sync remains disabled.

If it becomes a future requirement, it receives its own roadmap and gate.

---

# 16. Performance

Target mobile field p75:

- LCP ≤ 2.5 s;
- INP ≤ 200 ms;
- CLS ≤ 0.1.

## P1 — A1-only initial payload

Do not fetch:

- higher-level lexicons;
- unused reference datasets;
- optional practice data;
- future-level content.

## P2 — Lazy capability loading

Load noncritical functionality only when opened.

## P3 — Field telemetry

Privacy-preserving Web Vitals are recorded:

- no personal identifier;
- once per load where appropriate;
- coarse device/performance class;
- production version;
- content channel.

## P4 — Performance regression gate

A PR or release cannot exceed agreed bundle and lab budgets without an explicit change to the budget record.

---

# 17. Machine Assurance Record

Every releasable sense receives an immutable assurance result.

Example:

```text
TARGET
stable_id: a1.take.01
content_version: 17

PROVENANCE
source: PASS
license: PASS
hash: PASS

STRUCTURE
schema: PASS
language_fields: PASS
curriculum_frontier: PASS
duplicates: PASS

LINGUISTIC
english_grammar: PASS
sense_fidelity: PASS
collocation: PASS
example_naturalness: PASS

PERSIAN
translation_accuracy: PASS
naturalness: PASS
back_translation: PASS
ambiguity: PASS

PEDAGOGY
a1_suitability: PASS
example_diversity: PASS
task_validity: PASS
distractor_validity: PASS

ADVERSARIAL
critical_findings: 0

AUDIO
en-US: CERTIFIED
en-GB: CERTIFIED

RELEASE
status: CERTIFIED
```

A content modification invalidates all dependent certificates.

No stale approval survives a semantic change.

---

# 18. Model and evaluator provenance

AI-based assurance is only reproducible if the evaluators themselves are versioned.

For every generated or judged artifact, store:

- provider/model identifier;
- model snapshot/version where available;
- prompt template version;
- rubric version;
- generation parameters;
- timestamp;
- source content hash;
- output hash;
- judge result;
- confidence;
- failure code.

If an evaluator changes materially, previously released content is not silently recertified.

Instead:

- existing certification remains attached to its original evaluation stack;
- new/modified content uses the new stack;
- periodic shadow re-evaluation detects evaluator drift.

---

# 19. Automated disagreement and drift monitoring

The system tracks:

- rejection rate;
- judge disagreement rate;
- translation disagreement;
- audio regeneration rate;
- per-rule failure rate;
- model-specific anomalies;
- unit-specific anomalies.

A sudden change after switching models or prompts is treated as an infrastructure event.

Example:

```text
baseline disagreement: 3.8%
new evaluator disagreement: 14.2%

STATUS: EVALUATOR_DRIFT
ACTION: stop automatic release
```

This is one of the few situations where automatic release globally fails closed.

---

# 20. Release architecture

Release is staged.

## R1 — Draft

Generated and editable.

Not visible to ordinary learners.

## R2 — Machine-certified

All required content and audio assurance gates pass.

## R3 — Canary

Small controlled production exposure.

Monitor:

- runtime errors;
- learning-flow failures;
- unusual abandonment;
- answer anomalies;
- listening anomalies;
- performance regressions.

## R4 — Released

Canary remains healthy and deployment/version checks pass.

## R5 — Withdrawn

A released version may be removed if:

- certification defect discovered;
- regression detected;
- outcome evidence indicates systematic instructional failure;
- provenance issue emerges.

---

# 21. Production channel

Production should not move to `released` merely because engineering is ready.

Required sequence:

1. release infrastructure prepared;
2. Gate 0 provenance passes;
3. Unit 1 machine certification passes;
4. audio certification passes;
5. autonomous UX gate passes;
6. smoke verification passes;
7. production channel switches to `released`.

The original plan's sequencing ambiguity is removed.

---

# 22. Rollback

Rollback is tested, not merely documented.

Automated or rehearsed workflow verifies:

- previous Cloudflare deployment reachable;
- `/api/version` correct;
- content channel correct;
- previous offline release remains usable;
- incompatible local state does not strand the learner.

Rollback status becomes part of operations evidence.

---

# 23. Learner evidence replaces reviewer evidence

A machine can verify content consistency.

A machine cannot prove that humans remember vocabulary.

Real learners therefore provide the final outcome signal through ordinary use or controlled studies.

The system measures:

- first-session correctness;
- delayed recall;
- listening recall;
- spelling recall;
- context performance;
- review frequency;
- relearning;
- active treatment time;
- retention;
- attrition;
- per-word difficulty;
- per-sense difficulty.

This is not human-in-the-middle review.

It is **real-world outcome measurement**.

---

# 24. Pilot redesign

The 30-day pilot remains, but operation and analysis are automated.

Before enrolment, freeze:

- protocol version;
- eligibility rules;
- arm definitions;
- allocation method;
- primary outcome;
- secondary outcomes;
- delayed-assessment interval;
- treatment-time definition;
- minimum exposure;
- attrition handling;
- missing-data handling;
- analysis population;
- stopping conditions;
- decision thresholds.

Nothing may be selected after outcome inspection simply because it produces a favorable result.

## Primary outcome

Use a learning-centered measure such as:

**held-out delayed recall-and-use per active treatment hour**

rather than raw session completion.

## Secondary outcomes

Include:

- delayed listening recall;
- spelling;
- review burden;
- first-session completion;
- retention by word;
- retention by unit;
- attrition;
- active minutes;
- accessibility/device completion differences.

## Interpretation

A 20–40 learner pilot is evidence for:

- feasibility;
- usability;
- direction of learning effects;
- parameter estimates;
- defect discovery.

It is not automatically proof that Vajefy is superior to every alternative.

Claims must remain proportional to evidence.

---

# 25. Automated study operation

The system handles:

- eligibility;
- randomization where applicable;
- treatment assignment;
- protocol locking;
- exposure logging;
- export;
- outcome computation;
- confidence intervals;
- attrition reporting;
- protocol-deviation detection.

The evaluator should fail closed when:

- protocol version changes;
- content version drifts;
- unplanned assessment items appear;
- treatment assignment becomes inconsistent;
- outcome definitions change.

---

# 26. Continuous outcome diagnostics

After release, the system detects learning failures automatically.

Example:

```text
TARGET: although

first_session_recall: strong
day_7_recall: weak
context_error_rate: high
listening_error_rate: normal

DIAGNOSIS:
likely contextual-semantic weakness
```

The system can then generate a candidate remediation:

- clearer explanation;
- stronger contrast;
- additional context;
- better recycling;
- improved distractor;
- different curriculum placement.

The candidate does **not** immediately replace production content.

It re-enters the full certification pipeline.

---

# 27. Controlled self-improvement

The system must never freely rewrite its own curriculum in production.

Self-improvement uses:

**observe → diagnose → generate candidate → certify → shadow/canary → evaluate → release**

Every change remains:

- versioned;
- reversible;
- measurable;
- attributable.

This prevents optimization loops from turning learner behavior into uncontrolled content drift.

---

# 28. Question-engine unification

For A1 there is exactly one canonical question/evidence engine.

Smart Practice, Listening and Spelling consume the same enhanced sense interface used by lessons.

They share:

- target IDs;
- prompt IDs;
- grading semantics;
- evidence events;
- copy definitions;
- directionality rules.

The legacy raw-dataset engine may remain isolated only for frozen higher levels until those levels are eventually migrated or removed.

It is not part of the A1 architecture.

---

# 29. Learner-facing number audit

Every displayed number must have a formal definition.

Examples:

| Number | Meaning |
|---|---|
| Due | FSRS items currently scheduled for retrieval |
| Streak | Consecutive qualifying learning days under the defined rule |
| Ready for now | Current-session criteria satisfied |
| Retained | Delayed evidence criterion satisfied |
| Accuracy | Correct eligible responses / eligible attempts within a defined window |
| Lesson estimate | Predicted active treatment time |
| Progress | Curriculum completion under explicitly defined rules |

No metric may quietly change definition between screens.

---

# 30. Feature ledger

Maintain `docs/FEATURES.md`.

Each shipped feature records:

- feature;
- directory;
- learning purpose;
- success metric;
- failure/removal criterion;
- dependencies;
- last review;
- current status.

Quarterly automated reports identify features whose metrics provide no evidence of value.

Deletion is considered a successful product outcome.

---

# 31. Status ledger

`A1_PLAN_STATUS.md` is authoritative for implementation state.

Every task has:

- ID;
- state;
- first commit;
- completion commit;
- evidence artifact;
- release impact.

Suggested states:

```text
NOT_STARTED
IN_PROGRESS
BLOCKED
MACHINE_PASS
CANARY
DONE
DEFERRED
REMOVED
```

CI checks internal consistency.

---

# 32. What will not be built before A1 completion

The following remain out of scope:

- conversational AI tutor;
- automatic pronunciation scoring presented as authoritative feedback;
- additional games;
- leaderboards;
- badges/reward shops;
- social features;
- custom decks;
- user imports;
- CMS;
- native apps;
- new backend;
- A2 curriculum expansion;
- experimental scheduler replacement;
- account system;
- production sync.

The purpose is not technological minimalism.

It is **epistemic discipline**.

Every additional system creates another way to be wrong.

---

# 33. Implementation sequence

## Phase 0 — Gate definitions and provenance

Complete first:

- source-rights migration/verification;
- machine-readable provenance;
- release-state definitions;
- mastery-label definitions;
- assurance schema;
- model provenance format;
- pilot protocol skeleton.

### Exit condition

No unresolved legal/provenance dependency blocks a future public release.

---

## Phase 1 — Shrink and make failure visible

Implement:

- strict content compiler;
- Persian-field checks;
- wrong/right semantic checks;
- curriculum-frontier validation;
- duplicate/near-duplicate detection;
- three-mode Practice;
- remove dead A1 modes;
- remove chunk decks from A1 loading;
- remove XP from primary screens;
- feature ledger;
- A1-only loading;
- improved pronunciation normalization;
- machine-assurance record format.

### Exit condition

Current imperfect content fails loudly and for specific counted reasons.

The product surface is materially smaller.

---

## Phase 2 — Autonomous certification pipeline

Implement:

- English linguistic judge;
- Persian linguistic judge;
- translation/back-translation verification;
- pedagogical judge;
- adversarial judge;
- arbitration;
- retry/repair;
- quarantine;
- model provenance;
- evaluator-drift checks.

Run Units 1–3 first.

### Exit condition

Units 1–3 can move from draft to machine-certified with no routine human approval.

---

## Phase 3 — Audio certification

Implement:

- normalized pronunciation representation;
- TTS provenance;
- signal integrity;
- ASR verification;
- phoneme/alignment verification;
- multi-system agreement;
- automatic regeneration;
- per-unit audio packs.

### Exit condition

Every required Unit 1–3 word/accent pair has a valid audio certificate.

---

## Phase 4 — Lesson and curriculum calibration

Implement:

- active-time measurement;
- backlog adaptation;
- contextual recycling;
- accessibility-safe short path;
- scene comprehension;
- scene coverage matrix.

### Exit condition

Lesson duration is measured rather than assumed and content recycling is visible in evidence.

---

## Phase 5 — Autonomous UX assurance

Implement:

- bidi lint;
- expanded accessibility suite;
- goal-driven learner agents;
- low-storage scenarios;
- interrupted lesson scenarios;
- update/reload scenarios;
- device/performance matrix.

### Exit condition

No blocking synthetic learner journey fails.

---

## Phase 6 — Production canary

Requirements:

- Gate 0 passed;
- Unit 1 machine-certified;
- audio-certified;
- autonomous UX passed;
- rollback verified;
- content channel configured;
- smoke verification passing.

Release Unit 1 to a controlled production slice.

### Exit condition

Canary telemetry shows no blocking regression.

---

## Phase 7 — Units 1–3 release

Complete certification for Units 1–3.

Freeze the experiment protocol.

Set production to released content.

### Exit condition

The product has a complete, certified pilot curriculum.

---

## Phase 8 — 30-day outcome pilot

The system automatically operates the experiment.

Engineering continues with Units 4–12.

Do not change the experiment's instructional treatment mid-study except for safety/correctness fixes, which must be recorded as protocol deviations.

### Exit condition

An automatically produced report contains:

- primary outcome;
- uncertainty;
- secondary outcomes;
- attrition;
- protocol deviations;
- device/accessibility segmentation;
- treatment time;
- learning-efficiency measures.

---

## Phase 9 — Complete A1

Continue:

- content generation;
- assurance;
- scenes;
- audio;
- unit packaging;
- question-engine migration;
- low-storage reliability;
- operations.

### A1 COMPLETE gate

All must be true:

- 900/900 canonical A1 entries have valid provenance;
- 900/900 current-version entries machine-certified;
- every required word/accent clip certified;
- no unresolved critical assurance disagreement;
- every unit has meaningful comprehension scenes;
- curriculum recycling coverage meets its threshold;
- one A1 question engine is authoritative;
- complete device/accessibility automation passes;
- field p75 performance meets budget;
- rollback works;
- outcome pilot completed;
- results reported honestly;
- production channel verified;
- no A2 work has bypassed the gate.

Only then does A2 become eligible for planning.

---

# 34. Quality scorecard

A1 should have a continuously generated scorecard.

## Content

- certification coverage;
- quarantine count;
- semantic failure rate;
- translation disagreement;
- example-diversity failures;
- curriculum leakage.

## Audio

- certification coverage;
- regeneration rate;
- ASR disagreement;
- alignment disagreement;
- playback failures;
- real listening error rate.

## Learning

- first-session success;
- delayed recall;
- retained words per active hour;
- review burden;
- relearning rate;
- difficult-word distribution.

## UX

- autonomous task completion;
- interaction count;
- accessibility violations;
- dead ends;
- device failures.

## Reliability

- save failures;
- recovery events;
- quota failures;
- corrupt-pack recoveries;
- update failures.

## Performance

- LCP;
- INP;
- CLS;
- first-load bytes.

## Scope

- feature count;
- primary destinations;
- dead-code count;
- bundle contribution by feature.

---

# 35. Failure policy

The system must know when **not to decide**.

Possible statuses:

```text
PASS
FAIL
UNCERTAIN
DISAGREEMENT
QUARANTINED
```

`UNCERTAIN` is not converted to `PASS`.

`DISAGREEMENT` is not solved automatically by simple majority when the disputed criterion is safety-critical to instruction.

The pipeline may:

- rerun using another evaluator;
- generate fresh candidates;
- increase verification diversity;
- quarantine.

Abstention is a feature.

---

# 36. Cost discipline

Automation can become expensive if every field is repeatedly judged by large models.

Use a risk-tiered pipeline.

## Tier 1 — deterministic

Cheap checks run universally.

## Tier 2 — lightweight semantic

Run universally where inexpensive models are sufficiently reliable.

## Tier 3 — high-capability verification

Triggered for:

- ambiguous translations;
- disagreement;
- function words;
- confusing senses;
- known high-error classes;
- regenerated content;
- adversarial failures.

## Tier 4 — quarantine

Repeatedly problematic material stops consuming resources until a new remediation strategy is available.

Quality remains the priority, but compute is spent where uncertainty exists.

---

# 37. Security and prompt robustness

Content-processing models operate on structured input.

External text should never be interpreted as operational instructions.

The pipeline:

- separates data from instructions;
- uses fixed schemas;
- validates tool outputs;
- strips unsupported markup;
- prevents curriculum text from changing system behavior;
- records unexpected model-output structures as failures.

Generated content is untrusted input until certified.

---

# 38. Why this architecture is stronger than human-in-the-loop review

A human review workflow has strengths, but it also creates:

- throughput limits;
- reviewer inconsistency;
- version mismatch;
- fatigue;
- sampling;
- scheduling dependency;
- undocumented judgments;
- difficult reproducibility.

The autonomous system is intended to provide:

- 100% coverage;
- repeatable rubrics;
- exact artifact/version binding;
- immediate revalidation;
- disagreement visibility;
- failure codes;
- reproducibility;
- scalable rechecking.

It should not pretend machine judgment is infallible.

Its safety comes from **redundancy, independence, abstention, real-world evidence and immutable provenance**.

---

# 39. The role of humans after this redesign

Humans are no longer an operational dependency.

Optional uses include:

- external audit;
- research collaboration;
- legal consultation where unavoidable;
- red-team exercises;
- interpretation of major product strategy.

None of these should be required for each unit or each release.

Routine production is autonomous.

---

# 40. Final product definition

The final A1 Vajefy should feel much simpler than the machinery underneath it.

The learner sees:

**Today**

one next action.

**Learn**

a carefully controlled sequence.

**Review**

what is actually due.

**Practice**

Smart Practice, Listening or Spelling.

Behind those simple screens is a much stricter system:

**versioned curriculum  
+ deterministic validation  
+ multi-model linguistic assurance  
+ adversarial checking  
+ audio certification  
+ autonomous accessibility/UX testing  
+ offline reliability  
+ controlled release  
+ real learner evidence  
+ continuous diagnostics**

That is the target.

The product should not win by having the most features.

It should win because a learner can trust almost everything it does.

---

# 41. First implementation package

The first engineering package should contain exactly these items:

1. **Gate 0 provenance framework**
2. **Content assurance schema**
3. **C1 strict deterministic validator**
4. **Translation/wrong-right sanity validation**
5. **Curriculum-frontier validator**
6. **Example-duplication/diversity detection**
7. **Three-mode Practice consolidation**
8. **Removal of deprecated A1 routes/code**
9. **A1-only initial data loading**
10. **Machine Assurance Record infrastructure**
11. **Model/prompt/rubric provenance**
12. **`A1_PLAN_STATUS.md` migration to the new state model**

Only after that foundation is merged should automated content repair start.

This ordering is deliberate:

> first define what can be trusted, then generate at scale.

---

# 42. Final principle

Vajefy's development rule is:

> **Do not ask whether AI can generate it. Ask whether the system can detect when the generated result is wrong.**

If the answer is no, the feature or content is not ready for autonomous production.

If the answer is yes, automate the full cycle.

The resulting system is not “AI instead of humans.”

It is:

> **deterministic constraints + independent AI verification + adversarial checking + abstention + controlled deployment + real learner outcomes.**

That is the architecture capable of removing humans from the middle without removing quality control.
