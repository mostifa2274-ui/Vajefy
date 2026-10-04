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

Only unit 1 is assigned in the first calibration package. The remaining units
are deliberately marked `planned` with no entries yet. Unassigned entries are
a visible backlog, not silently treated as curriculum-complete.

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
- valid prerequisite references that appear earlier in the same unit.

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
already occur earlier in the same unit. These links describe the intended
teaching sequence; they do not claim that every word appearing in every example
has already been mastered.

The next curriculum pass should add a text/task dependency audit: required
lesson text should contain already taught language plus explicit new targets,
with names, inflections and unavoidable exceptions documented rather than
silently ignored.

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

`npm run curriculum:complete` is intentionally stricter and fails until all
900 entries are assigned. It is a future Stage 3/5 completion gate, not a
current CI requirement.

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
