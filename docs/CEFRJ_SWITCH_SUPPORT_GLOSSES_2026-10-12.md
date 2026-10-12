# Support glosses for words leaving A1, 2026-10-12

The staged CEFR-J curriculum (`content/rights-staging/a1-rebuild/curriculum-a1-cefrj.json`)
moves 166 current A1 entries to higher levels. Tasks in the entries that stay
in A1 still use some of those words, so after the switch they would name words
a learner has not been taught. Assessed against the staged curriculum
(`scripts/content-assurance.ts --curriculum`), 342 frontier findings had a
dependency that leaves A1. The most frequent words were *last* (47), *film* (33),
*next* (19), *send* (11) and *exam* (10).

Claude Code added 296 Persian support glosses to the tasks where a gloss is
allowed, recorded as generator `claude-code-2026-10-12-cefrj-support-glosses`.
A gloss is shown before the answer and explains a word already visible in the
task. Task text, answers, options, feedback, examples, curriculum and audio are
unchanged. The glosses have no independent Persian or semantic certificate.

## Rules

- Every gloss passes `taskSupportIssues`: the word is visible in the task, it
  appears in all choice options or none, and it never contains an answer.
- Meaning comes from the task, not one translation per word. *last night* is
  «دیشب», *last week* «هفتهٔ گذشته», but *the last month of the year* is
  «آخرین»; *next to* is «کنارِ» and *next week* «بعدی»; *part* is «نقش» in a
  school play and «بخش» elsewhere; *traffic light* is «چراغ راهنمایی».
- A gloss that would translate the tested phrase was not added: *lie* in
  *I need to lie ___ for an hour* (answer *down*).

## Result

| Measured result | Before | After |
|---|---:|---:|
| Staged: findings on words leaving A1 | 342 | 46 |
| Staged: `FRONTIER_TASK_VOCABULARY` | 4,291 | 3,982 |
| Staged: `FRONTIER_SCENE_VOCABULARY` | 37 | 36 |
| Live: `FRONTIER_TASK_VOCABULARY` | 4,897 | 4,768 |
| Live: all deterministic findings | 4,944 | 4,815 |

The live count also fell because some glossed words are taught later than the
task in the current order too. The live ratchet was lowered, never raised, and
no other code rose. Unit 1 is unchanged.

## Not glossable

The 46 remaining findings on words leaving A1 need rewording when the
curriculum switches, not a gloss:

- 45 are words inside some but not all choice options, usually a distractor or
  the answer itself (*thirsty* in a hungry/angry/thirsty choice, *next* among
  between/next/among, *last night* as an answer). Glossing them could reveal
  which option is right.
- 1 is the *lie down* case above.
