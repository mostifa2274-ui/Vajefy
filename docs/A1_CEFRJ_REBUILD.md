# Word-list rebuild on CEFR-J, Octanove and NGSL

Started 2026-10-10. **Status: phase 1 of 3 done.** This plan replaces the
Oxford-derived headword lists, A1 first and then every level, with selections
made by a written rule from openly usable sources. It is an engineering record, not a legal opinion.
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
| CEFR-J Wordlist 1.5, all levels | Whole-app placement: A1–B2 | As above | As above |
| Octanove Vocabulary Profile C1/C2 1.0 (Octanove Labs), via Open Language Profiles | Whole-app placement: C1–C2 | CC BY-SA 4.0 (upstream README) | `content/rights-staging/cefrj-1.5/octanove-vocabulary-profile-c1c2-1.0.csv`, same commit, Git blob `3a0505e` |
| NGSL 1.2 core, supplement and SFI 31k extension | Frequency order and attribution | CC BY-SA 4.0 | `content/rights-staging/ngsl-1.2/` (already pinned) |

Required citations:

- The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of
  Foreign Studies. Retrieved from https://github.com/openlanguageprofiles/olp-en-cefrj.
- Browne, C., Culligan, B. & Phillips, J. (2013). The New General Service List
  1.2. CC BY-SA 4.0.
- Octanove Vocabulary Profile C1/C2 1.0. Octanove Labs. CC BY-SA 4.0.
  Retrieved from https://github.com/openlanguageprofiles/olp-en-cefrj.

Octanove and NGSL are ShareAlike licences. A published list derived from them,
such as the app's level lists, must carry the same licence and attribution.
The owner should confirm how this applies to the app before release.

The official CEFR-J download page (cefr-j.org) could not be reached from the
build environment. The terms above are those published with the mirrored
dataset. Before release, the owner should confirm them against the official
page, which names version 1.6 as current.

## Whole-app decisions (2026-10-10)

After the A1 decisions, the owner asked: "Do for all words in the app", and
answered three follow-up questions:

| Question | Answer |
|---|---|
| How many words should each level (A2 to C1) have? | All listed words no drop out |
| CEFR-J has one B2 level but the app has B2 and B2+. What should happen? | Merge into one B2 |
| Octanove also lists 896 C2 words. The app has no C2 level. Add one? | Add a C2 level |

So the app's levels become **A1, A2, B1, B2, C1, C2**. Every word in CEFR-J
(A1–B2) or in the Octanove Vocabulary Profile (C1–C2) is placed at the lowest
level either list gives it. **No current word drops out**: a current word in
neither list keeps its current level, with B2+ read as B2.

**Scope.** The plan's restraint rule freezes A2–C1 development until the A1
completion gate (`docs/AUTONOMOUS_ASSURANCE_PLAN.md` §4 and §32). The
whole-app placement is still needed now, because the A2–C1 word lists already
ship in `public/data`, and Gate 0 covers every distributed file. It is a rights
record only. Writing A2–C2 content, merging B2+ into B2 and adding C2 are
**deferred** until the A1 gate passes, or until the owner formally lifts the
freeze in the plan.

## The A1 selection

`npm run assurance:a1:cefrj` rebuilds the A1 selection from the pinned files and
fails if the committed output differs. It runs inside `npm run validate:data`.
Output: `content/rights-staging/a1-rebuild/cefrj-a1-selection.json` and `.csv`.

| Measure | Count |
|---|---|
| CEFR-J A1 headwords selected (in 1,164 headword + part-of-speech records) | **1,066** |
| Headwords already taught by a kept A1 entry (RETAINED) | 728 |
| Headwords not yet taught in A1 (NEW) | 338 |
| A1 parts of speech of taught words that no lesson covers yet (to review) | 80 |
| Current A1 entries that move up to their CEFR-J level | 166 |
| Current A1 entries CEFR-J does not list, kept in A1 | 5 |
| Selected headwords in NGSL core / supplement / 31k extension / unmatched | 809 / 43 / 132 / 82 |

**How words are matched.** Spelling is compared with capitals kept, so the
month *May* and the title *Miss* never stand in for the modal *may* or the
verb *miss*. A current lesson stays when CEFR-J grades its spelling A1 in any
part of speech. Part of speech decides `posTaught`, not placement, because
CEFR-J's labels often differ from the catalogue's. It files *hello* as a noun,
and it grades *try* A1 only as a noun. A `posTaught: false` record means
"review in phase 2", not "missing".

Of the 166 entries that move up, CEFR-J grades 143 as A2, 21 as B1 and 2 as B2.
Some are useful words such as *film, road, hundred, understand, foot* and
*sometimes*. They stay in the app at their CEFR-J level. The 5 that CEFR-J does
not list (*born, cannot, fourth, goodbye, oh*) stay in A1.

