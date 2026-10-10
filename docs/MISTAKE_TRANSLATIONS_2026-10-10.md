# Later-unit mistake-pair translations — 2026-10-10

Every A1 sense shows one common mistake beside its correction. Most later-unit
senses had no Persian line under either sentence (`MISTAKE_WRONG_FA_MISSING`,
`MISTAKE_RIGHT_FA_MISSING`). This pass gives each sense in course Units 4–6 both
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

The `why` explanation is unchanged.

## Scope

The selection used actual curriculum membership (`content/curriculum/A1.json`,
zero-based units 3–5), not the source file names.

| Course unit | Senses |
|---|---:|
| 04-food-drink | 93 |
| 05-shopping-money | 89 |
| 06-places-directions | 97 |
| **Total** | **279** |

None of the 180 frozen Units 1–3 entries changed. Audio, curriculum and scene
sources are unchanged.

## Deterministic report

No other code changed.

| Finding | Before | After |
|---|---:|---:|
| Missing wrong-sentence Persian | 1,004 | 725 |
| Missing corrected-sentence Persian | 1,004 | 725 |
| Identical wrong/right Persian | 0 | 0 |
| All deterministic findings | 9,983 | 9,425 |

The no-regression baseline was lowered to these counts. The following were
regenerated:

- compiled content;
- agent provenance for 240 entries;
- the hashed public chunk names in the rights lineage, which keep their
  existing UNVERIFIED source;
- the legacy authorship map;
- the assurance records.

Gate 0 remains BLOCKED. Semantic judge qualification remains 0/4. This is
deterministic coverage, not a linguistic review.

Units 7–12 still need 725 pairs.
