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
