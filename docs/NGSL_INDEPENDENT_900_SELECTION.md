# Independent NGSL-ranked selection — new A1 candidate syllabus (NOT a release)

**Status: STAGING ONLY. Gate 0 BLOCKED. No A1/CEFR, semantic, Persian, or redistribution approval of any lesson.**

This experiment is deliberately **different** from
`a1-900-alternatives.json`, which maps NGSL-family lemmas to the inherited
Oxford-derived A1 roster. The new selection is computed **solely** by sorting
the pinned **NGSL 1.2 core** CSV by its original rank and taking the first
900 entries. The code never reads the legacy Oxford list, the existing A1
curriculum or enhanced lessons to choose a word.

- Source: **Browne, Culligan and Phillips**, *New General Service List* 1.2,
  https://www.newgeneralservicelist.com/new-general-service-list
- Pinned upstream source snapshot:
  `content/rights-staging/ngsl-1.2/core.csv` (Git blob
  `b8705be6c208bbee4450a208eb39a5be4dea8f63`).
- License notice: `CC-BY-SA-4.0-LICENSE.txt` (pinned Git blob
  `2d58298e6eda10e7204abb52722efbc840db2390`).
- Licence: **CC BY-SA 4.0**, https://creativecommons.org/licenses/by-sa/4.0/.
  Attribution, notices, licence links, change indication and any applicable
  ShareAlike obligations need to accompany adapted material.

## Output and deterministic constraints

`content/rights-staging/ngsl-1.2/independent-first-900-selection.json`
holds **900 distinct rank-based IDs** `ngsl:freq:0001` through
`ngsl:freq:0900` and the exact source lemma/rank for each. It contains no
inherited IDs, meanings, examples, exercises, assessments, audio or artwork.
Every record remains **NOT_AUTHORED**, **UNASSESSED**, and **NOT_CLEARED**,
and the manifest records **zero** reviewed A1 words, authored lessons,
rights-cleared items and released items.

`npm run assurance:ngsl:independent:check` recomputes the selection from
SHA-pinned source/licence bytes and rejects any changed lemma/rank,
false approval, missing item, extra item or altered status. It runs as part
of `npm run validate:data`. Tests cover upstream rank problems and forged
A1/rights approvals.

The selection provides independently sourced *lexical candidates only*.
**Frequency is not A1 difficulty.** Function words, polysemy, Persian
translation quality and pedagogical sequence require separate assessment.
WordNet lexical-sense information may be brought in from separately licensed,
properly attributed source data, but only after review of each meaning and
example. These 900 words must NOT be swapped into the existing app by
changing labels or copying legacy lessons.

## How this becomes a rights-safe new A1 course

A new authoring pipeline must create/review each lesson, correct English and
Persian text, relevant tasks, scenes, and independent voices/graphics without
copying Oxford-derived expressive content. Then separately record source
provenance, CC BY-SA compliance, fresh hashes, proper attribution and
per-artifact rights evidence. Produce a new release corpus and build its
entire public JSON/audio/media graph from those canonical sources. Only the
actual rights-audit checker and independent pedagogical/semantic verification
can change an item's clearance state. Preserve the original inherited
corpus as blocked until it is removed from all distribution paths.

Neither this source selection nor the user's report about AI-authored text
establishes a right to redistribute Oxford list selections or their
derivatives, or to release current public media. No public deploy, Gate 0
clearance or rights-holder consent is claimed here.

## First 20 draft lesson records (editorial staging only)

`content/rights-staging/ngsl-1.2/independent-first-20-drafts.json`
contains **20 newly written, bilingual English/Persian teaching drafts**
associated strictly with NGSL frequency ranks 1–20. Each has a draft English
meaning, explanatory Persian guidance and two paired example sentences.
The draft texts were written for the NGSL source-led candidates; no existing
Oxford-derived lesson was copied into the staging manifest.