Entries leaving A1 per unit: Unit 1: 0, Unit 2: 8, Unit 3: 10, Unit 4: 13,
Unit 5: 21, Unit 6: 22, Unit 7: 21, Unit 8: 23, Unit 9: 9, Unit 10: 9,
Unit 11: 20, Unit 12: 15. The five owner-kept words are among these counts and
stay in their units.

The 82 unmatched headwords are mostly word forms and fixed phrases that NGSL
counts under a base word (*my, was, 'm, ice cream, good morning*). Among the 338
NEW A1 headwords:
- 249 already have a short entry at a higher level of the app, which can seed
  their A1 lesson; 89 are new to the app;
- 48 are word forms or phrases, which will be taught inside the base word's
  lesson or as a short phrase lesson;
- 65 have a staged NGSL draft that can be reused.

## Phase 2: full A1 lesson drafts

On 2026-10-11, `lessons-new-001-020.json` stages full lessons for the first
20 NEW A1 headwords in selection order: may, case, set, hold, side, already,
almost, yet, care, matter, mind, either, top, social, along, sale, cover, war,
bear and role. PR #209 merged that batch and the source/identity validator as
`ac406a5ba870914694a2fb489089f81da7fdd292`; its main CI passed 558 unit tests
and 95 browser tests, plus the Workers build, rollback and gateway checks.

`lessons-new-021-040.json` continues with step, site, sign, wish, kid, kill,
field, vote, focus, stage, technology, save, due, pick, ground, fight, leader,
store, heart and foreign. PR #210 merged that batch as
`a27bc143b8d80d4448c971efe92a21cd72b2e6fa`. Its `kill` mistake pair contrasted
two grammatical sentences; it now shows an error with no correct reading, *The
old tree was kill by the storm*, corrected to *The old tree was killed by the
storm*.

`lessons-new-041-060.json` continues with surprise, drop, Miss, worry, inside,
catch, character, guy, size, alone, review, board, church, item, touch, file,
middle, bar, seat and throw. `catch` has two CEFR-J records, a noun and a verb,
so this batch has 21 senses. PR #212 merged it as
`e28d8b34a38eede4962e618fda02fcaca70c54fc`.

`lessons-new-061-080.json` continues with goal, push, successful, speech,
officer, mine, memory, ring, dream, smile, judge, survey, wind, block, copy,
heavy, collect, straight, fair and collection. PR #213 merged it as
`e9f65c25583ab14e5157fbbdf6a6ee0dc6f1a91e`, after its review fixed the
definition of wind (moving air, not only fast air) and translated *too* as
«بیش از حد» rather than «خیلی» (*very*).

`lessons-new-081-100.json` continues with ship, peace, dry, spot, feed,
excellent, camp, corner, cry, solve, tool, smoke, brain, bottom, hide, owner,
lady, pleasure, suggestion and pop. The five batches total **100/338 drafted,
238 still to write**, with 303 bilingual examples and 303 checks. These are
draft counts, not approved or published lessons. Definitions must not be
narrower than the word: wind is any moving air, a cry can be quiet, and smoke
is often, not always, grey or black. Choice answers are balanced across
both option positions. Every "wrong" sentence must be wrong under any reading,
not merely odd: a missing article, a wrong plural or irregular past, or a
verb used with the wrong pattern (for example *Yesterday I fell my phone* for
*Yesterday I dropped my phone*). Pairs whose "wrong" side has a grammatical
reading, such as *Many trees killed in the storm* or *I opened the file at my
computer*, are not used.

Each lesson uses the existing enhanced-entry schema and contains a Persian
meaning and explanation, grammar notes, three bilingual examples, translated
collocations, usage guidance, a translated mistake pair, candidate GB/US
pronunciations, and three checks. The final check is a fresh held-out production
item. Audio has not been generated or certified; curriculum placement and
frontier certification wait for phase 3.

The authoring input was the selected headword and part of speech, not the
legacy definitions or examples. Existing short-entry **identity metadata** is
used to retain compatible IDs: `set` uses the existing verb `set-put`, `hold`
uses its noun entry, `cover` uses its noun entry, and `bear` uses its animal
entry. The modal `may` keeps its A2 ID; the A1 month `May` is a different word.
The second batch also uses the existing **verb** `lex:B2:step`, not the A2
noun, and teaches wish, vote and fight as the selected nouns, focus and pick
as verbs, and due and foreign as adjectives. Meanings are deliberately scoped:
save teaches money kept for later; stage teaches the performance platform;
other meanings need separate review. The third batch keeps the existing noun
IDs `lex:B1:worry`, `lex:B1:touch` and `lex:B1:file` and the noun
`lex:B2:catch`, whose verb sense is `lex:B2:catch#verb`. `Miss` (the title) and
the noun `throw` have no compatible entry and use new `lex:A1:cefrj-` IDs. It
teaches bar as a piece of chocolate or soap, review as a written opinion and
board as a classroom or notice board. The fourth batch uses the existing verb
entry `lex:A2:ring-2` (not the A2 noun for a finger ring), the pronoun entry
`lex:A2:mine-belongs-to-me` (not the B1 noun for a coal mine), and the noun
entries for survey and wind, not their B2 verbs. It teaches goal as a point in
football, ring as phoning (British English), dream as a dream while asleep,
memory as something remembered, and block as a block of flats or an office
block. The fifth batch keeps the noun entries `lex:B1:spot`, `lex:B2:feed` and
`lex:B2:cry` (not the A2 verbs feed and cry) and the A2 noun `pop`; it teaches
spot as a place, feed as food for animals, cry as a sound such as a shout,
and pop as pop music. Source-level A1 grading does not certify
that the authored sense or its supporting language is suitable for A1.
Part-of-speech matching is structural metadata, not proof of sense equivalence;
independent semantic checks and a progress-preserving migration remain required.

Run `npm run assurance:a1:cefrj:drafts`. The command is part of
`validate:data` and checks exact selection-file hashes, consecutive source
windows, every selected part of speech, canonical entry structure, Persian
coverage, compatible stable IDs, example/assessment separation and zero approval
flags. It compares examples against legacy enhanced content, scenes, contrasts
and all six short-entry lists for exact English or nine-word phrase reuse.
These limited overlap checks do not establish semantic correctness or rights.

Every independent-review, rights-clearance, audio-certificate and release count
for the new drafts remains **zero**. Continue at NEW headword **41, surprise**.
Do not repeat the first 40 drafts or import them into the public course before
curriculum, audio and assurance work is complete. PR #208's actual merge is
`76cabbca412648a61fe7cc9dbd84c134304c03b2`.

## The whole-app placement

`npm run assurance:levels` builds `content/rights-staging/level-rebuild/level-selection.json`
from the pinned CEFR-J, Octanove and NGSL files and the six current level lists
(5,322 entries). It fails if the committed file is stale and runs inside
`npm run validate:data`.

| Level | Listed words | Already in the app | New to the app | Current entries placed here | Of those, owner-kept |
|---|---|---|---|---|---|
| A1 | 1,064 | 975 | 89 | 1,158 | 5 |
| A2 | 1,242 | 968 | 274 | 1,110 | 13 |
| B1 | 2,139 | 1,375 | 764 | 1,438 | 13 |
| B2 | 2,417 | 911 | 1,506 | 1,020 | 98 |
| C1 | 913 | 128 | 785 | 562 | 434 |
| C2 | 874 | 34 | 840 | 34 | 0 |
| **All** | **8,649** | **4,391** | **4,258** | **5,322** | **563** |

Of the 5,322 current entries, 1,961 stay at their level, 2,798 move, and 563 are
in neither list and stay at their current level. The biggest moves are C1 → B2
(444), B2 → B1 (364), B1 → A2 (288), B2+ → B1 (275) and A2 → A1 (249). Most of
the owner-kept words are current C1 words (434) that Octanove does not list.
The A1 word count here (1,064) differs slightly from the A1 selection (1,066)
because spellings shared across CEFR-J and Octanove are joined into one word.

Octanove labels *remonstrate* with the typo `vern`. The builder corrects this
one known typo to `verb` and records it under `partOfSpeechCorrections`. Any
other unknown part of speech fails the build.

## Phases

1. **Selection and records (done).** Pin CEFR-J and Octanove, record the owner
   statement (bound verbatim by the attestation schema), generate and check the
   A1 selection and the whole-app placement, and document the plan. No app
   content changes.
2. **Content for new words.** For A1, write full lessons for the 338 NEW
   headwords: meaning, Persian, grammar, examples, collocations, a mistake
   pair, pronunciation, checks and usage. Seed them from existing higher-level
   entries and staged NGSL drafts, fold word forms into their base words, then
   generate audio. For A2–C2, write short entries (meaning, Persian,
   pronunciation, example) for the 4,169 words that are new to the app; this
   A2–C2 part is deferred by the A1 freeze (see Scope above). All writing is
   new and does not use Oxford text.
3. **New levels and curriculum.** In the app code:
   - merge B2+ into B2 and add C2, with a migration for learners whose focus or
     saved progress uses B2+ (deferred by the A1 freeze, see Scope above);
   - move each entry to its new level;
   - rebuild the A1 curriculum, lifting the Units 1–3 freeze (owner decision
     above) and redefining the study roster;
   - rebuild scenes, the frontier, provenance, assurance records and rights
     lineage.

## What this does not do

- It does not clear Gate 0. Each item still needs SHA-bound rights-lineage
  evidence, and audio, artwork and voice-model terms need their own audit.
- It does not approve any lesson. Semantic, Persian and CEFR review are still
  required.
- It does not relicense anything copied from Oxford. The owner states that only
  the headword list came from there, and that list is being replaced.
