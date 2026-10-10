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
| GATE0-RIGHTS | Gate 0 rights for every distributed source | BLOCKED | `a2d5b50` | — | `content/assurance/provenance.json`; `content/assurance/rights-lineage.json`; `docs/RIGHTS_MIGRATION.md`; `content/assurance/owner-authorship-attestation.json` | release-gate | The Oxford-derived workbook's licence, redistribution and derivative rights are UNVERIFIED. Needs the owner to document the rights, or a migration to an openly licensed source (plan §5). Never mark it cleared without evidence. Source rights remediation now has an auditable, fail-closed per-item lineage inventory for all 900 A1 source entries and 60 public JSON files (22 catalogue files plus 38 generated enhanced lessons), 30 original scene/contrast units, plus two public audio/artwork media groups (`scripts/rights-lineage-audit.ts`, `scripts/check-rights-lineage.ts`, `docs/RIGHTS_MIGRATION.md`), cross-checked against current source/content SHA-256 before any item can be marked cleared. Legacy dependencies and artefacts remain UNVERIFIED; 0/900 entries, 0/60 public JSON files, 0/30 scenes/contrasts and 0/2 public media groups are cleared. A verified Open English WordNet 2025 CC BY 4.0 + Princeton WordNet licensing route is documented for a genuine independent rebuild, but has NOT been used to relicense existing Oxford-derived text. The strict Gate 0 stays BLOCKED until authorisation or full clean-source reconstruction, plus public media rights audit, has supporting evidence. Machine assurance records were regenerated against the expanded but still UNVERIFIED source manifest by one-use workflow 37819377322 (commit `7022983`); no rights verdict or learner content was cleared. The repository was verified public on 2026-10-08. PR #156 (merge `9d091de`) removed the unverified Oxford-derived workbook from current Git HEAD and added a non-reintroduction `validate:data` check. This is exposure reduction only: the workbook remains reachable in historical Git objects until an owner-coordinated history rewrite, and derived source/content rights remain UNVERIFIED. The expanded inventory recursively checks generated JSON and independently records all 14 scenes and 16 contrast lessons, with exact SHA-bound evidence and complete-coverage checks (`scripts/rights-lineage-audit.ts`, PR #157). Gate 0 remains BLOCKED, not an approval of underlying copyright or source rights. Independent OEWN 2025 intake staged 250 SHA-verified, unreviewed lexical candidates in `content/rights-staging/` (not the release corpus); official tag counts were zero, so sense-count is only an ordering heuristic, never CEFR/frequency proof. After audio-generated lesson filename churn, eight inherited `public/data/enhanced/*.json` assignments were replaced with their exact new paths under the still-UNVERIFIED workbook source, with zero rights approvals. Full Gate 0 remains BLOCKED until independent lesson/media rights and SHA-bound approvals exist. A separate independent-authoring staging slice adds 25 bilingual A1 draft entries sourced by exact candidate ID from the SHA-pinned OEWN 2025 intake, not from legacy lesson text, with full semantic/Persian review still pending. `scripts/rights/check-editorial-drafts.ts` and unit tests reject source-key drift, purported approvals, duplicate drafts and direct/long inherited phrase reuse; this structural checker runs in `validate:data` and makes no rights/CEFR claims. No existing learner-facing A1 entries, public assets, source assignments or item clearances were changed; Gate 0 stays BLOCKED. The following second independent editorial staging batch doubles unapproved OEWN-linked bilingual drafts from 25 to 50 of 250 intake candidates; all 50 still require lexical sense, Persian, pedagogical, and rights reviews before release. The checker now rejects embedded ten-word Persian overlaps with legacy lesson translations, including Arabic/Persian character variants, with regression tests. This reduces neither the unverified legacy rights inventory nor the Gate 0 blocker. Source-level provenance validation now rejects a purported `cleared` record without any rights/license evidence reference or with `attribution=unknown`, with negative regression tests; the original unverified records remain structurally valid and BLOCKED. This is anti-bypass enforcement, not actual rights approval. Pinned OEWN 2025 sense-validation follow-up (2026-10-09): independent source SHA-256 `38b16326…` verified against official 2025 WNDB download; 250/250 exact WordNet sense keys resolved into unapproved, attributable staging synset references (`content/rights-staging/oewn-2025-sense-references.json`, `docs/OEWN_SOURCE_ATTRIBUTION.md`). Real source glosses exposed lexical-sense errors in several existing independent draft meanings; all 50 drafted items point to non-primary WordNet senses (sense ordinal >1), requiring item-by-item re-keying and linguistic review. A per-item validator and regressions reject missing/forged WordNet evidence, altered glosses and claimed approvals. No canonical/public A1 content, rights-lineage clearance or source-licence labels changed; Gate 0 is still BLOCKED. The full upstream OEWN 2025 + Princeton WordNet licence text is also retained unmodified in staging and checked by its pinned Git blob SHA (`content/rights-staging/OEWN-2025-LICENSE.md`). This credits only newly staged WordNet extracts, not the legacy corpus; no Gate 0 clearance implied. Unapproved-sense reconstruction catalogue (2026-10-09): official OEWN 2025 archive SHA-256 `38b16326…` independently rechecked by one-use run 37858584175, yielding 1,086 WordNet lexical senses across the 50 separately authored staging drafts (`content/rights-staging/oewn-2025-draft-alternatives.json`). Each candidate preserves its originally pinned reference, all matching WNDB synset gloss SHA-256 hashes and its unapproved state; none of the 50 has an automatically selected/approved alternative. All 19 Python source-integrity regressions pass, including fake-approval and tampered-gloss rejections; offline validation runs in `validate:data`. This does not replace any inherited public lesson, source assignment or license and does not clear Gate 0. 2026-10-09 audio certification introduced three new SHA-named enhanced lesson files; their previous unverified legacy-source inventory assignments were reconciled to the exact new paths without rights approval or invented licence evidence. Gate 0 is still BLOCKED and zero items are cleared. Production safety addition: the versioned `npm run deploy` command now executes the strict `assurance:gate0` before build and Wrangler upload; unit tests guard ordering. Cloudflare Workers Builds defaults to direct `npx wrangler deploy`, which bypasses npm, so the owner must change that external Deploy command to `npm run deploy`; no dashboard setting or live-site takedown is claimed. This blocks future npm publication, not an existing public site or the underlying unverified rights. A pinned NGSL 1.2 alternative source lookup now accounts for all 900 A1 catalogue IDs (838 direct matches, 59 unreviewed related-lemma suggestions, CD/DVD/oh lacking a match) with 787 tied to NGSL core, 49 supplementary and 61 to the wider NGSL-associated SFI 31k extension. Source CSV and CC BY-SA 4.0 notices, item-by-item JSON/CSV cross-checks and the read-only staging handoff live under `content/rights-staging/ngsl-1.2/` (`docs/NGSL_A1_RIGHTS_ALTERNATIVES.md`, `scripts/rights/check-ngsl-a1-alternatives.ts`). This documents licensed candidate vocabulary-selection input, **not** authorization to redistribute any Oxford-derived entries, lessons, translations, scenes, media or historical Git artifacts. No source assignments or clearances changed; Gate 0 is still BLOCKED and 0 legacy artifacts cleared. Source-attribution expansion for the owner's 2026-10-09 ChatGPT-authorship clarification: a reproducible, SHA-256-bound inventory separately maps all 5,322 legacy A1–C1 lexical records, 2,950 supplementary records, 1,027 A1 teaching senses and 30 authored scenes/contrasts. It marks instructional fields as USER-REPORTED-CHATGPT (not verified against historic prompts), leaves Oxford selection and per-row 3000-vs-5000 membership unverified, and records zero licences/clearances. See `docs/FULL_OXFORD_CHATGPT_AUTHORSHIP_MAP.md` and `scripts/rights/full-legacy-authorship-map.ts`. Gate 0 stays BLOCKED and the production deploy guard remains enforced. The NGSL 1.2 + supplementary + wider-SFI-31k alternative-source comparison has been extended to every 5,322 legacy A1–C1 lexical record, preserving the earlier 900 A1 candidate decisions. Only actual pinned source lemmas/ranks are mapped; nonmatches remain unfilled and every item is NOT_CLEARED. See `docs/NGSL_FULL_5322_ALTERNATIVES.md` and `scripts/rights/ngsl-full-5322.ts`; no current Oxford-derived lesson is relicensed by this mapping. Gate 0 stays BLOCKED. A new, separately staged NGSL frequency-first selection now lists exactly 900 candidate English lemmas with fresh `ngsl:freq:0001–0900` identifiers, chosen solely from the independently licensed, SHA-pinned NGSL 1.2 core and **not** by reordering the Oxford A1 roster. `npm run assurance:ngsl:independent:check` verifies source rank and licence bytes, item count and immutable zero-approval state; see `docs/NGSL_INDEPENDENT_900_SELECTION.md`. It is not CEFR A1 validated and contains zero new authored lessons or rights-cleared items. The old public corpus and Gate 0 remain BLOCKED. A separately staged first batch of 20 newly model-authored bilingual NGSL-ranked editorial drafts (`independent-first-20-drafts.json`) now supplies initial fresh English meaning, Persian guidance and paired examples for NGSL ranks 1–20. The new `assurance:ngsl:drafts:check` validates exact source candidates, fixed zero-approval state and long verbatim English/Persian reuse against inherited text. These are unapproved drafts only, not cleared A1 lessons or production replacements; release Gate 0 remains BLOCKED. Independent rights-staging sense triage (2026-10-09): 46 of 50 existing bilingual OEWN drafts now have pinned, **unapproved** candidate rekey suggestions; 4 (`be`, `have`, `make`, `take`) require splitting polysemous authored meanings before key selection. Each suggestion binds to an existing alternative sense key, full source gloss hash and synset offset; CI rejects forged approvals, source drift or silent promotion (`content/rights-staging/oewn-2025-editorial-sense-proposals.json`, `scripts/rights/check-sense-proposals.ts`, tests). No draft/public lesson/source assignment changed; source redistribution and media rights remain UNVERIFIED, Gate 0 BLOCKED. Another 20 original NGSL-frequency-first bilingual drafts (ranks 21–40) are staged with exact rank provenance and anti-reuse checks, bringing the total to 40/900 **unreviewed** NGSL drafts; rights/semantic/Persian/CEFR approvals and public releases remain zero. The second batch is checked against inherited text plus the first 20 drafts. Gate 0 is BLOCKED. A third author-only NGSL 1.2 staging batch adds 20 bilingual editorial drafts for independently selected ranks 41–60 (total **60/900 unreviewed**), with sense-scoped English/Persian meanings, unique example pairs, source-rank checking, cross-batch long-phrase anti-reuse and negative tests for forged approvals (`independent-ranks-41-60-drafts.json`, `scripts/rights/check-independent-ngsl-drafts.ts`). No inherited content or rights assignment was changed, no licensing/pedagogical/semantic approval claimed, and Gate 0 remains BLOCKED. A follow-up checker refactor now discovers all 20-item NGSL staging files in rank order and fails closed for missing, overlapping, malformed or skipped windows (and compares every new example to inherited and all previous draft examples). This removes the per-batch validator-edit prerequisite while leaving the same 60/900 unreviewed, 0-cleared content; no release or rights proof is inferred. A fourth original NGSL 1.2 frequency-first bilingual staging batch for ranks 61–80 brings author-only drafts to **80/900**, with rank IDs verified dynamically against the licensed pinned candidate selection and 9-word anti-reuse checks against inherited and prior independent content. All semantic/Persian/CEFR/rights approvals remain zero and no public assets are replaced. Gate 0 BLOCKED. Fifth NGSL rank-pinned independent authoring batch (ranks 81–100) adds 20 original bilingual sense-scoped draft records and 40 paired examples, raising the separate replacement syllabus to **100/900 author-only drafts**. `scripts/rights/check-independent-ngsl-drafts.ts` continues to verify contiguous rank/source IDs, unapproved flags, and long inherited/previous-draft phrase reuse. No existing lessons, source rights assignments, audio, site media, semantic votes or A1 CEFR labels were changed; all new drafts remain unreviewed/unreleased and Gate 0 BLOCKED. Sixth original NGSL-frequency bilingual authoring batch now stages source ranks 101–120, for **120/900 new unreviewed source-first draft entries** and 240 newly authored paired bilingual examples across six rank-contiguous batches. These still lack independent sense, Persian, CEFR, rights and public-release approvals, with all flags false. Source licensing for the NGSL *selection* does not retroactively license legacy Oxford-derived lessons or media. Gate 0 remains BLOCKED. 2026-10-09 independent NGSL clean-source authoring (PR #181): added two source-rank-pinned, bilingual staging batches 121–140 and 141–160, bringing the independent syllabus to **160/900 author-only, unreviewed drafts** with 320 original paired examples; a new validator rejects duplicate English or Persian examples within a lesson. Source selection is licensed; independent sense, Persian, CEFR, legal/editorial and media approvals are still **zero**, no legacy content/source assignments were cleared or published, and GATE0-RIGHTS stays BLOCKED. Owner declaration 2026-10-09: all lessons, historical audio, artwork and repository content reported as ChatGPT-generated. `content/assurance/owner-authorship-attestation.json` preserves exact user wording with USER_STATEMENT_ONLY evidence and explicit no-licence/no-clearance semantics; `src/lib/learn/rights-owner-attestation.ts` plus tests and `assurance:rights:owner:check` enforce distinction in `validate:data`. Audio tool/voice terms, third-party inputs, inherited Oxford selection, item hashes and NGSL staging still require independent evidence. No rights approvals, 160/900 draft counts, or learner content are changed; Gate 0 remains BLOCKED. Ninth NGSL-independent bilingual authoring batch adds 20 original unreviewed lessons for ranks 161–180, bringing the replacement syllabus to 180/900 staged drafts and 360 paired bilingual examples. Source rank, draft uniqueness and inherited/previous-batch reuse are checked by existing `assurance:ngsl:drafts:check`; 0 item licences, independent semantic/Persian/A1 reviews, media rights and public replacements are approved. GATE0-RIGHTS remains BLOCKED. Tenth NGSL original bilingual staging batch adds source ranks 181–200: 200/900 unreviewed independent-source candidate drafts with 400 paired examples. The same source/rank and inherited/preceding-draft overlap checks apply; none has independent sense/Persian/CEFR/rights approval, and no public lesson/media changed. Gate 0 remains BLOCKED. Next independent NGSL editorial batches (2026-10-10) stage original bilingual ranks 201–240, advancing source-led drafts 200→240/900, with zero independent approvals or public replacements; the nine-word anti-reuse and source/rank validators remain in force. NGSL words such as government/however/though are not presumed CEFR A1. This staging does not resolve the legacy Oxford workbook rights or media licensing, so Gate 0 remains BLOCKED. Next independent source-led NGSL draft batches cover ranks 241–260 and 261–280 (40 newly authored bilingual staging lessons and 80 example pairs), expanding the clean-source draft candidate inventory from 240/900 to 280/900, with all rights/linguistic/Persian/A1 and release approval flags remaining false. This is authoring only, not evidence clearing inherited public content; Gate 0 stays BLOCKED. Added a read-only SHA-256-bound pending-review packet exporter for all independently staged NGSL bilingual lessons (`scripts/rights/ngsl-review-packets.ts`, `npm run assurance:ngsl:review:packets -- --json --from N --limit M`). It binds each candidate to exact rank, pinned NGSL dataset/licence Git blob IDs, authoring agent and a content digest, retaining five independently unreviewed criteria and explicit `publicRelease=false`. `validate:data` checks the full queue; negative tests reject range/approval shortcuts. This provides review inputs only; it neither runs judges nor clears Gate 0. 2026-10-10 continuation from verified PR #187 (`cd8da10`): four new original bilingual NGSL batches cover ranks 281–360, bringing staging to **360/900 drafts** and 720 paired examples; all independent review, rights and release approvals remain zero. Standalone selection, draft checking and review-packet export now authenticate the actual pinned core CSV and licence bytes through `scripts/rights/pinned-ngsl-source.ts`, then reconstruct and compare all 900 source records instead of trusting manifest-supplied references. Isolated CLI regressions reject altered upstream bytes, forged source/licence references and mutually consistent forged selection/draft lemmas before any evidence output. This verifies source-byte integrity only, not lesson rights, semantic correctness or A1 placement; no inherited public content or media was replaced or cleared. Gate 0 stays BLOCKED; continue authoring at rank 361. PR #188 merged at `b6b43d82017648f49585ec31e43f555f96a73e5b` after full CI/browser/Workers-contract/rollback PASS; the source-authenticated staging selection has 360/900 drafts and zero approvals. |
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
| P1-CHUNK-DECKS | Keep chunk decks out of A1 loading | DONE | `86f86ca` | `bf0f19f` | `src/routes/library.tsx`; `src/routes/study.tsx`; `src/lib/learn/course-scope.ts`; `src/components/reference-links.tsx`; `public/data/a1-reference-links.json`; `public/sw.js`; `tests/e2e/catalogue.spec.ts` | scope | Implemented course-linked, read-only A1 Library scope: 853 unique notes linked from 417 A1 entries, generated and freshness-checked against the actual A1 plan. Word details link to exact notes; arbitrary direct links cannot expand membership, and a missing/invalid index fails closed. New reference/higher-level Review enrolment is rejected in A1, due counts and data loading use only A1 cards, and mixed interrupted sessions are archived without deleting saved cards or answers. The index is installed offline; full decks remain on-demand. Existing higher-level saves keep their previous behaviour. Merged as PR #190 (`bf0f19f`) after 535 unit tests, all 95 browser tests, CI 38019526492, Workers contract and rollback 38019526393 passed. The first browser run found an ambiguous search selector; it was scoped to the Library field without weakening assertions. Completion merge recorded in this follow-up PR. |
| P1-XP | Remove XP from primary screens | DONE | `86f86ca` | `86f86ca` | `src/routes/progress.tsx` | scope | The Progress stat was the only place XP showed. The stored count stays for backups and older saves. |
| P1-FEATURES | Feature ledger `docs/FEATURES.md` (plan §30) | DONE | `92980fe` | `92980fe` | `docs/FEATURES.md`; `scripts/feature-ledger.ts` | scope | — |
| P1-PRONUNCIATION | Pronunciation normalization that removes notation noise from audio flags | DONE | `57114b5` | `57114b5` | `scripts/audio/generate_audio.py`; `content/pilot/audio-report.json`; `docs/AUDIO.md` | none | Notation-only differences no longer flag: 292 flags became 174 (114 US, 60 GB, across 123 senses). Strong and weak forms, dropped sounds and vowel differences still flag; they belong to P3-AUDIO-CERT. |
| UNIT1-DETERMINISTIC | Unit 1 content passes every deterministic check | MACHINE_PASS | `eea2301` | `6714cce` | #84; `scripts/content-assurance.ts` | canary-gate | — |
| A1-DETERMINISTIC | All A1 content passes every deterministic check | IN_PROGRESS | `c426776` | — | #82; #84; #109; `scripts/content-assurance.ts`; `content/assurance/deterministic-baseline.json`; `docs/LANGUAGE_FIELD_REPAIRS_2026-10-10.md`; `docs/MISTAKE_TRANSLATIONS_2026-10-10.md` | release-gate | Unit 1 passes. The current full corpus has 9,425 findings across 1,027 senses and 14 scenes (`npm run assurance:content`). Mistake-pair Persian (2026-10-10, Claude Code): course Units 4–6 now carry `wrongFa`/`rightFa` for all 279 senses, so missing pairs fell 1,004 → 725 each; frozen Units 1–3 are untouched and there is no semantic certificate (`docs/MISTAKE_TRANSLATIONS_2026-10-10.md`). Earlier state: 9,983 findings, including 32 reused example sentences and the frontier findings in A1-FRONTIER-REPAIR. A separate seven-item later-unit Persian grammar-feedback pass repaired all remaining `PERSIAN_MISTAKE_WHY` findings (7 → 0), with source explanations for member/topic/CD/dialogue/DVD/girlfriend/hobby, provenance updated for seven entries and exact content rebuilt by one-use workflow 37792738417. This is deterministic language coverage, not independent semantic judgment or Gate 0 clearance. Later-unit language-field repair (2026-10-10): all four Persian-in-English findings are removed in too, miss, hard and afraid, with six literal mistake translations and one Persian grammar explanation. Missing wrong/right translations are 1,004 each, grammar-note findings 942, and total findings 9,983; no other code increased. All 180 frozen source entries and audio/curriculum/scene sources remain unchanged. Provenance, generated artifacts, rights filenames/authorship hashes and records were refreshed; independent semantic and release approvals remain absent. PR #191 merged as `9556da4` after full CI 38043997584 (535 unit and 95 browser tests), Workers contract and rollback 38043997585 passed; actual merge recorded in this follow-up. |
| A1-FRONTIER-REPAIR | Tasks and scenes use only vocabulary taught by that point | IN_PROGRESS | `68143e3` | — | #119; #132; #141; `scripts/content-assurance.ts`; `scripts/frontier-repair.ts`; `scripts/frontier-promote.ts`; `content/curriculum/A1.json`; `content/assurance/deterministic-baseline.json`; `content/assurance/records/A1.json` | release-gate | Two batches of prerequisite-safe promotions outside the frozen Units 1–3 roster are applied. Batch 1 (#141) made 35 moves, taking FRONTIER_TASK_VOCABULARY from 5,341 to 5,330, with spell kept before spelling. Batch 2 used `npm run assurance:frontier:promote -- --monotonic`. That mode keeps a move only when frontier findings strictly fall and no other finding code rises, then replans until nothing improves. It kept 3 moves (draw, follow, science), taking FRONTIER_TASK_VOCABULARY to 5,326; FRONTIER_SCENE_VOCABULARY stays at 65. It rejected 9 promotions in all. Of the 10 that were movable at the start, it rejected 7: 6 change nothing (cost, nineteen, website, negative, poor, anything) and spelling adds a finding. After follow and science moved, rule and scientist became movable; each adds a finding. All three of these would move a word ahead of the word it contrasts with. Promotion outside Units 1–3 is therefore exhausted. Then 111 task glosses were added in Units 4–12, recorded as agent `claude-code-2026-10-08-frontier-glosses` in `content/assurance/generation.json`. Each is a Persian support gloss for a name, place, language or nationality the task uses (Tehran, Iran, English, Persian, Mr …). A task where the name is an answer or option is skipped. FRONTIER_TASK_VOCABULARY is now 5,215. The remaining backlog needs one of two things: moving core words (do, on, not, can, to, at …) into the frozen Units 1–3 roster, which is a study and audio scope decision covering 408 promotions; or support or rewording for the remaining 360 such findings (common words such as heavy, fridge, hurts, wet, plus names in Units 2–3). Planner figures: `npm run assurance:frontier:plan`. Additional deterministic guard: `scripts/lint-content.ts` checks task support glosses for exact visible wording, duplicate glosses and answer-disclosing or option-discriminating hints (while allowing a word shared by every choice). Unit-tested in `src/lib/learn/task-support.test.ts`. Added `npm run assurance:frontier:triage -- --json` (`scripts/frontier-triage.ts`, `src/lib/learn/frontier-triage.ts`) as a deterministic context-level repair queue that identifies exact tasks, separates frozen Units 1–3, and distinguishes structurally glossable cases from options/answers requiring rewording or review. It never edits content or asserts Persian correctness. `validate:data` checks that every remaining non-promotable frontier finding maps to an existing task. PR #151: 58 later-unit, context-checked support glosses (12 surface forms, 55 source entries) reduced task frontier findings from 5,215 to 5,157. Generated content, coach cases, provenance, assurance records and the baseline were refreshed by one-use run 37786472051; Units 1–3 and audio were unchanged. These glosses are machine-authored and not semantic-judge certified. Second contextual batch (2026-10-08, one-use run 37791852462) added 57 carefully selected support glosses to 55 entries in Units 4–12; task-frontier count 5,157 → 5,100, no deterministic code regressed, corpus triage now 245 non-promotable findings (71 frozen, 142 structurally glossable, 32 requiring rewording/review). Provenance recorded under `chatgpt-2026-10-08-frontier-context-glosses-batch2`; derived artifacts and ratchet regenerated. This is not judge qualification or release approval. Contextual batch 3 (2026-10-10) added 140 original Persian support glosses to 133 exact tasks (111 entries / 118 senses plus 6 scenes), lowering task-frontier findings 5,100 → 4,966 and scene-frontier findings 65 → 59; no other code increased. The triage queue is now 105 (71 frozen, 2 deferred gloss candidates, 32 requiring rewording/review). The hardly/hard contrast and incomplete pick-up phrase were deferred because a gloss could substitute for the tested distinction. All 180 frozen Units 1–3 entry objects and the audio/curriculum files remain byte-equivalent. Source content, coach cases, agent provenance, conservative unverified rights lineage/authorship hashes and assurance records were rebuilt locally; no independent semantic or rights approval was added. Merged as PR #189 (`b00a9fa`) after full CI, browser, Workers and rollback rehearsal succeeded. Evidence: `docs/FRONTIER_CONTEXT_GLOSSES_2026-10-10.md`. |
| P2-SEMANTIC-STACK | Semantic judge roles, rubrics, arbitration, packets, runner and evidence ingestion | DONE | `066d7a3` | `0704d5f` | #85; #86; #87; #88; #138; `scripts/semantic-assurance.ts`; `scripts/run-semantic-judge.ts`; `scripts/merge-semantic-evidence.ts`; `scripts/build-semantic-packets.ts`; `content/assurance/semantic/packets/01-introductions.json` | none | Unit 1 packet identity is scoped to the exact Unit 1 source/curriculum inputs it consumes. Unrelated Units 4–12 reorderings no longer stale the Unit 1 semantic packet; any Unit 1 target/prerequisite/rubric/prompt change still changes packet identity and invalidates stale evidence. |
| P2-KEYLESS-GATEWAY | Keyless GitHub OIDC to Workers AI judge gateway with a Neuron budget gate | DONE | `9cd71f4` | `8203831` | #93; #95; #97; #99; #107; `content/assurance/semantic/KEYLESS_GATEWAY.md`; `scripts/semantic-neuron-budget.ts` | none | — |
| P2-CALIBRATION | Judge calibration v1 qualifies all four roles | IN_PROGRESS | `90e06f2` | — | #91; #92; #142; `content/assurance/semantic/calibration/qualified.json`; `content/assurance/semantic/calibration/rejected.json`; `content/assurance/semantic/calibration/automation-log.json` | release-gate | 0 of 4 roles qualified. The dated 2026-10-10 snapshot is backed by the scheduled calibration ledgers. English rejected all four of its original candidates. On 2026-10-10 two free candidates were appended to the end of its list, Gemma 4 26B and GLM 4.7 Flash, both with reasoning off and neither yet calibrated for English. The planner selects Gemma 4 for English, with a campaign of at most 1,212 Neurons (PR #193, merged as `571f7f9`). Latest English Scout run 37936744749.1 failed defect recall (0). Persian Qwen 3.8 +no-thinking run 38029252396.1 failed defect recall (8/9), abstention (0) and stability (5/6). The planner selects Persian Mistral Small 3.1, pedagogical Nemotron 3 +no-thinking and adversarial Qwen3 30B; selected is not qualified. Pre-register any new English candidate through normal PR/deploy review, or justify a new calibration version; never loosen v1 or bypass the authorised free-allocation schedule. Calibration ledgers override this dated snapshot. |
| P2-CAL-AUTOMATION | Unattended free-allocation judge calibration and qualification | DONE | `89b6caf` | `e216272` | #114; `content/assurance/semantic/AUTOMATION.md`; `content/assurance/semantic/automation.json`; `content/assurance/semantic/calibration/automation-log.json`; `scripts/semantic-automation.ts`; `src/lib/learn/semantic-automation.ts`; `.github/workflows/semantic-calibrate.yml` | none | The first scheduled production campaign ran unattended on 2026-10-07 and committed its measured outcome to main. English/Nemotron 3 120B failed with `http-502-empty-model-content` after one request and 412 charged Neurons; this proves the reservation→inference→record→commit loop works in production. Candidate selection, retry/rejection policy and daily free-allocation ceiling remain frozen and automatic. |
| P2-SEMANTIC-UNIT1 | Unit 1 semantic certification by the qualified judges | NOT_STARTED | — | — | — | canary-gate | — |
| P2-REPAIR-LOOP | Automatic repair loop (plan §8) | IN_PROGRESS | `97e027a` | — | `src/lib/learn/repair-loop.ts`; `scripts/repair-loop.ts` | none | Diagnosis, bounded retry and automatic quarantine are in place. A no-op or field-emptying Unicode change is not a repair. Field regeneration is not executed: no model writes learner-facing text. CI hardening: semantic calibration-budget regression fixtures now use the pinned adversarial-role upper bound rather than an unrelated global next-role turn, with thresholds unchanged. Coach held-out text evaluation now has a text-scoped content hash so audio-only certified MP3 changes cannot invalidate its generated corpus; one-use run 37874033209 regenerated coach cases and exact assurance records after the 328/386 audio bot commit. Automatic text field regeneration is still not activated. PR #164 merged at `72c7b9350be510fb3aaabbd5a1a64d75e396567b` after full CI, Playwright, Workers build contract and rollback PASS; field-level diagnosis remains non-promotional. |
| P3-AUDIO-CERT | Audio certification (plan §12, A1–A8) | IN_PROGRESS | `7941c9e` | — | #131; #133; #139; `.github/workflows/audio-certify.yml`; `scripts/check-audio-certify-workflow.ts`; `src/lib/learn/audio-assurance.ts`; `scripts/audio-certification.ts`; `scripts/audio/certify_audio.py`; `scripts/audio-repair-plan.ts`; `scripts/audio-repair-evaluate.ts`; `scripts/audio/generate_repair_candidates.py`; `scripts/audio/promote_repair_candidates.py`; `scripts/audio/rollback_unstable_promotions.py`; `content/assurance/audio/recognition.json`; `content/assurance/audio/certificates.json`; `content/assurance/audio/repair-policy.json`; `content/assurance/audio/repair-log.json`; `src/lib/learn/audio-pack.ts`; `public/sw.js`; `public/data/enhanced/audio-pack.json`; `docs/AUDIO.md` | release-gate | Production run 37693801383.1 independently certified 189/386 baseline targets, then isolated repair rounds certified/promoted 59 + 43 + 38 + 3 candidates. The exact promoted-state full-corpus pass reached 330/386 certified with 56 quarantined; artifact analysis shows 142 current promotions remained certified and exactly one (`lex:A1:your:us`) lost certification (`vosk-lexical`, `multi-system-disagreement`). Final-pass promotions are now transactional: the scoped release is snapshotted before repair, only unstable promoted targets are SHA-restored and recorded in `repair-log.json.finalFailures`, stable promotions are preserved, and the rolled-back exact state is recertified before commit. A rolled-back isolated-certified candidate counts as tried so a later PARTIAL retry can advance to the next frozen candidate; PARTIAL retries run only while an untried candidate exists. The 386/386 release gate and all recognition criteria remain unchanged; committed release evidence is still fail-closed and Phase 3 remains IN_PROGRESS. The 2026-10-08 unattended run 37764965059.1 reached 327/386 after rolling back two unstable promotions but found `lex:A1:new:gb` newly uncertified after that re-certification. The rollback workflow now repeats full-corpus certification and selective SHA-bound rollback for up to three passes, with an explicit promotion guard each time and fail-closed exhaustion (`.github/workflows/audio-certify.yml`; `scripts/check-audio-certify-workflow.ts`). This is workflow remediation, not certification or release approval. Run 37793132202.1 reached a stable PARTIAL 325/386 certified after two rollback passes, but the narrow audio evidence commit rejected untracked `.audio-repair/baseline` scratch files; therefore only the failed automation outcome reached `main`, not the new certificates or promoted audio. The workflow now uploads the full diagnostic artifact before removing only untracked `.audio-repair` scratch and invoking the unchanged allowlist/independent-certificate checks. This fixes commit hygiene only; 386/386 certification and Gate 0 remain blocked. |
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
| Editorial release | 0 independent approvals; Unit 1–3 machine audio evidence is PARTIAL (328/386 certified, 58 quarantined, 0 uncertain); broader editorial/audio release remains open |
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
