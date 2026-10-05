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

Wave 3 is now mapped. Unit 1 remains the fixed 20-entry calibration package,
while Units 2–12 each contain their full 80 assigned entries and remain
`planned`. The structural curriculum therefore covers all 900 canonical A1
entries. Mapping establishes curriculum order and prerequisites but does not
mean the content has passed bilingual/pronunciation review, learner validation,
or release review.

The manifest carries an `assignedMinimum` coverage ratchet. It is now set to
900, so CI prevents any mapped A1 entry from silently falling out of the
curriculum. There is no unassigned structural backlog; the remaining work is
quality qualification of the mapped entries, not catalogue assignment.

### Final A1 unit targets

The seed map is not the finished curriculum. Each unit now declares a
`targetEntries` value that defines its final structural capacity:

- Unit 1 (the fixed calibration unit): 20 entries.
- Units 2–12: 80 entries each.

Those targets sum exactly to the canonical 900-entry A1 plan
(`20 + 11 × 80 = 900`). CI rejects missing/invalid targets, targets whose sum
does not equal the A1 plan, a unit that grows beyond its target, or a unit marked
`complete` before it has filled its target. `npm run curriculum:complete`
still fails until all 900 entries are actually assigned; a target is capacity,
not evidence that its slots are already curated.

The initial 240-entry seed has now completed all three balanced expansion waves.
Each of Units 2–12 gained 60 additional entries across Waves 1–3, moving
coverage from 240 to 460, then 680, and finally 900/900. Wave 3 assigns the
remaining long-tail A1 vocabulary by its most plausible practice context; some
general discourse/support words therefore serve a unit pedagogically without
claiming a narrow semantic-domain identity.

These milestones are machine-enforced as **balanced per-unit floors**, not just
total counts: 240 requires 20 entries in every unit, 460 requires 40 in Units
2–12, 680 requires 60, and 900 requires all 80 target entries. The repository
regression also runs `curriculum:complete`, which now passes structurally.
That result means every canonical A1 entry has a unit and every unit target is
filled; it does **not** create human bilingual/pronunciation approval or mark
the units released.

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

### Unit 5 — Shopping and money

The mapped sequence is:

`money`, `buy`, `sell`, `need`, `shop`, `shopping`,
`market`, `supermarket`, `price`, `cost`, `cheap`,
`expensive`, `pay`, `card`, `clothes`, `shirt`,
`shoe`, `dress`, `one`, `open`.

The unit prioritizes transactional language over catalog breadth: asking for
things, buying and selling, understanding price/cost, paying, locating common
shops, and handling a small clothing-shopping scenario. More numbers, colours,
sizes, and quantity language remain available for later recycling rather than
being forced into the first shopping unit.

### Unit 6 — Places and directions

The mapped sequence is:

`place`, `here`, `there`, `road`, `street`, `address`,
`building`, `hotel`, `hospital`, `park`, `centre`,
`way`, `map`, `near`, `far`, `between`, `opposite`,
`left`, `right`, `turn`.

This unit separates local-navigation language from transport. It first anchors
common place types and location words, then adds map/distance relations and the
core left/right/turn sequence needed to follow simple directions. Transport
nouns and journey verbs are reserved for Unit 7 so the two units remain
pedagogically distinct.

### Unit 7 — Travel and transport

The mapped sequence is:

`go`, `come`, `travel`, `trip`, `leave`, `arrive`,
`ticket`, `station`, `stop`, `bus`, `train`, `car`,
`taxi`, `airport`, `plane`, `drive`, `ride`, `bike`,
`boat`, `holiday`.

The unit starts with movement/journey verbs, then introduces the ticket and
station/stop concepts needed for public transport, followed by common transport
modes and their basic action verbs. Local direction words remain in Unit 6, and
social-purpose travel such as `visit` is left for later units so this unit
stays focused on getting from one place to another.

### Unit 8 — Work and study

The mapped sequence is:

`work`, `job`, `office`, `company`, `study`, `student`,
`teacher`, `class`, `lesson`, `course`, `learn`, `book`,
`read`, `write`, `computer`, `email`, `question`, `answer`,
`test`, `homework`.

This unit deliberately balances workplace and study language. It starts with
basic work contexts, then builds a school/class sequence, adds core learning
actions and materials, and finishes with retrieval/assessment language. Earlier
`school`, `start`, `finish`, and `time` entries are reused as
prerequisites rather than duplicated here.

### Unit 9 — Leisure and people

The mapped sequence is:

`person`, `people`, `young`, `man`, `woman`, `boy`,
`girl`, `meet`, `together`, `free`, `fun`, `listen`,
`music`, `song`, `watch`, `film`, `play`, `game`,
`sport`, `football`.

The unit starts with basic people/social language, moves into meeting and shared
free time, then introduces listening/music and film before finishing with games
and sport. Earlier family, travel, and study words are intentionally not
duplicated; later leisure vocabulary such as parties, cinema, swimming, and
weekend activities remains available for recycling and expansion.

### Unit 10 — Weather and clothes

The mapped sequence is:

`weather`, `hot`, `cold`, `warm`, `cool`, `sun`,
`rain`, `snow`, `colour`, `red`, `blue`, `coat`,
`jacket`, `hat`, `skirt`, `trousers`, `wear`, `put`,
`on`, `off`.

The unit first builds a compact weather/temperature system, then adds colour and
everyday clothing, and finishes with the core dressing sequence needed for
phrases such as `put on` and `take off`. Existing `clothes`, `shirt`,
`dress`, and `shoe` entries from Unit 5 are reused rather than duplicated.
Additional colours and clothing items remain available for later recycling.

### Unit 11 — Health and feelings

The mapped sequence is:

`health`, `healthy`, `sick`, `well`, `doctor`, `feel`,
`happy`, `sad`, `angry`, `tired`, `afraid`, `body`,
`head`, `face`, `eye`, `ear`, `mouth`, `hand`,
`leg`, `foot`.

The unit starts with basic health states and a small set of high-frequency
feelings, then anchors the body-part vocabulary most useful for simple health
descriptions. Earlier `hospital` and `sleep` entries are reused from prior
units rather than duplicated. Broader problem-solving language such as
`help`, `sorry`, and everyday repair/request language is intentionally
reserved for Unit 12.

### Unit 12 — Help and everyday problems

The mapped sequence is:

`help`, `problem`, `wrong`, `sorry`, `please`,
`understand`, `cannot`, `language`, `speak`, `slow`,
`again`, `repeat`, `ask`, `find`, `call`, `phone`,
`number`, `police`, `door`, `key`.

The final seed unit concentrates on communication repair and practical help:
saying there is a problem, not understanding, asking someone to repeat or speak
slowly, requesting help, making a phone call, contacting police, and handling a
simple door/key problem. Earlier `where`, `how`, `address`, `right`,
`answer`, `stop`, and `need` entries are reused from prior units rather
than duplicated.

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
standard is scaled. Run `npm run content:review-queue` first to see each
entry's exact current version, missing/current/stale ledger state, bilingual and
pronunciation state, current audio completeness, listener flags and next review
action. Use `--scope pilot` for the original 150-entry pilot. The report is
read-only and cannot create an approval.

Follow `docs/PILOT_CONTENT.md#reviewing` and record real reviewer decisions in
`content/pilot/review.json`.

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
