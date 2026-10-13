# Core words taught earlier in the staged CEFR-J curriculum, 2026-10-13

In the current order, many core words are taught late: *do*, *not*, *can* and
*please* in Unit 12, *on* in Unit 10, *to*, *at* and *for* in Unit 7. Tasks in
earlier units use them anyway, so most frontier findings come from a few
words (*do* alone caused 304). This change teaches them earlier in the
**staged** CEFR-J curriculum only. The live course
(`content/curriculum/A1.json`) and the study cohort's Units 1–3 are unchanged,
and the staged curriculum is still unapproved and not live.

## How it works

`curriculum-assignments.json` has a new `promotions` list. Each promotion
moves one retained A1 entry to an earlier unit, after that unit's NEW start
entries or directly after a named `after` entry of that unit, and names the
prerequisites it no longer waits for. Unit 2's promotions follow its opening
grammar block, so it now teaches *am, are, is*, then *the, that, she, it, we,
they, and, have, with, of*, then *do, on, not, can, to, at* and the rest. The builder
(`npm run assurance:a1:cefrj:curriculum`) rejects:

- a promotion into the calibration unit (Unit 1 stays exactly as it is);
- a promotion to a later or the same unit;
- a promoted entry whose remaining prerequisites still come after it;
- dropping a prerequisite the entry does not have;
- an `after` anchor that is not a retained entry staying in the target unit;
- promoting an entry that leaves A1 or a NEW entry.

Every dropped prerequisite is listed in the staged file with reason
`promoted`. Removing the `promotions` list restores the previous staged order.

## How the promotions were chosen

A greedy search on the staged curriculum (`scripts/content-assurance.ts
--curriculum`) took the word behind the most frontier findings, moved it to
the start of the earliest unit that uses it (Unit 2 at the earliest), and kept
the move only if it removed at least ten findings. Two strategies were
measured:

| Strategy | Promotions | Unit 2 size | Staged frontier findings |
|---|---:|---:|---:|
| None (before) | 0 | 115 | 4,018 |
| Bring prerequisites along | 25 | 160 | 2,933 |
| Drop thematic prerequisites (chosen) | 34 | 148 | 2,450 |

The second strategy is used because the prerequisites on these core words are
thematic, not linguistic: *do* waited for *help* and *problem*, *on* for
*put*, *to* for *go* and *place*. Bringing them along dragged whole topic
chains (*money*, *buy*, *shop*, *clothes*, *wear*, *put*) into Unit 2. The 40
dropped prerequisites are thematic links of that kind.

## The promoted words

To Unit 2 (family and home): *do, not, can, please, on, to, at, for, go,
come, will, make, good, there, here, see, phone, work, book, word, sentence,
people, love, nice, know, no, say, but, wait, two, very, car* and *like*
(find pleasant). To Unit 3 (daily routine): *write*.

Most are function words or high-frequency verbs. A few are content words
(*car*, *book*, *phone*, *sentence*, *people*) that tasks in early units use
constantly.

## Result

| Measured result | Before | After |
|---|---:|---:|
| Staged `FRONTIER_TASK_VOCABULARY` | 3,982 | 2,383 |
| Staged `FRONTIER_SCENE_VOCABULARY` | 36 | 36 |
| Unit 2 entries (staged) | 115 | 148 |
| Live findings | 4,815 | 4,815 |

Unit sizes in the staged curriculum are now 20, 148, 96, 87, 75, 82, 69, 84,
117, 106, 108 and 80. This is a structural proposal measured by deterministic
checks; it is not pedagogical, semantic or curriculum approval.

## Follow-up: placement and where to stop (2026-10-13)

Placing the promoted words at the very start of Unit 2 put *do* and *not*
before *the* and *it*, and their tasks then used words not yet taught (127
findings, 34 of them *the*). With the `after` anchor on *of*, staged findings
are 2,419 instead of 2,450 (the measured 2,450 → 2,419 step is this change).

A second search pass that kept any promotion removing at least five findings
added 23 more words for only 157 fewer findings (to 2,293) and grew Unit 2 to
164 entries, so it was not adopted. What remains is a long tail: 560 words,
most with a handful of findings each, and about 1,050 of the findings are in
Units 2–3 tasks, where beginner tasks use later words. Those need rewording
or support glosses, which is a content-design decision rather than a
curriculum one.
