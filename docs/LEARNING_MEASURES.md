# Learning measures and the A1 pilot

This file states what Vajefy measures and which 150 entries the first fully
reviewed release covers. The measures are defined before any results exist, so
later changes cannot be tuned to the numbers. The percentage targets in the
roadmap are proposals, not measured Vajefy results.

## Principal measure

**Usable meanings at 30 days per active study hour.**

For each learner:

- *Numerator*: the number of target meanings that pass a **delayed check** at
  least 30 days after their first introduction. The check has two required
  parts, and both must be observed and correct:
  - **recall**: identify the Persian meaning from the English word using the
    same assessment format in both study arms;
  - **use**: answer a sentence-context item reserved from normal teaching and
    practice.
- *Denominator*: **active study time** in hours, from first introduction to the
  delayed check.

Rules:

- Each sense reserves its final authored check item for delayed assessment;
  normal lessons and practice do not use it.
- If a required held-out item is unavailable or has already been exposed, the
  measurement is recorded as **missing** and excluded from the completed-check
  denominator. It is never converted into a wrong learner answer or replaced by
  an easier task.
- *Active study time* counts only time the page was visible and the learner
  acted within the previous 60 seconds. Idle time over 60 seconds is not
  counted. Background tabs are not counted.
- A meaning that was reset, forgotten (removed from the data) or imported from a
  backup during the window is excluded. Exclusions are reported.

## Supporting measures

| Measure | Definition |
|---|---|
| Introduced | A meaning's first recorded exposure (teaching card, review or added to the schedule) |
| Remembered after a delay | A correct scheduled recall at least 1 day after the previous exposure to the meaning |
| Correct in context | A correct answer on a context, cloze or sentence-frame production item for the meaning; isolated spelling does not count |
| Listening comprehension | Correct share of listening items whose audio actually played, per meaning and overall |
| Production accuracy | Correct share of typed or written production items; a sample is reviewed by a person |
| Review burden | Scheduled reviews per day, per 100 known meanings, over the following 30 days |
| Lesson completion | Share of started sessions finished, including after a resume |
| First-session success | Share of new learners who complete their first session without assistance |
| Return | Share of learners who study again on days 1–2, 7 and 30 after the first session |

## Evidence that must be recorded

Every answer is an event with a unique id. Each event records:

- the meaning (entry id) and the skill tested;
- the prompt type and the content version;
- whether a hint, the answer or the audio was shown;
- whether the learner answered or skipped;
- the active response time in milliseconds.

History collected before a field existed is **unknown**, never zero.

- `docs/PROGRESS_STORAGE.md` describes the event store.
- `docs/SMART_PRACTICE.md` describes how the evidence is used.

## The A1 pilot

`content/pilot-a1.json` lists the first 150 A1 learning targets written, by
their stable entry IDs. It was the first authoring batch; the learning study
now measures the opening curriculum units instead
([EVALUATION.md](EVALUATION.md#the-studys-words)). `npm run validate:data` checks that every ID exists in A1, appears once and
belongs to a declared group. The groups are:

| Group | Entries | Why |
|---|---|---|
| Function words | 45 | Articles, pronouns, question words, modals and core prepositions, where Persian and English differ most |
| Verbs | 30 | High-utility verbs, chosen to include the contrast sets say/tell, speak/talk, see/look/watch, hear/listen, bring/take, come/go, make/do |
| Everyday vocabulary | 45 | Time, family, home, food, places and common adjectives |
| Ambiguous cases | 30 | Homographs, words with several meanings, words pronounced differently by part of speech, and homophones such as to/too/two |

Each entry may carry a short `why` note that records the teaching problem it was
chosen for. Phase 2 adds the content for each of these entries:

- sense-level meanings;
- grammar patterns;
- examples;
- collocations;
- usage distinctions;
- common mistakes;
- accent-specific audio;
- assessment items;
- an editorial record.

An entry counts as *released* only when its editorial record shows completed
bilingual review and approved pronunciation.

The pilot stays these 150 entries even as enhanced content grows across A1 in
later batches, so the study measures a fixed set.

The content now exists for all 150 entries and is compiled from `content/pilot/`.
None is released yet: every entry carries a visible draft label until a reviewer
approves it. See [PILOT_CONTENT.md](PILOT_CONTENT.md) for the editorial workflow
and [AUDIO.md](AUDIO.md) for the pronunciation library.

### Where the measures appear

**Progress → What you have learned** shows, from saved evidence only:

- words introduced;
- words remembered after a delay of at least one day, as a count and a share of
  the delayed reviews;
- words answered correctly in a context task (cloze, choice or sentence-frame produce); isolated spelling is reported separately;
- accuracy per skill, shown only once a skill has at least five answers.

`src/lib/learn/measures.ts` computes these from review events and practice
evidence. It never fills in a measure that has no recorded evidence.

The principal measure needs delayed evidence independent of normal teaching.
That is the 30-day check-up. Its context item is held out from teaching and
practice; missing required evidence is reported separately rather than scored
as wrong. Progress reports completed checks as "recalled and used correctly".
The pilot study's analysis divides usable meanings by active study time
([EVALUATION.md](EVALUATION.md)).

## Pilot study (Phase 5)

1. Five to eight observed usability sessions, with notes on where help was
   needed.
2. A learning pilot with 20–40 learners and a 30-day delayed follow-up. The
   comparison uses comparable vocabulary and the same study-time budget,
   between the current flow and the enhanced pilot flow.
3. The report covers feasibility and variability, with uncertainty intervals. A
   claim of greater effectiveness needs a properly sized comparison study.