The independent lesson checker `npm run assurance:ngsl:drafts:check`
requires exact source lemmas/IDs/ranks, all 20 descriptions, two examples per
draft, Persian-language content and fixed zero-approval status. It also
performs a separate *anti-reuse comparison* against current inherited content:
nine-word or longer verbatim English/Persian sequences are rejected.
This comparison is a guard **after drafting**, not an input into the NGSL
frequency-based word selection; it cannot prove full non-derivation.

**A draft is not an approved A1 lesson.** All 20 remain AI-authored and
unreviewed for lexical sense, English grammar, Persian naturalness,
appropriateness for A1, licence compatibility, and independent rights.
There are no newly authorised pronunciation files, images, assessments or
published lesson bundles. The list of **900** lexical candidates is unchanged;
the source-selection manifest still correctly records **0 production
authored lessons**, since these 20 are editorial drafts, not cleared lessons.

A future release must independently verify and rewrite where necessary each
candidate, fully rebuild all derived runtime assets, and record exact rights
evidence for every distributed byte before updating Gate 0.


## Second 20 original lesson drafts (ranks 21–40; still NOT approved)

`content/rights-staging/ngsl-1.2/independent-ranks-21-40-drafts.json`
adds **20 freshly authored bilingual editorial drafts**, continuing the pinned
NGSL source selection exactly from rank 21 through 40, for a cumulative **40/900
unreviewed drafts**. Each draft keeps the immutable source selection ID/rank,
states a narrowly scoped meaning and usage in Persian, and includes two new
English/Persian example pairs. Potentially polysemous words such as `at`, `by`,
`would` and `there` explicitly teach just one sense; further senses are not
silently certified.

The existing `npm run assurance:ngsl:drafts:check` now checks **both** batches:
the exact original first-20 source roster, the exact next-20 source slice,
complete bilingual fields, zero-approval flags, and English/Persian long-phrase
overlap with legacy lessons and with the previous independent batch. New unit
tests reject wrong source ranks, copy-paste reuse and forged clearance.
No legacy content is an authoring input; it is inspected only by the anti-reuse
guard after drafting. A nine-word overlap test is not a legal opinion or proof
of independent creation.

**Still 0 verified semantic/Persian/CEFR reviews, 0 rights-cleared replacement
lessons, 0 public NGSL lessons and 900 legacy entries remain unverified.**
This work does not alter the existing production curriculum, public JSON,
audio, artwork, Git history or Gate 0. All 40 drafts still require full
editorial, licensed-source, legal and media review before an actual
clean-source release can replace the inherited course.

## Third 20 original bilingual drafts (ranks 41–60; unreviewed staging)

`content/rights-staging/ngsl-1.2/independent-ranks-41-60-drafts.json` adds **20 newly authored editorial entries** for the pinned NGSL 1.2 core ranks 41–60, bringing the cumulative staging count to **60 of 900**. Each entry includes exactly one specified English sense, original Persian instructional guidance and two bilingual example pairs. Polysemous lemmas such as `get`, `like`, `think`, `up`, `take`, `other`, and `no` have a narrowly described sense; this does **not** assert complete dictionary coverage or A1 suitability.

The third batch uses fresh source-selection IDs and frequency ranks. The existing `assurance:ngsl:drafts:check` now checks all **three** pinned, contiguous 20-item batches and screens the new examples for nine-word-or-longer verbatim overlap against the inherited A1 English/Persian material **and both earlier independent draft batches**. New unit tests reject wrong rank bindings, cross-batch long-form copying and fabricated semantic approvals. The inherited corpus was not an input to composing these drafts and was used only in the mechanical post-authoring comparison.

**All 60 remain STAGING_ONLY_AI_DRAFT_UNREVIEWED.** There is still no independent English-sense, Persian, CEFR/pedagogical, legal, audio or artwork clearance; zero NGSL lessons have been promoted into the public A1 curriculum. The original public catalogue, source-rights lineage, provenance and legacy deployment prohibition remain unchanged. A source licence alone does not license AI-authored lesson texts or inherited lessons without a full provenance/derivation audit.

