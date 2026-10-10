# A1 rebuild on CEFR-J and NGSL

Started 2026-10-10. **Status: phase 1 of 3.** This plan replaces the
Oxford-derived A1 headword list with a selection made by a written rule from
openly usable sources. It is an engineering record, not a legal opinion.
Gate 0 stays BLOCKED until the evidence described below is complete.

## Owner decisions (2026-10-10)

The project owner said:

> Map all words to ngsl list, all other materials except words are made of chatgpt

and answered four follow-up questions:

| Question | Answer |
|---|---|
| When the lessons were made with ChatGPT, was any Oxford text (definitions, example sentences, exercises) pasted in as input? | No, only the words |
| How should the app's word list be based on NGSL? | Rebuild by an NGSL rule |
| Which rule should choose the A1 words? | All CEFR-J A1 (~1,060) |
| Frozen Units 1–3 lose about 18 words under the new rule. May I edit them? | Yes, unfreeze them |

The statement and the answers are kept verbatim under `laterStatements` in
`content/assurance/owner-authorship-attestation.json`. Like the earlier
statement, they are owner testimony and do not grant or prove any licence.

**Why CEFR-J and not NGSL alone.** NGSL is a frequency list and has no level
grading. Taking NGSL's 900 most frequent words would retire about 305 current
words, among them *sister, coffee, breakfast, rain* and *Monday*. It would also
add about 390 mostly abstract words such as *government* and *policy*. Many
basic A1 words (*apple, hungry*) are not in core NGSL at all. CEFR-J grades
words by CEFR level, so the owner chose CEFR-J A1 as the selection rule and
NGSL as the frequency and attribution map.

## Sources

| Source | Use | Terms | Pinned file |
|---|---|---|---|
| CEFR-J Wordlist 1.5 (Yukio Tono, Tokyo University of Foreign Studies), via Open Language Profiles | Selection: every headword graded A1 | "can be used for research and commercial purposes with no charge, provided that you cite the dataset properly" (upstream README, kept beside the data) | `content/rights-staging/cefrj-1.5/cefrj-vocabulary-profile-1.5.csv`, upstream commit `d4e45b7`, Git blob `e89799a` |
| NGSL 1.2 core, supplement and SFI 31k extension | Frequency order and attribution | CC BY-SA 4.0 | `content/rights-staging/ngsl-1.2/` (already pinned) |

Required citations:

- The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of
  Foreign Studies. Retrieved from https://github.com/openlanguageprofiles/olp-en-cefrj.
- Browne, C., Culligan, B. & Phillips, J. (2013). The New General Service List
  1.2. CC BY-SA 4.0.

The official CEFR-J download page (cefr-j.org) could not be reached from the
build environment. The terms above are those published with the mirrored
dataset. Before release, the owner should confirm them against the official
page, which names version 1.6 as current.

## The selection

`npm run assurance:a1:cefrj` rebuilds the selection from the pinned files and
fails if the committed output differs. It runs inside `npm run validate:data`.
Output: `content/rights-staging/a1-rebuild/cefrj-a1-selection.json` and `.csv`.

| Measure | Count |
|---|---|
| CEFR-J A1 headwords selected (in 1,164 headword + part-of-speech records) | **1,066** |
| Headwords already taught by a kept entry (RETAINED) | 728 |
| Headwords not yet taught (NEW) | 338 |
| A1 parts of speech of taught words that no lesson covers yet (to review) | 80 |
| Current entries that leave the course (RETIRED) | 171 |
| Selected headwords in NGSL core / supplement / 31k extension / unmatched | 809 / 43 / 132 / 82 |

**How words are matched.** Spelling is compared with capitals kept, so the
month *May* and the title *Miss* never stand in for the modal *may* or the
verb *miss*. A current lesson stays when CEFR-J grades its spelling A1 in any
part of speech. Part of speech decides `posTaught`, not retirement, because
CEFR-J's labels often differ from the catalogue's. It files *hello* as a noun,
and it grades *try* A1 only as a noun. A `posTaught: false` record means
"review in phase 2", not "missing".

Of the 171 retired entries, CEFR-J grades 143 as A2, 21 as B1 and 2 as B2, and
5 are not in CEFR-J at all: *born, cannot, fourth, goodbye* and *oh*. Of these, *cannot*, *goodbye* and *fourth* can still be taught inside the
lessons for *can*, *bye* and *four*. Some are useful words
that CEFR-J places above A1, such as *film, road, hundred, understand, foot* and
*sometimes*. They leave the A1 course under the agreed rule.

Retirements per unit: Unit 1: 0, Unit 2: 8, Unit 3: 10, Unit 4: 13, Unit 5: 21,
Unit 6: 22, Unit 7: 21, Unit 8: 23, Unit 9: 9, Unit 10: 9, Unit 11: 20,
Unit 12: 15.

The 82 unmatched headwords are mostly word forms and fixed phrases that NGSL
counts under a base word (*my, was, 'm, ice cream, good morning*). Among the 338
NEW headwords:
- 48 are such forms or phrases, which will be taught inside the base word's
  lesson or as a short phrase lesson;
- 65 already have a staged NGSL draft that can be reused;
- about 225 need new lessons.

## Phases

1. **Selection and records (this phase).** Pin CEFR-J, record the owner
   statement (bound verbatim by the attestation schema), generate and check the
   selection, and document the plan. No app content changes.
2. **Lessons for NEW words.** Author full catalogue entries in batches: meaning,
   Persian, grammar, examples, collocations, a mistake pair, pronunciation,
   checks and usage. Reuse the staged NGSL drafts where they exist and fold
   forms into their base words. Then generate the audio. Every lesson is new
   writing and does not use Oxford text.
3. **New curriculum.** Assign every selected word to units with prerequisites.
   Retire the 171 entries from the course, keeping them in history. Lift the
   Units 1–3 freeze (owner decision above) and redefine the study roster. Then
   rebuild scenes, the frontier, provenance, assurance records and rights
   lineage.

## What this does not do

- It does not clear Gate 0. Each item still needs SHA-bound rights-lineage
  evidence, and audio, artwork and voice-model terms need their own audit.
- It does not approve any lesson. Semantic, Persian and CEFR review are still
  required.
- It does not relicense anything copied from Oxford. The owner states that only
  the headword list came from there, and that list is being replaced.
