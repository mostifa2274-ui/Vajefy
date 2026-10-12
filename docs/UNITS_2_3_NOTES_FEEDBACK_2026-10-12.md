# Units 2–3 usage notes, grammar notes and answer feedback — 2026-10-12

Three later-unit passes from 2026-10-10 filled in three kinds of Persian text
for course Units 4–12:

- usage notes ([USAGE_NOTES_2026-10-10.md](USAGE_NOTES_2026-10-10.md));
- grammar notes ([GRAMMAR_NOTES_2026-10-10.md](GRAMMAR_NOTES_2026-10-10.md));
- answer feedback ([CHECK_FEEDBACK_2026-10-10.md](CHECK_FEEDBACK_2026-10-10.md)).

Units 1–3 were frozen at the time. The owner has since unfrozen them for the
CEFR-J rebuild, so this pass does the same work for Units 2–3. Unit 1, the
semantic-calibration slice, already passed and is unchanged. The Units 2–3
mistake pairs were done first, in
[MISTAKE_TRANSLATIONS_UNITS_2_3_2026-10-12.md](MISTAKE_TRANSLATIONS_UNITS_2_3_2026-10-12.md).

Claude Code wrote everything in this session, recorded as generator
`claude-code-2026-10-12-units-2-3-notes-feedback`. None of it has an
independent semantic certificate.

## What changed

- **Usage notes (36).** Each function-word sense now has a Persian `usage`
  note, placed before the mistake as in the other units. Each note adds one
  practical point that the sense's meaning, grammar and mistake do not already
  give. Examples:
  - a near neighbour: *during* / *for*, *every* / *each*, *with* / *by bus*;
  - a fixed phrase: *after a while*, *Enjoy yourself*, *for nothing*;
  - a spelling or sound trap: *our* / *hour*, *everyday* / *every day*;
  - singular *they*, *them* and *their* for someone whose gender is not known.

  Notes describe the usual case and say "usually" where English allows
  another choice.
- **Grammar notes (161).** Each note that held only English examples now
  opens with a short Persian explanation, and the original examples follow
  unchanged after a colon. Example:
  `در حال ساده، فعلِ بعد از she ‑s یا ‑es می‌گیرد: she lives, she works`.
- **Answer feedback (114).** Each feedback line that held only an English
  fragment now opens with a Persian reason, and the original fragment follows
  unchanged after a colon. A reason says why the answer fits this sentence
  rather than stating a general rule. For example, *take a shower* is accepted
  as having the same meaning as *have a shower*, and *sit on a chair* notes
  that *in* is used for an armchair.

Examples, checks, answers, audio, curriculum and scenes are unchanged.

## Deterministic report

| Finding | Before | After |
|---|---:|---:|
| Usage note required | 36 | 0 |
| Grammar note without Persian | 161 | 0 |
| Answer feedback without Persian | 114 | 0 |
| All deterministic findings | 6,294 | 5,983 |

Every Persian-coverage code is now zero across all A1 units. The remaining
findings are:

- example count (1,007);
- reused examples (32);
- frontier vocabulary (4,897 in tasks and 47 in scenes).

The no-regression baseline was lowered. The following were regenerated:

- compiled content;
- provenance for 136 entries;
- the eight renamed lesson chunks in the rights lineage, which keep their
  existing UNVERIFIED source;
- the authorship map;
- the assurance records.

Gate 0 remains BLOCKED, and semantic judge qualification is still 0/4. This is
deterministic coverage, not a linguistic review.