## Contiguous-batch audit automation

The draft-stage validator now discovers the first 20 plus all
`independent-ranks-START-END-drafts.json` files directly from the pinned NGSL
staging directory. It **rejects** any missing first batch, malformed or
non-20-item rank interval, gap, overlap, duplicate rank range or rank beyond
900. Each discovered 20-item batch must reproduce precisely its own contiguous
source ranks and lemmas, keep every approval/release flag false, and pass
English/Persian nine-word anti-reuse checks against the inherited content
and **all previous independent batches**.

This removes a manual validator code edit for future 20-entry drafting batches;
merely adding a new file cannot make it disappear from the audit. It does not
change the current 60/900 count, grant independent editorial approval or alter
the blocked public-release status.

## Fourth 20 bilingual source-led drafts (NGSL ranks 61–80)

`content/rights-staging/ngsl-1.2/independent-ranks-61-80-drafts.json`
holds a further **20 freshly authored, unreviewed** English–Persian draft
lessons, following the pinned frequency ranks 61–80 exactly. Staging now
contains **80 of 900** candidate words with one explicitly delimited meaning,
Persian guidance and two new example pairs each. Polysemous words including
`just`, `could`, `work`, `way`, and `only` deliberately cover a single
sense, not a purported complete dictionary entry or independent CEFR review.

The contiguous-batch checker discovers this fourth file automatically and
compares it with the pinned source roster, the inherited course and all 60
previous source-led drafts. Its zero-review, zero-rights-approval and
zero-publication requirements remain unchanged. These files are drafts and
are not compiled into learner-facing content; the licensed source-selection
record is not a licence for inherited Oxford-based material.


## Seventh and eighth author-only batches — NGSL ranks 121–160

The independently pinned NGSL 1.2 frequency-first syllabus now also has
`content/rights-staging/ngsl-1.2/independent-ranks-121-140-drafts.json` and
`content/rights-staging/ngsl-1.2/independent-ranks-141-160-drafts.json`.
These files add **40 freshly composed, unreviewed bilingual sense drafts and
80 paired example translations**. The cumulative replacement-writing inventory
is **160/900 draft items, with 320 English–Persian example pairs**.

Editorial choices explicitly disambiguate individual uses of terms including
`lot` (quantity), `own` (possession), `point` (detail), `little` (small
size), `interest` (curiosity), `while` (simultaneity), `might`
(possibility) and `must` (obligation). This is **author-only** sense
selection, not an independently qualified lexical judgment, complete sense
inventory, or A1/CEFR classification. Example spelling and translations need
independent professional review before any production use.

`npm run assurance:ngsl:drafts:check` discovers both new files without manual
roster changes and checks exact NGSL IDs/ranks, the frozen zero-approval state,
the nine-token inherited/previous-batch copying guard, and distinct examples
in both languages for each new draft. This mechanical check is useful evidence
against accidental transcription; it cannot prove original copyright authorship
or establish sufficient clearance by itself.

No existing Oxford-derived source entry, curriculum, licence assignment,
audio, media, production endpoint or release status is changed. The original
redistribution rights, source-independent editorial approvals, complete media
permissions and historically published content remain unverified. **Gate 0
remains BLOCKED, with zero new rights approvals and zero published replacement
lessons.** Do not use these draft files for a public release until their
source rights and editorial dependencies are independently resolved.

## Ninth independently drafted batch — NGSL ranks 161–180 (unreviewed)

`content/rights-staging/ngsl-1.2/independent-ranks-161-180-drafts.json`
adds **20 further, original model-authored English–Persian lesson drafts**
with **40 bilingual example pairs**. The replacement-writing inventory is now
**180 of 900 independent-frequency-selection candidates drafted**, with
**360 paired examples**. Every record is bound to its own immutable
`ngsl:freq:0161–0180` source rank and lemma.

