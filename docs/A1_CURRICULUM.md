# A1 curriculum and calibration slice

Vajefy develops A1 before higher levels. This file is the curriculum control
document for that work. It separates **what is machine-ready** from **what has
actually been reviewed by people**.

The canonical machine-readable manifest is `content/curriculum/A1.json`.
`npm run curriculum:status` validates it against the current A1 plan,
enhanced content, held-out assessment requirements and audio. Use
`npm run curriculum:json` when an editor needs the full live coverage matrix.

## Curriculum units

The A1 course is being organized around practical beginner situations rather
than around the source dataset's batch boundaries:

1. Introductions and personal information
2. Family and home
3. Daily routine and time
4. Food and drink
5. Shopping and money
6. Places and directions
7. Travel and transport
8. Work and study
9. Leisure and people
10. Weather and clothes
11. Health and feelings
12. Help and everyday problems

Unit 1 remains the fixed 20-entry calibration package. Units 2–4 now each
have a 20-entry **mapped** sequence, while their status remains `planned`:
mapping establishes curriculum order and prerequisites but does not mean the
content has passed bilingual/pronunciation review or is released. Units 5–12
remain planned and unassigned.

The manifest carries an `assignedMinimum` coverage ratchet. It is now set to
80, so CI prevents total mapped A1 coverage from silently falling below the
current four-unit baseline. It protects the count, not exact unit membership;
the other 820 entries remain a visible curriculum backlog, not silently treated
as complete.

### Unit 2 — Family and home

The mapped sequence is:

`the`, `that`, `she`, `it`, `we`, `they`, `and`, `have`,
`with`, `of`, `mother`, `father`, `child`, `home`, `house`,
`room`, `big`, `small`, `old`, `new`.

Core function words are placed here because they are needed to form useful
family/home language, not because batch order is being preserved.

### Unit 3 — Daily routine and time

The mapped sequence is:

`time`, `day`, `morning`, `afternoon`, `evening`, `night`,
`today`, `every`, `always`, `usually`, `sometimes`, `never`,
`before`, `after`, `start`, `finish`, `early`, `late`,
`wake`, `sleep`.

This unit deliberately combines time vocabulary with frequency language and a
small set of routine verbs. It is designed to support beginner present-time
routines before later units add food, work/study, travel, and other domains.
Prerequisites reuse foundations already mapped in Units 1–2 and earlier targets
inside Unit 3; no forward prerequisite is permitted.

### Unit 4 — Food and drink

The mapped sequence is:

`food`, `water`, `eat`, `drink`, `want`, `some`,
`tea`, `coffee`, `milk`, `bread`, `rice`, `fruit`,
`apple`, `breakfast`, `lunch`, `dinner`, `hungry`,
`thirsty`, `restaurant`, `menu`.

This unit is deliberately functional rather than encyclopedic. It begins with
food/drink actions and requests, adds common staples and meal words, and ends
with hunger/thirst plus restaurant language. Broader food nouns and more
count/mass grammar remain available for later recycling instead of crowding the
first Food & Drink unit.

## First 20-entry calibration slice

The first slice is a coherent introductions/personal-information unit:

`I`, `you`, `a/an`, `be`, `my`, `your`, `name`, `what`,
`this`, `he`, `who`, `where`, `from`, `in`, `school`, `city`,
`live`, `family`, `friend`, `how`.

This is a calibration slice, not a claim that these 20 entries have passed
editorial review. CI requires every sense in this slice to have:

- current enhanced teaching content;
- at least three authored checks, leaving two opportunities for normal learning
  and one prompt reserved for delayed assessment;
- complete current word/example audio in both supported accents;
- valid prerequisite references that appear earlier in the curriculum.

`content/calibration/a1-20.json` adds reviewer-facing sections, teaching
objectives, patterns and recycling for this exact sequence. The calibration
gate rejects any different membership or order and always reads prerequisites
from this canonical curriculum manifest.

Human review remains separate. No script may create a bilingual or pronunciation
approval by inference.

### Why `that` is not in the slice

`that` would fit the topic, but its current A1 senses have only two authored
checks each. The delayed-assessment rule reserves the last authored check, so
using it in this calibration slice would lower the standard or force normal
lessons to rely on generated fallback items. `he` is used instead until
`that` is strengthened.

## Prerequisites

Each assigned entry lists explicit prerequisite entry IDs. A prerequisite must
already occur earlier in the **full curriculum sequence**: it may come from a
previous unit or from an earlier position in the same unit. Forward and cyclic
dependencies therefore fail CI. This is necessary once a real multi-unit A1
course reuses foundations such as `be`, `my`, `in`, and `friend`.

These links describe the intended teaching sequence; they do not claim that
every word appearing in every example has already been mastered.

