# Later-unit mistake-pair translations — 2026-10-10

Every A1 sense shows one common mistake beside its correction. Most later-unit
senses had no Persian line under either sentence (`MISTAKE_WRONG_FA_MISSING`,
`MISTAKE_RIGHT_FA_MISSING`). Two passes give every sense in course Units 4–12 both
lines. Claude Code wrote them in this session, recorded as generator
`claude-code-2026-10-10-mistake-translations`. They have no independent semantic
certificate.

## The pattern

The pattern follows the existing pairs in Units 1–3:

- **`rightFa`** is a natural Persian translation of the corrected sentence.
- **`wrongFa`** shows what the incorrect sentence does in Persian, so the two
  lines never look the same:
  - `منظور: …` gives the intended meaning, followed by a short clause naming the
    English error. Use it when the wrong sentence is only malformed, for example
    an article, agreement, spelling or word-order error.
  - `ترجمهٔ تحت‌اللفظی: …` gives what the sentence actually says, followed by a
    short clause on why that is not the intended meaning. Use it when the wrong
    word changes the meaning, for example *bench* for bank, *cooker* for cook or
    *get up the bus*.

  - When the "wrong" sentence is acceptable English but less usual, `wrongFa`
    says so, for example the emphatic *I very much like it* or *product* for
    a harvest. It names the more natural choice and does not call the sentence
    an error. Thirteen lines were revised this way after review.

The `why` explanation is unchanged.

## Scope

The selection used actual curriculum membership (`content/curriculum/A1.json`,
zero-based units 3–11), not the source file names.

| Course unit | Senses | PR |
|---|---:|---|
| 04-food-drink | 93 | #194 |
| 05-shopping-money | 89 | #194 |
| 06-places-directions | 97 | #194 |
| 07-travel-transport | 96 | this pass |
| 08-work-study | 90 | this pass |
| 09-leisure-people | 87 | this pass |
| 10-weather-clothes | 95 | this pass |
| 11-health-feelings | 89 | this pass |
| 12-help-everyday-problems | 95 | this pass |
| **Total** | **831** | |

Before the Units 7–12 pass, its drafts were audited for the faults review found
in #194. Seventeen lines were softened where the "wrong" sentence is acceptable
but less usual.

None of the 180 frozen Units 1–3 entries changed. Audio, curriculum and scene
sources are unchanged.

## Deterministic report

No other code changed.

| Finding | Before | After #194 | After Units 7–12 |
|---|---:|---:|---:|
| Missing wrong-sentence Persian | 1,004 | 725 | 173 |
| Missing corrected-sentence Persian | 1,004 | 725 | 173 |
| Identical wrong/right Persian | 0 | 0 | 0 |
| All deterministic findings | 9,983 | 9,425 | 8,321 |

The no-regression baseline was lowered to these counts. The following were
regenerated:

- compiled content;
- agent provenance for 240 entries (#194) and 480 entries (Units 7–12);
- the hashed public chunk names in the rights lineage, which keep their
  existing UNVERIFIED source;
- the legacy authorship map;
- the assurance records.

Gate 0 remains BLOCKED. Semantic judge qualification remains 0/4. This is
deterministic coverage, not a linguistic review.

The 173 remaining pairs are all in frozen Units 1–3. Changing them needs an
owner decision on the frozen study and audio scope.
