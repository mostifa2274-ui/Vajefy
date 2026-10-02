# Learning measures and the A1 pilot

This file states what Vajefy measures and which 150 entries the first fully
reviewed release covers. The measures are defined before any results exist, so
later changes cannot be tuned to the numbers. The percentage targets in the
roadmap are proposals, not measured Vajefy results.

## Principal measure

**Usable meanings at 30 days per active study hour.**

For each learner:

- *Numerator*: the number of target meanings that pass a **delayed check** at
  least 30 days after their first introduction. The check has two parts, and
  both must be correct:
  - **recall**: give the meaning from the English word, using a fresh prompt the
    learner has not seen for that meaning;
  - **use**: choose or produce the word correctly in a new sentence context.
- *Denominator*: **active study time** in hours, from first introduction to the
  delayed check.

Rules:

- A prompt is *fresh* when that prompt, at its content version, never appeared
  in the learner's review or practice for that meaning.
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
| Used successfully | A correct answer on a context, cloze or production item for the meaning |
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

`content/pilot-a1.json` lists the 150 A1 learning targets, by their stable entry
IDs. `npm run validate:data` checks that every ID exists in A1, appears once and
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

## Pilot study (Phase 5)

1. Five to eight observed usability sessions, with notes on where help was
   needed.
2. A learning pilot with 20–40 learners and a 30-day delayed follow-up. The
   comparison uses comparable vocabulary and the same study-time budget,
   between the current flow and the enhanced pilot flow.
3. The report covers feasibility and variability, with uncertainty intervals. A
   claim of greater effectiveness needs a properly sized comparison study.