A text/task dependency audit is now part of the calibration tooling. It scans
learner-facing English in grammar patterns, examples, collocations, mistake
corrections and authored checks, resolves common contractions and inflections,
and reports any dependency that is not yet available at that point in the
20-entry sequence. Future-in-slice A1 words, A1 words outside the slice,
unresolved external tokens and proper-name candidates remain visible in the
review packet.

The optional strict gate `npm run content:calibration:language` fails until
each unresolved dependency is rewritten away or explicitly documented with a
rationale. This prepares editorial cleanup; it never creates human approval.

For this gate, “unresolved” follows the learner-visible UI. English examples,
grammar patterns, calibration collocations, and the wrong/right mistake
sentences count as paired scaffolds only when the corresponding Persian support
is actually rendered beside them. The audit reports those dependencies
separately from already-introduced vocabulary and authored-task support.

The 20-entry calibration slice now has complete visible pairing for these
teaching fields and zero unresolved learner-language dependencies, so the
strict language gate is part of normal `validate:data`. A paired scaffold is
still only a visibility fact, not evidence that a bilingual reviewer has
approved the wording.

## Coverage matrix

The coverage matrix is computed from live repository data instead of being
hand-maintained:

```sh
npm run curriculum:status
npm run curriculum:json
```

For every one of the 900 planned A1 entries it reports:

- batch and assigned curriculum unit;
- whether enhanced content exists;
- number of enhanced senses;
- whether every sense has enough checks to reserve a held-out item;
- whether current GB and US audio is complete;
- whether audio has been flagged for human listening;
- whether the current content version is released.

The JSON report also includes one `senseCoverage` row for every current A1
sense. Each row links the sense to:

- its curriculum unit and one-based unit, entry and full-sequence introduction
  positions, or an explicit `null` when it has not been introduced;
- the entry prerequisites declared by the curriculum and the grammar patterns
  authored for that sense;
- exact GB/US word and example-clip availability plus any automated flag that
  still requires human listening;
- the normal lesson checks, productive-practice presence, scenes and contrasts;
- later-recycling candidates through a scene or contrast when that resource
  also targets a sense introduced later in the current curriculum sequence;
- the final authored check reserved for delayed assessment, separately from
  normal lesson opportunities;
- the exact content version, release flag and recorded review state;
- explicit evidence gaps such as incomplete audio, too few checks, missing
  contextual/later practice or an unrecorded human review.

Scenes and contrasts have no curriculum schedule, so a candidate does not claim
that the resource is actually delivered later. The manifest and review records
are entry-scoped, so every sense row inherits its entry's introduction position
and review object; the matrix does not create sense-specific approval. Grammar
patterns are exposed as authored teaching evidence, not inferred mastery.
Likewise, a complete audio file set is not a pronunciation approval, a scene
link is not proof that recycling was effective, and a structurally reserved
check is not learner-outcome evidence. The report carries these boundaries in
`evidenceBoundary` and copies only explicit review state from compiled content.

The status command summarizes sense evidence for the currently introduced
curriculum while the JSON form retains all unassigned senses and their gaps.
This lets editors decide what to strengthen before mapping or activating later
units without silently treating the remaining backlog as ready.

`npm run curriculum:complete` is intentionally stricter and fails until all
900 entries are assigned. It is a future Stage 3/5 completion gate, not a
current CI requirement. Normal CI still enforces `assignedMinimum`, which is
the monotonic partial-coverage ratchet used while the syllabus expands.

## Human review queue

The 20 calibration entries must be reviewed as a complete slice before this
standard is scaled. Follow `docs/PILOT_CONTENT.md#reviewing` and record real
reviewer decisions in `content/pilot/review.json`.

Current automated audio flags inside this slice include `a/an` and
`family`. These flags require listening; they are not automatically
pronunciation failures and must not be converted into approvals or rejections
without a reviewer.

For each entry, the reviewer should verify:

- the exact Persian meaning of every A1 sense;
- natural A1 English examples and faithful Persian translations;
- useful, genuinely incorrect mistake examples;
- grammar patterns, collocations and accepted answers;
- the reserved delayed-assessment item is independent of teaching examples;
- British and American IPA;
- word and example clips in both accents, including every flagged clip.

After a real review, use `npm run content:approve` with the reviewer's actual
name and decision. Editing the entry later changes its content version and
invalidates that approval automatically.

## Stage 3 exit

This package establishes the curriculum mechanism and first calibration slice.
Stage 3 is not complete until:

- the first 20 entries have recorded bilingual and pronunciation decisions;
- problems found in that review have been corrected and re-reviewed;
- the original 150-entry pilot has current approvals;
- curriculum/prerequisite assignment has expanded coherently beyond the
  calibration slice;
- held-out assessment tasks remain independent and usable.

No learner-effectiveness claim follows from passing these structural checks.
