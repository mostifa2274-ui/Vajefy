# Support glosses for Units 4–12 tasks, 2026-10-13

After the Units 2–3 glosses (`docs/UNITS_2_3_SUPPORT_GLOSSES_2026-10-13.md`),
most frontier findings left were in Units 4–12: tasks that use a word taught
later. Earlier passes left these to curriculum promotion, because moving a word
earlier fixes every task that uses it. The staged CEFR-J curriculum has now
made its promotions (`docs/CEFRJ_CORE_WORD_PROMOTIONS_2026-10-13.md`), so the
findings that remain under both orders will not be fixed by ordering.

Claude Code added 899 Persian support glosses to 701 Unit 4–12 tasks (443
senses in 395 entries), recorded as generator
`claude-code-2026-10-13-units-4-12-support-glosses`. Unit 1, task text,
answers, options, examples, curriculum and audio are unchanged. The glosses
have no independent Persian or semantic certificate.

## How the worklist was chosen

A finding is on the worklist only if it is a task finding under both the live
curriculum and the staged CEFR-J curriculum. A word that either order already
teaches before the task gets no gloss, so the glosses help the live course now
and stay useful if the owner adopts the CEFR-J order. Every gloss passes
`taskSupportIssues`: the word is visible in the task, it appears in all choice
options or none, and it never contains an answer.

| Unit | Glosses |
|---|---:|
| 4 | 209 |
| 5 | 126 |
| 6 | 155 |
| 7 | 103 |
| 8 | 97 |
| 9 | 84 |
| 10 | 67 |
| 11 | 34 |
| 12 | 24 |

## What was not glossed

- **Function words** (*so, by, than, all, if, any, would, as, some, or, into,
  through*, and *get/gets/got*), as in Units 2–3. A bare Persian gloss teaches
  these poorly; their order is the remedy.
- **Phrasal particles** (*back, off, out, away*), where a gloss would
  translate the tested phrase.
- **Five verbs whose gloss would give the answer away:** *lie ___* (*down*),
  *take ___ your shoes* (*off*), *Put ___ your coat* (*on*), *I'm getting ___*
  (*dressed*) and *wears ___ for reading* (*glasses*).
- **205 findings where the word is in some choice options but not all.** A
  gloss there could point to an option, so these need rewording or a
  curriculum change.

In all, 130 occurrences on the worklist were skipped.

## Meaning in context

A word takes its meaning from the task:

- *hot* is «گرم» for the weather but «داغ» for soup, tea, a shower or chocolate.
- *light* is «نور» in *Plants need water and light*, «چراغ» in *turn on the
  light* and «چراغ راهنمایی» at a red light.
- *floor* is «طبقه» in *the fourth floor* but «کفِ زمین» in *on the floor*.
- *number* is «شماره» for a phone, «عدد» for *the number 2* and «تعداد» in *a
  large number of*.
- *kind* is «نوع» in *What kind of* but «لطف» in *That's kind of you*.
- *true* is «واقعی» in *a true story* and «راست» in *It's true!*.
- Times take «ساعت»: *at eight* is «ساعت هشت».

Phrases are glossed whole: *post office*, *bus stop*, *orange juice*, *red
meat*, *a lot of*, *How many*, *the most*, *Which one*, *Thank you*, *Don't
forget*, *grew up*, *finds out*, *filled in*, *throw away*, *go bad*, *Take off*
and *Put on* (the last two only where the particle is not the answer).

Past-tense verbs take the task's person: *I bought* is «خریدم» and *We bought*
«خریدیم»; *I broke your cup* is «شکستم» and *He broke his arm* «شکست»; *We
met a nice family* is «آشنا شدیم» but *I met an old friend* «دیدم». Other verbs
use a person-free infinitive (*put* «گذاشتن», *speak* «صحبت کردن») unless the
task fixes the form.

## Result

| Measured result | Before | After |
|---|---:|---:|
| Live `FRONTIER_TASK_VOCABULARY` | 4,046 | 3,130 |
| Live: all deterministic findings | 4,093 | 3,177 |
| Staged `FRONTIER_TASK_VOCABULARY` | 1,666 | 762 |

The live count falls by more than the number of glosses because one gloss can
clear a word that a task uses twice. No other code rose and the content lint is
unchanged. The live ratchet was lowered, never raised.
