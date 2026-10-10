# Later-unit usage notes — 2026-10-10

The content standard requires a Persian usage note for function words:
prepositions, conjunctions, pronouns, determiners, articles, modals and
particles (`USAGE_REQUIRED`). The app shows this note as "Usage" in the lesson
and on the word card.

Claude Code wrote notes for all 61 such senses in course Units 4–12, recorded
as generator `claude-code-2026-10-10-usage-notes`. They have no independent
semantic certificate.

## What a note adds

Each note complements the sense's meaning, grammar patterns and mistake, and
does not repeat them. It is a practical point:
- a contrast with a near neighbour (*through* / *across*, *under* / *below*,
  *which* / *what*, *by car* / *in my car*);
- register, such as *can't* in speech and *cannot* in writing, or *not many*
  as more usual than *few*;
- a fixed phrase whose meaning is not obvious (*the other day*, *up the road*,
  *behind schedule*);
- the form in other tenses (*had to*, *was able to*).

Before applying, the drafts were checked for overstated rules, the fault review
found in the mistake translations. Five notes were softened: "only" for
*than*, the frequency of *no*, and the wording of *near*, *enough* and
*behind*. Review then found five more that stated a tendency as a rule: *both* / *neither*, the comma before *but*, *next to*, *between* and *under* / *below*. Those now describe the usual case.

## Scope and result

Membership comes from `content/curriculum/A1.json`. None of the 180 frozen
Units 1–3 entries changed. The 36 remaining `USAGE_REQUIRED` findings are all
in them.

| Finding | Before | After |
|---|---:|---:|
| Usage note required | 97 | 36 |
| All deterministic findings | 8,321 | 8,260 |

No other code changed, and the baseline was lowered to match. Content,
provenance (57 entries), rights chunk names, the authorship map and assurance
records were regenerated. Gate 0 remains BLOCKED.
