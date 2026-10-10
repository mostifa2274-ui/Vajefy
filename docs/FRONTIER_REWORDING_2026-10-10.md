# Later-unit frontier task rewording — 2026-10-10

A task may use only words the learner has met by that point in the course
(`FRONTIER_TASK_VOCABULARY`, `FRONTIER_SCENE_VOCABULARY`). Earlier passes
promoted words where the order allowed it and added Persian support glosses.
After those passes, 34 later-unit tasks remained in the triage queue
(`npm run assurance:frontier:triage`):

- 32 marked "requires rewording or review". In most of them the unknown word
  is the answer or one option, so a gloss would give the answer away.
- 2 deferred gloss candidates (*hardly* and *pick up*), where a gloss could
  replace the point being tested.

Claude Code reworded all 34 in this session, recorded as generator
`claude-code-2026-10-10-frontier-rewording`. They have no independent semantic
certificate.

## Method

Each task keeps its id and type. Where possible, it tests the same point with
words taught by its frontier, which is the target's place in
`content/curriculum/A1.json`. Some examples:

| Task | Before | After |
|---|---|---|
| *stop* q1 | The baby didn't stop *crying* all night. | Stop *eating* chocolate before dinner. |
| *bread* q1 | I'd like *a loaf of bread*, please. | I want some *bread* with my tea. |
| *soup* q1 | This soup is too *salty*. | I want some *salt* in my soup. |
| *river* q1 | We walked *along* the river for an hour. | There are a lot of fish in this *river*. |
| *policeman* q1 | three *policemen* | *one policeman* |
| *present* (×3) | PRE-sent / pre-SENT | PREsent / preSENT |

- **Reasons and meanings in Persian.** When an option only gives a reason or a
  meaning, it is now Persian, for example "لازم نیست چاپش کنی" for
  *You don't have to print it*. This covers six tasks: *hard* (adverb), and the
  in-class, team-meeting, morning-routine and my-family scene tasks. Those
  options contain no Latin text, so they render right-to-left without mixed
  runs.
- **Non-A1 answers.** Ordinals (*seventh*, *eighth*, *ninth*), *passed*,
  *catch*, *changed my mind* and *worse* are not A1 entries. Those tasks now
  test the target word itself:
  - the numbers through their digit, with *ate* as the homophone of *eight*;
  - *an exam*;
  - *have a cold*;
  - *change rooms*, alongside the existing *change trains*;
  - *bad* after *be*.
- **Bank.** The *bank* (money) choice no longer contrasts senses, because the
  river-bank and aircraft senses need words not yet taught. It now tests *bank*
  against *shop* and *market*.
- **Distractors.** Wrong forms that are not A1 words (*tiring*, *successful*,
  *policemen*, *either*) remain as distractors, which the check allows. Their
  Persian reasons still explain the contrast.
- **Hedged reasons.** Before applying, the reasons were checked for absolute
  claims, the fault review found in #194–#198. *too* "usually" comes last.
  *lay* for *lie* is non-standard rather than impossible. *tiring* describes
  what makes someone tired.

The *present* (verb) prompt gained the same *stress* support gloss as its noun
twin, because its old option "no stress" had excused the word.

## Effect

| Finding | Before | After |
|---|---:|---:|
| Task frontier | 4,966 | 4,897 |
| Scene frontier | 59 | 47 |
| Triage queue | 105 | 71 |
| Triage gloss candidates | 2 | 0 |
| Triage needing rewording or review | 32 | 0 |
| All deterministic findings | 6,721 | 6,640 |

No other finding code rose, and the baseline was lowered to these counts. The
71 cases left in the triage queue are all in the frozen Units 1–3 roster. The
remaining 4,897 task findings come from core words (*to*, *at*, *on*, *can*,
*good* …) that the curriculum places after the tasks that use them. Clearing
them needs promotion into the frozen roster, which is an owner decision on the
study and audio scope.

None of the 180 frozen Units 1–3 entries changed. Audio, curriculum and scene
lines are unchanged; only scene tasks changed. The following were regenerated:

- compiled content;
- coach cases;
- agent provenance for 25 entries;
- the hashed public chunk names in the rights lineage, which keep their
  UNVERIFIED source;
- the authorship map;
- the assurance records.

Gate 0 remains BLOCKED. This is deterministic coverage, not a linguistic
review.
