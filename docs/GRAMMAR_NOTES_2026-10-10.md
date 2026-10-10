# Later-unit grammar notes in Persian — 2026-10-10

Each grammar pattern on a word card has a `note` field, and the content
standard requires that note to explain the pattern in Persian
(`PERSIAN_GRAMMAR_NOTE`). In 781 later-unit notes the field held only English
examples, for example `some apples, some water`. The learner saw the pattern
and its examples with no explanation.

Claude Code added a short Persian explanation in front of each of these
notes, recorded as generator `claude-code-2026-10-10-grammar-notes`. The
original English examples are kept unchanged after a colon:

> پیش از اسم جمع یا غیرقابل‌شمارش، برای مقدار نامشخص: some apples, some water

There is no independent semantic certificate.

## Care taken

- Each explanation states what the pattern does, for example its meaning, the
  preposition it takes, whether *to* follows, or whether a noun is countable.
  It does not repeat the pattern or the sense's mistake.
- The drafts were checked for absolute claims before applying, the fault
  review found in the mistake translations and usage notes. Seven were
  softened or corrected:
  - *wait + time*, where *for* is optional and not absent;
  - *meet with*, which is used for formal meetings;
  - *match*, *put*, *same* and *best*, which now say "usually";
  - *too* at the end of a sentence;
  - *an ice cream*, which is countable for one serving.

## Scope and result

Membership comes from `content/curriculum/A1.json`, covering course Units 4–12
(zero-based 3–11). The 180 frozen Units 1–3 entries are unchanged, and the 161
remaining findings are all in them.

| Finding | Before | After |
|---|---:|---:|
| Grammar notes without Persian | 942 | 161 |
| All deterministic findings | 8,260 | 7,479 |

No other code changed, and the baseline was lowered to match. Content,
provenance (473 entries), rights chunk names, the authorship map and assurance
records were regenerated. Gate 0 remains BLOCKED.