Each draft explicitly describes *one* sense: for example, `home` as a
place of residence rather than a building, `kind` as a type rather than
kindness, `book` as a printed work rather than a booking verb, `case`
as an instance rather than a container, and `around` as a surrounding
position. The teaching guidance marks common grammatical restrictions
(`every` + singular noun, `let` + object + bare infinitive,
`never` placement, `seem` + adjective). Sense choices, CEFR level,
translations, example naturalness and legal independence **are not
independently reviewed or approved**.

The existing dynamically discovered `assurance:ngsl:drafts:check`
pipeline must verify contiguous NGSL rank/lemma mappings, the unchanged
zero-approval flags, distinct bilingual examples and the inherited/prior-batch
nine-word overlap guard. This check only rejects detectable reuse; it does
not authenticate ownership or license a derivative. The source workbook,
canonical A1 learner lessons, scenes, media and public assets are unchanged.
**Gate 0 stays BLOCKED; no new source, item or media rights have been cleared.**

## Tenth independent bilingual staging batch — NGSL ranks 181–200

`content/rights-staging/ngsl-1.2/independent-ranks-181-200-drafts.json`
adds another **20 original, unreviewed** sense-scoped bilingual lessons and
40 original English–Persian example pairs for source ranks 181 through 200.
This brings the independent replacement-authoring inventory to **200/900
draft lessons and 400 paired bilingual examples**. Each record preserves the
exact lemma/rank from the separately licensed, pinned NGSL 1.2 source
selection without reading the Oxford A1 roster to select entries.

The authored sense scopes distinguish `run` (movement on foot),
`set` (adjusting a value), `turn` (direction change), `hand`
(the body part), and `state` (a political subdivision); modal and
function-word usage is described without asserting complete dictionary
coverage. All English/Persian meaning and example text still requires
independent linguistic and teaching-quality review. NGSL frequency rank
is **not** evidence of CEFR A1 suitability.

The existing rank-contiguous file discovery, source ID verification and
long-phrase copy guard cover this tenth file, including against every
earlier NGSL draft. This is mechanical drafting evidence only: all
`semanticApproved`, `persianApproved`, `cefrApproved`,
`rightsCleared`, and `publicRelease` flags are false.
No old course bundle, Git history, source-rights assignment, audio or
artwork is replaced; public release remains forbidden and **Gate 0 BLOCKED**.

## Original bilingual editorial drafts — ranks 201–240 (2026-10-10)

Two new, separately staged 20-item source-rank batches (`independent-ranks-201-220-drafts.json` and `independent-ranks-221-240-drafts.json`) add 40 *new model-authored* bilingual draft entries with 80 paired example sentences. The cumulative independent, NGSL-ranked authoring track is now **240/900 drafts**. Each record pins its NGSL lemma, source rank and independent selection ID, and describes **one** usage sense without claiming full dictionary coverage.

Every record keeps `semanticApproved`, `persianApproved`, `cefrApproved`, `rightsCleared` and `publicRelease` set to `false`. The 40 drafts are checked against the legacy-content and preceding draft batches for nine-word verbatim reuse by `npm run assurance:ngsl:drafts:check`, and are assessed only for mechanical consistency. The source rank is **not** proof of CEFR A1 appropriateness; for example `government`, `however` and `though` may require deferral to later proficiency levels.

No public lesson data, rights-assignment evidence, audio, artwork, scene/contrast content or runtime curriculum is changed. The existing Oxford-derived source remains unverified and Gate 0 remains **BLOCKED**. Independent semantic/Persian/pedagogical/rights review, clean content compilation and separate media licensing are still prerequisites to public release.

## Source-led independent NGSL draft batches 241–280 (2026-10-10)

