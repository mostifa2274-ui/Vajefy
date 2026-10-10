# Later-unit answer feedback in Persian — 2026-10-10

Every check in a lesson (cloze, choice, produce) shows a short `why` after the
learner answers, and the content standard requires that feedback in Persian
(`PERSIAN_CHECK_FEEDBACK`). In 758 later-unit checks the feedback was only an
English fragment such as `a cup of tea.` or `in the north of.`. It repeated the
answer without saying why.

Claude Code added a short Persian reason in front of each of these, recorded as
generator `claude-code-2026-10-10-check-feedback`. The original English fragment
is kept unchanged after a colon:

> بین cup و tea حرف of لازم است: a cup of tea.

There is no independent semantic certificate.

## Care taken

- Each reason names what makes the answer right: a preposition, an article,
  countability, word order, a fixed phrase, or a verb form after *can*, *enjoy*
  or *stop*.
- For the three wrong options in the *play* question, the reason gives the verb
  that goes with that activity (*go swimming*, *do yoga*).
- Before applying, the drafts were checked for absolute claims, the fault
  review found in #194–#197. Five were softened: *juice*, *sugar* and *snow*
  are usually uncountable; *practice* is uncountable in the sense of
  practising; and *turn left* usually has no *to the*.

## Scope and result

Membership comes from `content/curriculum/A1.json`, covering course Units 4–12.
The 180 frozen Units 1–3 entries are unchanged, and the 114 remaining findings
are all in them.

| Finding | Before | After |
|---|---:|---:|
| Check feedback without Persian | 872 | 114 |
| All deterministic findings | 7,479 | 6,721 |

No other code changed, and the baseline was lowered to match. Content,
provenance (464 entries), rights chunk names, the authorship map and assurance
records were regenerated. Gate 0 remains BLOCKED.
