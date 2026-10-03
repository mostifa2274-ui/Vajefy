# Smart Practice

Smart Practice is available from Today and is the default selection on Practice (Learn → Practice).
The existing manual formats remain available. A session requests 10 or 20
questions and can be shorter when fewer studied words are eligible.
The default mobile layout keeps Start on the first screen. Manual formats sit
in a keyboard-accessible disclosure rather than preceding the session controls.

## Selection and question format

Only vocabulary already in the learner's schedule is eligible. Learning and
relearning cards, words due within six hours, and words practised during the
last 30 minutes stay outside optional practice. The time guard and cooldown are
product heuristics; they are not claims of an experimentally optimal interval.

Priority combines current FSRS retrievability, difficulty, accumulated lapses,
and observed drill mistakes. Older SM-2 cards use the same bridge employed by
the scheduler for memory estimates. Selection itself never changes a card.

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

Manual vocabulary quizzes also label their actual question skill. Pairs records
meaning recognition; the sprint records spelling. Reference drills and older
unlabelled aggregate attempts do not manufacture vocabulary skill observations.
Each word has at most four skill aggregates; the map is bounded to the newest
6,000 words. Forget and reset remove corresponding evidence.

Correct practice preserves the saved schedule. A miss makes an existing word
due now, preserving FSRS stability/difficulty until a real Review answer updates
them. Review totals, the daily review goal, and scheduled review history remain
independent. Listening questions can be skipped when sound is unavailable;
skips generate no answer or XP and are excluded from the result denominator.
Pronunciation still uses installed system voices and can vary by device.

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
claim personalized forgetting parameters. Prospective review evidence remains
available for a separately validated optimizer. Controlled pronunciation assets,
optional account synchronization and larger durable local storage remain
separate product improvements.
