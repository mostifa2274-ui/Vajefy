# Units 2–3 mistake-pair translations — 2026-10-12

The later-unit pass ([MISTAKE_TRANSLATIONS_2026-10-10.md](MISTAKE_TRANSLATIONS_2026-10-10.md))
gave every sense in course Units 4–12 a Persian line under both sentences of its
mistake pair. The 173 senses in Units 2–3 were left out, because those units were
frozen. The owner has since unfrozen Units 1–3 for the CEFR-J rebuild
([A1_CEFRJ_REBUILD.md](A1_CEFRJ_REBUILD.md)), so this pass gives them the same
two lines. Unit 1, the semantic-calibration slice, already had both lines and is
unchanged.

Claude Code wrote the lines in this session, recorded as generator
`claude-code-2026-10-12-units-2-3-mistake-translations`. They have no
independent semantic certificate.

## The pattern

The pattern is the same as in the later-unit pass:

- **`rightFa`** is a natural Persian translation of the corrected sentence.
- **`wrongFa`** shows what the incorrect sentence does, so the two lines never
  look the same:
  - `منظور: …` gives the intended meaning, then names the English error. It is
    used when the wrong sentence is only malformed: a missing article, wrong
    agreement, word order, spelling or a wrong preposition.
  - `ترجمهٔ تحت‌اللفظی: …` gives what the sentence actually says, then the
    intended meaning. It is used when the wrong word changes the meaning: *her*
    for a man, *month* for the moon, *on the table* for at the table, *lately*
    for late, or *personnel* for personal.
  - When the "wrong" sentence is acceptable but less usual, `wrongFa` says so
    and names the more natural choice. This applies to *I eat my breakfast*,
    *two times*, and *I and my sister*.
- *too* is translated as «بیش از حد».

The `why` explanations are unchanged.

## Scope

The selection used actual curriculum membership (`content/curriculum/A1.json`),
not source file names: course Unit 2 (85 senses) and Unit 3 (88 senses). Twenty
of these entries are among the 166 that the staged CEFR-J curriculum moves above
A1. They are translated too, because they are still taught at A1 until the
switch, and the lines remain correct at their new level. Audio, curriculum,
examples, checks and scene sources are unchanged.

## Deterministic report

| Finding | Before | After |
|---|---:|---:|
| Missing wrong-sentence Persian | 173 | 0 |
| Missing corrected-sentence Persian | 173 | 0 |
| Identical wrong/right Persian | 0 | 0 |
| All deterministic findings | 6,640 | 6,294 |

The no-regression baseline was lowered to these counts. The following were
regenerated:

- compiled content;
- agent provenance for 160 entries;
- the eight renamed public lesson chunks in the rights lineage, which keep their
  existing UNVERIFIED source;
- the legacy authorship map;
- the assurance records.

Gate 0 remains BLOCKED, and semantic judge qualification is still 0/4. This is
deterministic coverage, not a linguistic review.
