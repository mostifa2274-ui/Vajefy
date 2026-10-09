# Independently selected NGSL frequency candidates — staging only

**Status: NOT CEFR-APPROVED · NOT A RELEASE CORPUS · GATE 0 BLOCKED.**

## What is new

`content/rights-staging/ngsl-1.2/independent-first900-selection.json`
contains an **independent candidate selection** of the first 900 lemmas by the
published **NGSL 1.2 core frequency ranks 1–900**. This selection procedure
reads only the SHA-pinned `core.csv` and its associated CC BY-SA 4.0 licence
notice. It does **not** read, filter, re-sort, relabel, copy or match the
existing Oxford-derived 900-word A1 roster.

The selection IDs are distinct (`ngsl-1.2-core-0001`, etc.) rather than
reusing the inherited `lex:A1:*` IDs, to avoid mistaking technical
compatibility for source independence. No inherited definitions, English
sentences, Persian translations, assessments, stories or audio were copied
into this file.

## Source and licence

Source: Browne, Charles; Culligan, Brent; and Phillips, Joseph,
*New General Service List*, version **1.2** (2023),
https://www.newgeneralservicelist.com/new-general-service-list.

- Pinned source file: `content/rights-staging/ngsl-1.2/core.csv`
- Source Git-blob SHA-1: `b8705be6c208bbee4450a208eb39a5be4dea8f63`
- Pinned full CC BY-SA 4.0 notice:
  `content/rights-staging/ngsl-1.2/CC-BY-SA-4.0-LICENSE.txt`
- Notice Git-blob SHA-1: `2d58298e6eda10e7204abb52722efbc840db2390`
- Licence details: https://creativecommons.org/licenses/by-sa/4.0/

Attribution, a licence link, indication of adaptation, and any applicable
ShareAlike obligations must be honoured when distributing a work based on
this list. The source snapshots are retained; no licence is inferred for
unrelated Persian text, pictures, speech/voice models, or past material.

## What is deliberately **not** claimed

- **Frequency does not establish CEFR A1 suitability.** The 900 candidates
  are a starting point for an independently built A1 curriculum, not
  a checked list of 900 A1 words. Some will need rejection or replacement.
- The selected lemmas lack verified senses, parts of speech, Persian meanings,
  graded examples, assessment items, lessons and coherent prerequisites.
- The source list's licence **does not retroactively clear** any Oxford-derived
  selection, pre-existing classroom material, translations or media.
- All 900 selections have
  `A1_CEFR_SENSE_AND_PEDAGOGY_NOT_REVIEWED`, `publicRelease=false`;
  `independentlyApprovedCount=0`.
- No existing `content/pilot/entries/`, public JSON or site deployment has
  changed. Gate 0 **remains BLOCKED**.

## Reproducibility and release boundary

`npm run assurance:ngsl:independent:check` computes the exact ranked
selection solely from the pinned upstream CSV, verifies source and licence
Git-blob hashes, compares all 900 generated items byte-for-byte with the
staging manifest, and refuses false approval or release flags. It runs in
`npm run validate:data`. Regression tests reject altered ranks, missing
source rows, duplicate lemmas, and invalid selection sizes.

Next: establish independent sense/POS and A1 pedagogy criteria, write and
verify **new** English and Persian teaching content and tests, audit the
actual licence and creator permissions of new audio/artwork, and build
new distributed assets with current SHA-bound rights evidence. A staged
frequency list alone is **not** a legally cleared production release.

The separate match-by-match list mapping is documented in
`docs/NGSL_A1_RIGHTS_ALTERNATIVES.md`, while the full 5,322-row
catalogue comparison is in `docs/NGSL_FULL_5322_ALTERNATIVES.md`.
Those are legacy-roster *comparisons*; this file uses a separate selection
algorithm not driven by the legacy roster.
