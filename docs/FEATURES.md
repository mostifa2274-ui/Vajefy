# Feature ledger

Every shipped feature, what it is for, how we would know it works, and when it
should go (plan §30 of [AUTONOMOUS_ASSURANCE_PLAN.md](AUTONOMOUS_ASSURANCE_PLAN.md)).
A feature that cannot name a success measure and a removal condition is not
added. Deleting a feature whose measures show no value is a good outcome.

The measures below name signals the app already records, or the pilot will
record (see [LEARNING_MEASURES.md](LEARNING_MEASURES.md)). They give no numeric
thresholds: thresholds are frozen with the pilot protocol before results are
seen, not here.

Statuses:

- **ACTIVE**: in the A1 product.
- **FROZEN**: kept working, with no new work until the A1 completion gate.
- **OFF**: shipped, but disabled unless explicitly turned on.

`npm run features:check` runs in `validate:data`. It checks that every row has
each field, that every path exists, and that every screen in `src/routes/`
belongs to a feature.

<!-- feature-ledger:start -->
| Feature | Paths | Learning purpose | Success measure | Remove or redesign if | Depends on | Last review | Status |
|---|---|---|---|---|---|---|---|
| Today | `src/routes/index.tsx`; `src/lib/learn/planner.ts` | One next action from the daily plan, so a learner never has to decide what to study | Share of active days on which the planned reviews and lessons are finished | Learners who open Today finish their plan no more often than learners who go straight to Learn or Review | Planner, progress store | 2026-10-06 | ACTIVE |
| Onboarding | `src/components/onboard.tsx` | A learning goal and a daily time that set the plan; every new learner starts A1 | Share of new learners who finish a first lesson on day one | Onboarding is where most new learners stop before any lesson | Planner | 2026-10-06 | ACTIVE |
| Lessons | `src/routes/learn.tsx`; `src/components/lesson-run.tsx`; `src/lib/learn/lesson.ts` | Teach each word, then written retrieval, listening, context and delayed retrieval, in curriculum order | Unaided delayed recall of taught words at the 30-day check-up | Words taught in lessons are recalled no better than words met only in Review | Curriculum, enhanced content, audio | 2026-10-06 | ACTIVE |
| Scenes | `src/routes/learn.tsx`; `src/components/lesson-run.tsx`; `content/pilot/scenes.json` | Meet taught words again in a short dialogue or passage | Accuracy on scene comprehension tasks for words taught earlier | Scene tasks test only recognition of the taught word, or learners skip them | Lessons, curriculum frontier check | 2026-10-06 | ACTIVE |
| Review | `src/routes/study.tsx`; `src/components/study-session.tsx`; `src/lib/learn/ops.ts` | FSRS-6 scheduled retrieval, the only thing that moves a word's schedule | Measured retention against the requested retention | Measured retention stays well below the requested retention after the scheduler has enough history | Progress store, FSRS-6 | 2026-10-06 | ACTIVE |
| Practice | `src/routes/drill.tsx`; `src/components/quiz-run.tsx`; `src/lib/learn/adaptive.ts`; `src/lib/learn/quiz.ts` | Extra practice of studied words: Smart Practice picks the weak skill; Listening and Spelling practise one | Change in per-skill accuracy for practised words at their next Review | Practised words do no better at their next Review than unpractised words | Progress store, per-skill evidence | 2026-10-06 | ACTIVE |
| 30-day check-up | `src/lib/learn/lesson.ts`; `src/lib/learn/measures.ts` | Held-out recall of words learned about a month earlier | Completion rate, and unaided recall it reports | Learners rarely take it, so it measures nothing | Lessons, held-out assessment bank | 2026-10-06 | ACTIVE |
| Speaking practice | `src/components/say-it.tsx`; `src/lib/learn/speech.ts` | Record and compare with the model; no automatic score | Share of lesson words where learners record and replay | Learners almost never use it | Microphone, audio | 2026-10-06 | ACTIVE |
| Words | `src/routes/lexicon.tsx`; `src/components/labeled-words.tsx` | Look up a word and its teaching; A1 by default | Lookups that lead to a word being added or reviewed | It is rarely opened, or only to browse other levels | Level lexicons, enhanced content | 2026-10-06 | ACTIVE |
| Progress | `src/routes/progress.tsx`; `src/components/progress-extras.tsx` | Honest progress: readiness apart from long-term mastery, plus backup and the study export | Learners who see the summary keep their streak at least as well as others | It shows numbers learners misread as mastery | Progress store, measures | 2026-10-06 | ACTIVE |
| Streak | `src/lib/learn/store.ts`; `src/components/shell.tsx` | One light motivational signal (plan §4) | Return rate on the day after a streak day | Streak pressure goes with skipped Reviews or shallow sessions | Progress store | 2026-10-06 | ACTIVE |
| Offline and audio pack | `public/sw.js`; `src/lib/learn/audio-pack.ts` | Study without a connection; the A1 course installs first | Sessions that start offline and save without loss | Offline updates leave learners on broken or partial releases | Service worker, R2 audio | 2026-10-06 | ACTIVE |
| Save protection and recovery | `src/lib/learn/persistence.ts`; `src/lib/learn/journal.ts`; `src/components/recovery-screen.tsx`; `src/components/save-notice.tsx` | No answer or schedule is silently lost | Failed writes that are later saved exactly once | Never: learner records must stay protected | IndexedDB | 2026-10-06 | ACTIVE |
| Backup export and import | `src/lib/learn/backup.ts`; `src/lib/learn/backup-file.ts` | A learner owns and can move their progress | Restores that reproduce the exported progress | Never, while progress is local-only | Progress store | 2026-10-06 | ACTIVE |
| Study export | `src/lib/learn/study.ts`; `src/lib/learn/study-protocol.ts` | Pseudonymous pilot data with protocol provenance | Exports accepted by the analysis without manual repair | The pilot protocol no longer needs it | Measures, pilot roster | 2026-10-06 | ACTIVE |
| Library | `src/routes/library.tsx`; `src/lib/learn/faces.ts` | Reference decks: irregular verbs, phrasal verbs, collocations and others | Deck items added to Review that are then retained | Frozen until the A1 completion gate; reduce to material linked from A1 (P1-CHUNK-DECKS) | Reference decks | 2026-10-06 | FROZEN |
| Coach | `src/components/coach-panel.tsx`; `src/lib/coach.ts` | AI explanations of a learner's answer | Not measured: off | Plan §4 keeps it off; not needed for A1 mastery | `COACH=on`, model key, rate limiter | 2026-10-06 | OFF |
| Sync | `src/components/sync-panel.tsx`; `src/lib/learn/sync.ts` | Encrypted sync between devices | Not measured: off | Removed from the A1 roadmap (plan §4); needs atomic epoch checks before it is enabled | `SYNC=on`, database | 2026-10-06 | OFF |
| Error reporting | `src/lib/telemetry.ts`; `src/lib/error-component.tsx` | Opt-in reports tagged with the deployed revision | Reports that lead to a fix | Reports carry no actionable information | Opt-in consent | 2026-10-06 | ACTIVE |
<!-- feature-ledger:end -->
