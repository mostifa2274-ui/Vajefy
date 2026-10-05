# Learning evaluation and scheduler comparison

This is how Vajefy's learning quality is measured. Personalised scheduling,
FSRS-7 and the enhanced lessons each have to earn deployment with this
evidence. The measures themselves are defined in
[LEARNING_MEASURES.md](LEARNING_MEASURES.md).

## What the app records

Every answer is stored with the evidence needed to interpret it. Nothing
earlier than this release is reconstructed: missing fields in older records
stay unknown.

| Record | Contents |
|---|---|
| Review | Card, grade, time, prompt format, content version, active response time, the scheduler's outcome (elapsed and scheduled days, stability, difficulty) |
| Practice | Card, skill (meaning, spelling, listening, context), grade, prompt and prompt id, content version, response time; `hint` when a hint or the answer had been shown, for example a lesson retry after feedback |
| Skip | A question that could not be answered (unheard audio): no credit, no penalty |
| Exposure | Hearing a word or example, opening a word's detail, reading a reference note (at most once per item and kind in ten minutes) |
| Assessment | A 30-day check-up answer: part (use or meaning), correct, days since first met, exact prompt id when observed, and the entry content version. It changes nothing else |
| Undo | Which answer was withdrawn; the undone answer is marked |

All records stay on the device in IndexedDB until the learner exports them.

## The 30-day check-up

Learn offers a check-up once at least three enhanced words were first met 30
or more days ago and have not been checked in the last 30 days. Today links to
it. Up to ten words are checked:

1. **Use:** for each word, a sentence item (produce, cloze or choice) reserved
   from normal teaching and practice. The final authored sense check is the
   held-out item. If it is unavailable or was already exposed, the use
   measurement is recorded as **missing**; it is never replaced by an easier
   recognition question.
2. **Meaning:** then recognising each word's Persian meaning, among new
   distractors. Both study arms use this same format.

Use comes first, so the meaning question cannot cue it. A word counts as
*recalled and used* only when both required parts were observed and both were
right. Missing held-out evidence is reported separately and excluded from the
denominator rather than treated as a learner error. The result appears at the
end and on Progress. Check-up answers are assessments only: they never change a
due date, skill evidence, counts or XP, and a wrong answer gets no retry.

### Version-bound assessment bank

Researchers can inspect or freeze the exact held-out **use** bank without
running a learner session:

```sh
npm run content:assessment-bank
npm run content:assessment-bank -- --scope pilot --json > pilot-assessment-bank.json
npm run content:assessment-bank -- --unit 08-work-study --json
npm run content:assessment-bank -- --scope all-a1 --check
```

For every selected A1 sense, the bank records the entry and content version,
curriculum unit, the teaching-check ids, the final authored check reserved from
normal teaching/practice, and a version-bound assessment token of the form
`entry@version/sense/check`. The JSON includes the full held-out item so a
research protocol can archive exactly what was intended to be administered.

The bank follows curriculum order for all-A1 and unit scopes, the original
pilot selection for `pilot`, and the fixed calibration order for
`calibration`. The all-A1 `--check` gate is part of normal
`validate:data`; CI therefore fails if curriculum membership drifts or any
current A1 sense loses a reservable third authored check.

The compiled enhanced catalogue also publishes a `pilotSelection` provenance
record: manifest version, ordered entry count and fingerprint. The fingerprint
covers the ordered pilot ids and study groups and is included in the overall
`contentVersion`. This makes selection drift fail closed through the same
version checks already used by the assessment bank, pilot roster and exported
study data. Archive `content/pilot-a1.json` together with the roster and
assessment-bank export for an independently inspectable study record.


This manifest is **arm-invariant**: both pilot arms use the same reserved
held-out source for the delayed use measure. It does not generate replacement
questions. If the reserved item is unavailable or has already been exposed, the
app records the use part as missing, exactly as described above. Exporting the
bank is read-only and is not bilingual/pronunciation approval, release evidence,
or evidence that the assessment has been administered to a learner.

## The pilot study

1. **Usability sessions.** Five to eight observed sessions with Persian-speaking
   learners: onboarding, a first lesson, a review, the Words page. Note where
   help was needed. The release target is that at least 90% of pilot users
   complete their first session without assistance.
2. **Learning pilot.** 20–40 learners for at least 30 days, assigned to two
   arms with the same daily time setting. Before enrollment, create opaque
   participant codes (no names/contact details in the file), put one code per
   line in `participants.txt`, and freeze the allocation:

   ```sh
   npm run study:roster -- \
     --participants participants.txt \
     --seed "<private random seed>" \
     --enhanced-channel draft \
     --minutes 15 \
     --out pilot-roster.json

   # Later, prove that the archived seed regenerates the same assignment identity.
   npm run study:roster -- --check pilot-roster.json --seed "<private random seed>"
   ```

   The manifest stores only a memory-hard scrypt fingerprint of the seed, never
   the raw seed. Use a high-entropy random seed and archive it separately from
   the roster and participant identity key. Assignment is deterministic and
   balanced to within one learner, so the same participant-code list plus seed
   always yields the same arms.

   | Arm | Build | What learners get |
   |---|---|---|
   | Enhanced | `VITE_CONTENT_CHANNEL=draft` (or `released` once reviewed) | Guided lessons for the pilot words |
   | Comparison | `VITE_CONTENT_CHANNEL=none` | The current flow: the same pilot words, introduced in Review, in the same order, with the original cards |

   The roster freezes the enhanced channel, content/assessment-bank version,
   delayed-assessment protocol, and daily minutes. Both arms use the same
   scheduler and the same check-up. Vocabulary is comparable because both meet
   the 150 pilot words. Compare on the first sense of each word, which both arms
   learn. The enhanced arm also learns further senses (`#` ids).
