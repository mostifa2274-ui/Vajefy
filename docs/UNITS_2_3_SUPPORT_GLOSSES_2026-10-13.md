# Support glosses for Units 2–3 tasks, 2026-10-13

After the staged CEFR-J curriculum moved 34 core words earlier
(`docs/CEFRJ_CORE_WORD_PROMOTIONS_2026-10-13.md`), most of the frontier
findings left were in Units 2–3: beginner tasks that use words taught later.
Units 1–3 are no longer frozen for the rebuild, so these tasks can now take
Persian support glosses, the same remedy the later units already use.

Claude Code added 709 support glosses to 385 Unit 2–3 tasks, recorded as
generator `claude-code-2026-10-13-units-2-3-support-glosses`. Unit 1, task
text, answers, options, examples, curriculum and audio are unchanged. The
glosses have no independent Persian or semantic certificate.

## How the worklist was chosen

The worklist is the staged curriculum's frontier findings in Units 2–3, so a
word the staged order already teaches early (*do*, *not*, *can*) does not get
a gloss it will not need. Every gloss passes `taskSupportIssues`: the word is
visible in the task, it appears in all choice options or none, and it never
contains an answer.

## What was not glossed

- **Function words** (*and, at, but, by, can, do, for, have, his, me, our,
  their, them, us, to, so, than, or, all, any, some, the, if*, and
  *get/got*). A bare Persian gloss teaches these poorly; their order is the
  remedy.
- **Phrasal or answer-adjacent particles** (*up, out, off, down, back, past,
  right, over*), where a gloss would translate the tested phrase (*wake ___
  up*, *half ___ past*, *Go right ___*).

In all, 75 occurrences were skipped.

## Meaning in context

A word takes its meaning from the task. *I'd like a cup* is «می‌خواهم», not
«دوست داشتن»; *grows tomatoes* is «می‌کارد»; *my phone doesn't work* is «کار
نمی‌کند»; *Happy ___ Year!* glosses *Happy* as «مبارک»; *Which one* is «کدام
یکی»; *about ten hours* is «حدود»; phrases such as *a lot of*, *over there*,
*turn off*, *looking for*, *Hurry up* and *eat out* are glossed whole.

## Result

| Measured result | Before | After |
|---|---:|---:|
| Staged `FRONTIER_TASK_VOCABULARY` | 2,383 | 1,667 |
| Live `FRONTIER_TASK_VOCABULARY` | 4,768 | 4,047 |
| Live: all deterministic findings | 4,815 | 4,094 |

No other code rose and the content lint is unchanged. The live ratchet was
lowered, never raised.