`independent-ranks-241-260-drafts.json` and `independent-ranks-261-280-drafts.json` add **40 English–Persian editorial drafts** and **80 original bilingual example pairs**, using only the already pinned rank/lemma/ID selection to select subjects. Each draft explains one explicitly scoped English usage, with usage guidance in Persian; terms with several meanings (e.g. *lead*, *cost*, *room*, *present*, *support*, *term*) are not presented as single-meaning translations. The staging checker discovers these contiguous 20-rank files and screens source bindings, approval flags, and long-form duplication against both legacy material and previous drafts. A mechanical anti-copy check cannot establish independent authorship or legal permission.

The separate clean-source authoring stage contains **280 of 900** proposed lesson drafts after these batches. **Independently reviewed = 0, rights-cleared = 0, released = 0**. Existing source-rights assignments, inherited publicly distributed text, audio, artwork, content-ratchet thresholds and Gate 0 are unchanged. Release still requires independent English-sense, Persian, educational-level and licence reviews, licensed replacements for every public artefact and per-item SHA-bound rights evidence; do not transplant these unreviewed drafts into public lessons.

## Deterministic pending-review packet export (2026-10-10)

`npm run assurance:ngsl:review:packets -- --json --from 241 --limit 20` emits a **read-only** machine-readable package for each separately drafted NGSL entry. Every package includes its pinned source rank and lemma, exact source Git blob identifiers, original model authoring metadata, a SHA-256 of the exact draft and author, the original English/Persian draft text and **five PENDING checks**: independent English sense; independent Persian accuracy; pedagogical/CEFR placement; licence/ShareAlike; and rights for public derivatives/media. A packet contains no review result and cannot approve or publish content. A later independent evaluator must not be the model/context that authored the text.

`npm run assurance:ngsl:review:packets -- --check` is integrated into `validate:data` and rejects forged source-rank bindings, changed approvals, missing contiguous draft batches and partial-scope integrity checks. Regression tests verify fail-closed behaviour and the release status of one exact item. **No third-party judge was run or qualified** by this exporter: verified reviews, Gate 0 item clearances and clean-source production rebuilds remain **zero**. The exporter does not touch public A1 artefacts or waive CC BY-SA obligations.


## Ranks 281–360 and standalone source verification (10 October 2026)

Four new original English/Persian draft batches cover NGSL ranks 281–300,
301–320, 321–340 and 341–360. The independent staging corpus now contains
**360/900 draft entries, 720 paired examples and 18 contiguous batches**.
The authoring input for these batches was the pinned source's lemmas and
ranks. No legacy teaching text was imported into them. Polysemous words
are scoped explicitly (for example, `party` as a social gathering, `past`
as a movement preposition and `figure` as a numerical amount).

Every new entry is still unreviewed for English sense/grammar, Persian
naturalness, CEFR/pedagogy and rights. NGSL frequency is not an A1 label.
No independent reviewer result, media right, lesson clearance or public
replacement is asserted by this authoring batch. **Gate 0 is BLOCKED.**

The standalone review-packet command previously accepted source and licence
references from the selection manifest without authenticating their bytes.
Although the full validation pipeline checked those files separately, a
standalone export could therefore attach unverified source claims to a draft
hash. `scripts/rights/pinned-ngsl-source.ts` now authenticates both upstream
files against fixed Git blob pins, rebuilds the complete 900-candidate
selection and rejects any manifest deviation. The selection checker,
bilingual draft checker and packet exporter share this verification path.
No packet or success output is produced before source verification.

Isolated temporary-directory tests exercise changed CSV/licence bytes,
forged source URL/path/hash references and a forged lemma changed consistently
in both the selection and its draft. They do not mutate the repository's
canonical source files. Source integrity establishes which bytes are used;
it does not grant a lesson or legacy artifact permission to be distributed.