3. **Follow-up.** After 30 days, each learner completes the check-up, then
   exports their data: Progress → **Take part in the study**, with the
   participant code the researchers issued. Written answers are included only
   when the learner ticks the box. Have a reviewer judge a sample of these
   productive answers by hand.

The export holds no name or contact details, and Vajefy sends nothing by
itself. Keep the code-to-person key apart from the data, and delete exports
when the study ends.

Study exports are schema-versioned. Version 2 records the deployment build,
the whole-content/assessment-bank version, the content channel (study arm), and
the delayed-assessment protocol id. The app refuses to create a study file if
the content/bank version cannot be loaded. Each observed use assessment also
carries the entry content version plus the exact `sense/check` prompt id, so
researchers can reconcile exported evidence to the frozen assessment bank.

## Analysis

```sh
npm run evaluate -- path/to/exports/ --roster pilot-roster.json --out report.md
npm run evaluate -- --simulate 6      # synthetic learners, to check the method
# Exploratory only, when intentionally stratifying incompatible protocol files:
npm run evaluate -- path/to/exports/ --allow-mixed-protocols
```

Before pooling study exports, `scripts/evaluate-schedulers.ts` now validates
protocol integrity. Duplicate participant codes, unknown/future export schemas,
missing content-bank versions, malformed v2 held-out provenance, and mixed
content/assessment protocols fail closed. The intended comparison and enhanced
arms may differ by channel, but they must share the same content and assessment
protocol. Mixing `draft` and `released` enhanced variants also fails by
default. Deployment build ids are reported so code changes during a pilot stay
visible. `--allow-mixed-protocols` exists only for explicitly exploratory,
stratified analysis and prints a warning in the report.

When `--roster` is supplied, analysis also rejects unknown participant codes,
wrong-arm content channels, a different content/assessment-bank version,
different delayed-assessment protocol, or a different daily-time setting. A
rostered participant with no export is **not** treated as invalid evidence:
the report counts that absence separately by arm so attrition remains visible
instead of being silently dropped.

For each learner, `scripts/evaluate-schedulers.ts`:

- **Splits by time.** Reviews before the 70% time cut-off are history; only
  later reviews are judged. They must also fall on a later calendar day than
  the card's previous review, the same reviews for every model.
- **Compares memory models** on those reviews:

  | Model | Notes |
  |---|---|
  | Average recall | No memory model: the recall rate before the cut-off. A floor for calibration |
  | FSRS-6, default | The active scheduler |
  | FSRS-6, personalised | Weights fitted to the learner's reviews before the cut-off (at least 100), pulled towards the defaults |
  | FSRS-7, default | Shadow only, from ts-fsrs 6.0 beta (a port of fsrs-rs), with fractional days |

- **Reports per model:**
  - log loss (overall prediction quality);
  - calibration error, as RMSE over 20 bins of predicted recall;
  - AUC (whether recalled reviews were predicted higher);
  - a calibration table;
  - a workload projection: reviews a day over the next 30 days at 90%
    retention, if every review succeeds.
- **Groups learners** by history (under 100, 100–999, 1,000+ reviews), because
  limited history is where defaults and personalisation differ most.
- **States uncertainty.** Per-learner log-loss differences from the active
  scheduler, and the principal measure per arm and between arms, are given with
  95% bootstrap intervals over learners.

**Shadow scheduling.** The experimental models never set a due date. Instead,
the analysis replays each learner's complete review log. The models are
deterministic functions of that log, so this gives exactly the recommendations
they would have recorded running live, without shipping experimental code to
learners' phones.

**Checking the method.** Simulated learners forget according to a known model
(`src/lib/learn/eval/simulate.ts`). A unit test confirms that a model fitted to
a learner who forgets faster than FSRS-6 assumes predicts their later reviews
better, in log loss and calibration, than the defaults. It also projects the
higher workload such a learner really needs. Simulated results check the
analysis; they are never evidence about learners.

## Decision rules

These are proposals, to be agreed before the pilot data are seen:

- **Personalised FSRS-6** replaces the defaults for learners with enough
  history only if all of these hold:
  - on later reviews its log loss and calibration error are lower for most
    learners;
  - the 95% interval of the mean log-loss difference lies below zero;
  - delayed recall in the check-up is not worse;
  - projected daily reviews rise by no more than a stated amount, for example
    15%.
- **FSRS-7** follows the same rule, and also needs a stable (non-beta)
  implementation.
- **The enhanced lessons** are judged by the principal measure: words recalled
  and used after 30 days per active study hour, enhanced against comparison,
  with its interval. The roadmap's initial target is a 15% improvement. A pilot
  of this size establishes feasibility and variability; a claim of greater
  effectiveness needs an adequately sized comparison study.

## Limitations

- Active study time is the sum of measured response times. It leaves out time
  spent reading teaching cards between answers, so it is a lower bound.
- The check-up's meaning question uses multiple choice, which overstates
  recall compared with free recall. Its use question is the stricter one.
- Review grades are the learner's own judgement, and FSRS fits those grades,
  not an external test.
- The Smart Practice policy (guard, cooldown, half-life, prior) is not yet
  evaluated. Its settings are configuration so that it can be
  ([SMART_PRACTICE.md](SMART_PRACTICE.md#policy)).
