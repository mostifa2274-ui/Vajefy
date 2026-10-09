# NGSL 1.2 alternatives for all 900 A1 target IDs

**Current status: research / unapproved staging. Gate 0 remains BLOCKED.**

The complete row-by-row mapping is in:

- `content/rights-staging/ngsl-1.2/a1-900-alternatives.csv` — human-readable spreadsheet-compatible report, 900 rows.
- `content/rights-staging/ngsl-1.2/a1-900-alternatives.json` — machine-readable and checked against the current 900 stable A1 catalogue IDs.

## Results (2026-10-09)

| Classification | Count | Meaning |
|---|---:|---|
| Exact headword (including one multi-form entry) | 838 | English headword appears directly in a pinned NGSL-related source; **lexical match only** |
| Related lemma / spelling / grammatical or phrase component | 59 | **Unreviewed suggestion**; may have different POS, sense, form, or phrase meaning |
| No literal NGSL-family source match | 3 | CD, DVD, oh — needs a separate independently sourced or independently authored entry |
| **A1 IDs accounted for** | **900** | All retain existing internal IDs; **0 rights approvals** |

Across direct matches and **unreviewed** suggestions, 787 entries are associated with the NGSL 1.2 core, 49 with its supplemental days/months/numbers, and 61 with the much broader NGSL-associated SFI 31k frequency extension. **The SFI extension is not the NGSL core and is not a CEFR A1 word list.** A frequency rank also never certifies a learner level or a particular sense.

These are *source candidates*, not legal or pedagogical equivalents. For example, `bored → bore`, `born → bear`, `her → she` and `have to → have` cannot be copied as definitions or assumed to be interchangeable. The mapping explicitly identifies such cases and forbids automatic source-clearance. Only a genuinely rebuilt and appropriately attributed source item can become eligible for review.

## Original source, licensing, and pinned bytes

**Browne, Charles; Culligan, Brent; and Phillips, Joseph.** *New General Service List*, edition 1.2 (2023). Official project: https://www.newgeneralservicelist.com/new-general-service-list

- Official core CSV: https://www.newgeneralservicelist.com/s/NGSL_12_stats.csv
- Official supplementary list: https://www.newgeneralservicelist.com/s/SUP_lemmatized.csv
- Official NGSL-derived wider-frequency research spreadsheet: https://www.newgeneralservicelist.com/s/NGSLwithSFI-31K.xlsx
- Licence: **Creative Commons Attribution-ShareAlike 4.0 International** — https://creativecommons.org/licenses/by-sa/4.0/

Source-normalized CSVs are staged at `content/rights-staging/ngsl-1.2/` from the open reformatter https://github.com/kami-mura/ngsl-wordlists; each is Git-blob-SHA-pinned against the exact upstream file, and the unmodified CC BY-SA licence text is included. The CSVs are repackaged from official data; their numbers are **not** freshly computed or claimed as original frequency measurements. Include attribution, the licence link, changes made, and ShareAlike obligations when distributing NGSL-adapted list material. Licencing of any additional text, definitions, translations, audio, images and outside sources must be determined **independently**.

`npm run assurance:ngsl:a1:check` enforces 900/900 stable-ID and headword coverage, upstream snapshot integrity, candidate-only flags, actual lemma/rank evidence, and JSON↔CSV consistency. It runs in `npm run validate:data`. It does not license protected text or approve candidate senses.

## Why this is not Gate 0 clearance

The legacy Oxford-derived workbook was removed from current Git HEAD, but existing source entries, Persian translations, lessons, assessment questions, generated audio and public catalogues remain under conservative **UNVERIFIED** lineage. Merely replacing its attribution with NGSL, changing one word into a synonym, or retaining a heavily adapted inherited lesson under a new source label would not establish the necessary permissions. The historical workbook may also remain in Git history.

A defensible migration uses the NGSL word list only as independent **selection input**, retains IDs for learner progress only, and creates all new lexical meanings, bilingual examples, instructions, dialogues, exercises and reviews without consulting or transforming the legacy lessons. A separate source such as properly attributed Open English WordNet may supply lexical senses, but it has its own Princeton and CC BY 4.0 notices and does **not** prove A1 suitability. All 59 related-lemma and 3 uncovered entries need editorial replacement decisions, and the actual A1 senses of even exact headword matches require lexical review.

For every **new** published artifact, register the source version, approved licensed material used, asset/content SHA-256, evidence location, applicable licence/attribution, and independent reconstruction review in `content/assurance/provenance.json` and `content/assurance/rights-lineage.json`. Regenerate lesson JSON from the clean canonical corpus, re-create or separately license the 30 scene/contrast materials, public reference catalogues, all audio, icons and artwork, then require the same strict rights audit and Gate 0 check before deployment. Until the audit is fully cleared, **do not redistribute the legacy-derived app as a rights-cleared release**.

No source-rights or human-review votes are invented by this mapping; stage-only mappings must not be auto-copied into learner-facing data.