**Continuation checkpoint:** PR #187 was verified merged at `cd8da10` with
CI, rollback rehearsal and gateway smoke successful before this work.
Continue new authoring at **rank 361**, with **540** candidates still to draft.
Independent review of ranks 1–360, complete task/scene/assessment authoring,
verified media provenance and a fresh release graph are still outstanding.
The inherited Oxford-related rights gate remains unresolved.

Validation for this continuation: complete `validate:data`, TypeScript, lint,
**529 unit tests** and the production build pass locally. The new source
authentication regressions run in isolated temporary directories. Browser,
Workers build-contract and rollback evidence must pass on the pull request
before merge; no pending check is counted as a pass.

## Ranks 361–440 (10 October 2026)

Four new original English/Persian draft batches cover NGSL ranks 361–380,
381–400, 401–420 and 421–440. Claude Code wrote them in this session. The
independent staging corpus now contains **440/900 draft entries, 880 paired
examples and 22 contiguous batches**. The authoring input was the pinned
source's lemmas and ranks, and no legacy teaching text was imported.

- **One sense per lesson.** Each lesson scopes one sense explicitly, for
  example `break` as separating into pieces, `free` as costing nothing,
  `appear` as *seem*, `pass` as going past and `account` as a bank account.
  The usage note names the other common sense where a learner may meet it.
- **Hedged notes.** Usage notes describe tendencies as tendencies (*usually*,
  *in this sense*), the fault review found in earlier PRs.
- **No repeated sentences.** The nine-token overlap guard cannot see short
  sentences, so the new examples were also compared exactly with every
  course string and every earlier draft. 25 lines that matched a course
  sentence (for example *Someone is at the door.*) were rewritten. No new
  example now repeats course or draft text.

- **Examples in the declared sense.** Review found three lessons whose
  second example left the declared sense: *further help* (an adjective in an
  adverb lesson), *make sense* beside *sense of humour*, and *a long
  history* in a lesson on history as a subject. A sweep of all 80 found five
  more: *wait a minute*, *at the moment*, *in general*, *black coffee* and
  *drive someone*. All eight now use the declared sense. *sense* is now
  scoped to a natural ability, as in *sense of humour* and *sense of
  direction*.

Every new entry is still unreviewed for English sense and grammar, Persian
naturalness, CEFR and pedagogy, and rights. NGSL frequency is not an A1
label. **Gate 0 is BLOCKED.**

**Continuation checkpoint:** PR #199 was merged as `52f1429` before this
work. Continue new authoring at **rank 441**, with **460** candidates still to
draft.

## Ranks 441–520 (10 October 2026)

Four more original English/Persian draft batches cover NGSL ranks 441–460,
461–480, 481–500 and 501–520. Claude Code wrote them in this session. The
staging corpus now contains **520/900 draft entries, 1,040 paired examples
and 26 contiguous batches**. PR #200 (ranks 361–440) was merged as `a12621c`
before this work.

- **Examples checked against their sense while drafting.** Review of PR
  #200 found examples outside the declared sense, so this time each example
  was checked against its lesson's sense as it was written. Polysemous words
  are scoped explicitly: `bear` as *tolerate*, `step` as a movement of the
  foot, `model` as a product type, `approach` as a way of dealing with
  something, `couple` as two people together and `act` as taking action. The
  other common sense is named only in the usage note.
- **Rank 478.** The source writes this lemma as `TRUE`, a spreadsheet
  artifact in the pinned CSV. The draft keeps that exact lemma so its source
  binding verifies, and the usage note explains the casing.
- **No repeated sentences.** 19 example lines that exactly repeated a course
  sentence were rewritten. One Persian line that the nine-token overlap
  guard caught was also rewritten.
- **Review fixes.** Review found that the exact comparison had covered only
  the course entries, not the legacy catalogue in `public/data/`. The
  comparison now covers every string in `content/pilot/`,
  `content/compiled/`, `public/data/*.json` and
  `public/data/enhanced/*.json`, about 95,000 strings. It found 15 more lines
  in 11 examples across ranks 361–520, three of them already merged in #200
  (*town*, *sound*, *agree*). All 11 are rewritten, and ranks 361–520 now
  have no exact match anywhere. Review also caught *May* translated as
  اردیبهشت, which only overlaps it, so it is now «ماه مه».
