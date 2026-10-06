# Smart Practice

Smart Practice is available from Today and is the default selection on Practice (Learn → Practice).
The existing manual formats remain available. A session requests 10 or 20
questions and can be shorter when fewer studied words are eligible.
The default mobile layout keeps Start on the first screen. Manual formats sit
in a keyboard-accessible disclosure rather than preceding the session controls.

## Selection and question format

Only vocabulary already in the learner's schedule is eligible. Learning and
relearning cards, words due soon, and words practised very recently stay
outside optional practice.

Priority combines current FSRS retrievability, difficulty, accumulated lapses,
and observed drill mistakes. Older SM-2 cards use the same bridge employed by
the scheduler for memory estimates. Selection itself never changes a card.

## Policy

Every choice is configuration (`PracticePolicy` in `src/lib/learn/adaptive.ts`),
so each can be tested and changed on evidence. The defaults are product
heuristics, not claims of an experimentally optimal value:

| Setting | Default | Effect |
|---|---|---|
| `guardMs` | 6 hours | Words due within this time are left for Review |
| `cooldownMs` | 30 minutes | A practised word rests this long |
| `missHalfLifeMs` | 7 days | The extra weight of a word's latest miss halves over this time |
| `priorAttempts` | 2 | Successful answers assumed before any evidence |

A skill's weakness combines two parts:

- **Its miss rate, shrunk towards zero by `priorAttempts`.** One miss in one
  answer counts as a third, five misses in five as five sevenths, so a pattern
  outweighs a single slip.
- **Extra weight when the latest answer was a miss (or hard).** It gives a new
  mistake prompt support, fades with `missHalfLifeMs`, and disappears as soon as
  a later answer succeeds.

A skill with no answers scores zero: no evidence is not weakness.

The format targets the word's weaker observed skill when evidence exists. With
no weakness evidence, formats alternate between written spelling, listening
recognition, contextual choice, spelling, and meaning recognition. A context
that cannot form a valid question or a pool too small for choices falls back to
spelling. Browsers without speech synthesis receive no listening prompts.

## Evidence boundaries

The stored `practiceSkills` map holds attempts, accepted answers, last timestamp
and last grade independently for meaning, spelling, listening and context.
Near-correct spelling retains the `hard` grade, so an accepted typo can still
be selected for extra spelling practice. These counts describe drills, not
scheduled retention, and are never fed into FSRS as invented reviews.

Listening and Spelling, the two single-skill modes beside Smart Practice, also
label their question skill. Practice has only these three modes (plan §4);
Pairs, the sprint, meaning and cloze quizzes and the reference-deck drills were
removed. Older unlabelled aggregate attempts do not manufacture vocabulary
skill observations.
Each word has at most four skill aggregates; the map is bounded to the newest
6,000 words. Forget and reset remove corresponding evidence.

Correct practice preserves the saved schedule. A miss makes an existing word
due now, preserving FSRS stability/difficulty until a real Review answer updates
them. Review totals, the daily review goal, and scheduled review history remain
independent. Listening questions can be skipped when sound is unavailable;
skips generate no answer and are excluded from the result denominator.
Words without recorded audio still use the device's speech voices, which vary.

## Migration and verification

Progress schema v4 adds this map. Saves and backups from v0–v3 retain their
cards, due dates and retained review history, and gain empty skill evidence.
Export/import validates counts, grades and timestamps and bounds the map.

Unit coverage checks exclusion rules, recent-practice cooldown, weakest-skill
selection, unavailable-audio fallback, context fallback, storage bounds,
independent counters and backup migration. Browser coverage checks the home
entry point, actual answer submission, preservation of FSRS on success/miss,
Persian empty states, mobile accessibility, reload, export/reset/restore,
failed-load retry and ungraded listening skips.

## Follow-up work

This release does not tune FSRS parameters from incomplete legacy history or
claim personalized forgetting parameters. Personalised FSRS-6 and FSRS-7 are
compared offline against the active scheduler first ([EVALUATION.md](EVALUATION.md)).
The policy defaults above are candidates for the same kind of evaluation.