- **Ranks 1–360.** The same comparison finds seven lines in six lessons
  drafted earlier by another agent: ranks 8, 10, 36, 63, 66 and 290. They are
  left for an owner decision rather than rewritten under that agent's name.

All 80 entries are unreviewed for sense, Persian, CEFR, pedagogy and rights.
**Gate 0 is BLOCKED.**

**Continuation checkpoint:** superseded below.

## Ranks 521–600 (10 October 2026)

Four more original English/Persian draft batches cover NGSL ranks 521–540,
541–560, 561–580 and 581–600. Claude Code wrote them in this session. The
staging corpus now contains **600/900 draft entries, 1,200 paired examples
and 30 contiguous batches**. PR #201 (ranks 441–520) was merged as `ed9dc05`
before this work.

- **Sense and part of speech checked while drafting.** Polysemous words
  are scoped to one sense: `rest` as relaxing, `field` as farm land, `stage`
  as a step in a process, `chance` as possibility, `save` as keeping money,
  `pick` as choosing, `lie` as lying down and `patient` as a person getting
  care. `instead` keeps adverb examples; *instead of* is named only in the
  usage note.
- **Rank 522.** `accord` appears in the frequency list mainly through
  *according to*, so the lesson teaches that phrase. The usage note says the
  noun is formal and rare.
- **No legacy text.** Before the PR, the exact comparison against every
  legacy string (about 95,000) ran over the new examples. It rewrote 9
  matching lines and 3 examples the nine-token guard caught. Ranks 361–600
  have no exact legacy match.
- **Review fixes.** Review caught three issues, all fixed:
  - the `road` definition said "wide" while an example said "narrow", so the
    definition now names a hard surface instead;
  - the `fine` definition said "in a good condition" and now says "in good
    condition";
  - the Persian for "What material is this bag made of?" mixed two
    constructions and is now «این کیف از چه جنسی است؟».

  A sweep of the batch found that the `road` usage note implied roads exist
  only outside towns, so it was corrected. The sweep also added «سال» before
  a year.

All 80 entries are unreviewed for sense, Persian, CEFR, pedagogy and rights.
**Gate 0 is BLOCKED.**

**Continuation checkpoint:** superseded below.

## Ranks 601–680 (10 October 2026)

Four more original English/Persian draft batches cover NGSL ranks 601–620,
621–640, 641–660 and 661–680. Claude Code wrote them in this session. The
staging corpus now contains **680/900 draft entries, 1,360 paired examples
and 34 contiguous batches**. PR #202 (ranks 521–600) was merged as `d5f0439`
before this work.

- **Pre-PR checks.** Review of earlier batches kept finding the same three
  faults, so all three were checked before the PR:
  - examples outside the declared sense or part of speech;
  - definitions that contradict their own examples;
  - exact legacy matches.

  Two examples were reworded: *a private school*, which is privately run
  rather than "for one person or group", and intransitive *relate to*. The
  legacy comparison rewrote 14 lines in 12 examples. Ranks 361–680 have no
  exact legacy match.
- **Scoped senses.** Polysemous words teach one sense, and the others are
  named in the usage note:

  | Lemma | Sense taught |
  |---|---|
  | `court` | a law court |
  | `cell` | a living cell |
  | `firm` | a company |
  | `pretty` | the adverb *fairly* |
  | `miss` | arriving too late |
  | `plant` | a living plant |
  | `press` | pushing a button |
  | `key` | a door key |

All 80 entries are unreviewed for sense, Persian, CEFR, pedagogy and rights.
**Gate 0 is BLOCKED.**

**Continuation checkpoint:** continue new authoring at **rank 681**, with
**220** candidates still to draft.

