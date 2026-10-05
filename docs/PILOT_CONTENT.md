# Enhanced content and editorial workflow

Enhanced entries teach A1 vocabulary at the level of individual senses. The
first 150 written formed the pilot (`content/pilot-a1.json`); the rest of A1
followed in batches ([Expanding across A1](#expanding-across-a1)). Learners meet
them in curriculum order ([A1_CURRICULUM.md](A1_CURRICULUM.md#course-order)),
and the learning study measures the opening units (`content/study-a1.json`,
[EVALUATION.md](EVALUATION.md#the-studys-words)). The source lives in
`content/pilot/`, and `npm run content:build` compiles it into:

- `content/compiled/enhanced.json`, all of it in one file, which the scripts,
  the tests and the coach read;
- `public/data/enhanced/`, what the app loads: `index.json` lists every entry
  with its senses' meanings and parts of speech, plus the contrasts and
  scenes, and the curriculum units entries belong to; each part file (named by
  its content) holds the full content and audio of 25 entries in course order,
  so a screen loads only the entries it shows; `audio-pack.json` lists the
  clips for offline download;
- `public/data/enhanced-order.json`, the introduction order Today reads.

Each compiled entry carries its course position, its curriculum unit and the
prerequisite entries the curriculum declares, and the compiled file names the
study's word set. The content version covers all of these.

| File | Contents |
|---|---|
| `entries/1-function.json` … `4-ambiguous.json` | The pilot: 150 entries, 193 senses, one file per pilot group |
| `entries/<LEVEL>-batch-NN.json` | Later batches, added by `content:promote`: `A1-batch-02.json` to `A1-batch-09.json` (100 entries each, and 50 in batch 9; 120, 119, 112, 104, 110, 108, 108 and 53 senses) |
| `contrasts.json` | 16 comparison lessons for words learners confuse (say/tell, bring/take, a/an/the …) |
| `scenes.json` | 14 short dialogues and passages that reuse learned words in a new situation |
| `review.json` | The editorial ledger: one review record per entry (created by the first approval) |
| `audio-manifest.json` | Generated pronunciation clips, by sense and accent ([AUDIO.md](AUDIO.md)) |
| `audio-report.json` | Clips flagged for a listener to check |

## What a sense contains

The schema is `src/lib/learn/content.ts`. Each sense has:

- a part of speech, a short Persian gloss and a precise Persian meaning;
- one or more grammar patterns, each with a Persian note;
- at least two examples with translations;
- collocations, and an optional usage note (register, context, restrictions);
- one common mistake: the wrong form, the right form and why;
- British and American IPA, with an optional Persian note on stress or sounds;
- optional phonemes (`tts`) for speech generation when spelling alone is
  ambiguous, for example *close* (verb /kləʊz/, adjective /kləʊs/) or *live*;
- at least two context checks: **cloze** (a blank in a new sentence),
  **choice** (pick the word that fits, with a reason for every option) or
  **produce** (write the English for a Persian sentence in a frame).

Persian text must use Persian ی and ک; the build rejects Arabic ي and ك.

## Stable ids

The first sense of an entry keeps the entry's existing id (`lex:A1:close`), so
progress on the original word carries over to it. Further senses get
`<entry id>#<name>` ids (`lex:A1:close#adjective`). Once published, a sense id is
a learner-data key: renaming or removing it orphans saved cards. Add senses
freely; change an existing id only with a progress migration.

## Content versions and release

The build hashes each entry's teaching content into a 12-character **content
version**. A review record names the version the reviewer saw, and an entry is
**released** only when:

- its record's version equals the current version, and
- both the bilingual review and the pronunciation review are `approved`.

Any later edit changes the version and withdraws the approval until the entry is
reviewed again. Unreleased content is still taught, with a visible
**Draft: awaiting bilingual review** label on the card, the lesson and the Words
page.

All 900 A1 entries (the pilot and A1 batches 2–9) are currently drafts. Their
content was drafted for review and has passed the automated checks, but no
bilingual reviewer has approved it yet.

The A1 curriculum sequence and first 20-entry calibration slice are tracked in
[`A1_CURRICULUM.md`](A1_CURRICULUM.md) and
`content/curriculum/A1.json`. `npm run curriculum:status` checks that slice
against current content, audio, prerequisites and held-out assessment capacity.
Those checks prepare review; they never create editorial approval.

## Authored task support

Checks should prefer already introduced language. When an early A1 check needs
an otherwise untaught context word to stay natural, add a small learner-visible
`support` list directly to that check:

```json
"support": [
  { "en": "book", "fa": "کتاب" }
]
```

Use the exact word or short phrase that appears in the task. Keep the list
minimal and never include the current target or its answer form. The UI shows
these glosses before answering, and the calibration gate rejects stale support
or support that leaks the target. This mechanism is for comprehensible context,
not for bypassing prerequisite design.

## Editing

1. Edit the entry, contrast or scene in `content/pilot/`.
2. Run `npm run content:build`. It validates every entry, cross-reference and
   review record, then writes the compiled files, removing parts left from
   earlier builds. It reports how many entries are released and how many
   senses have current audio.
3. If the change touches an example, a headword or `tts` phonemes, regenerate
   audio ([AUDIO.md](AUDIO.md)); until then that clip is not attached and the app
   falls back to browser speech.
4. Commit the source and the compiled files together. `npm run validate:data` runs
   `content:build --check` in CI and fails if any compiled file is out of date.

The build also checks that:

- every pilot id exists exactly once and belongs to A1;
- sense ids are unique and follow the naming rule;
- every contrast and scene refers to existing entries or senses;
- each `choice` has exactly one correct option, and each cloze and frame has a
  blank;
- every review record is valid.

## Reviewing

Before recording any decision, generate the read-only queue for the scope being
reviewed:

```sh
npm run content:review-queue
npm run content:review-queue -- --scope study
npm run content:review-queue -- --scope pilot
npm run content:review-queue -- --scope all-a1 --json
npm run content:review-queue -- --unit 08-work-study
npm run content:review-queue -- --unit 08-work-study --packet
```

The default scope is the fixed 20-entry calibration slice. `study` is the
learning study's word set (the opening curriculum units, 180 entries), `pilot`
is the original 150-entry selection and `all-a1` covers all 900 A1 entries in
**curriculum order**. Use `--unit <unit-id>` to generate the same evidence queue for one
curriculum unit, for example `08-work-study`. Unit selection cannot be mixed
with `--scope`, which keeps reviewer batches unambiguous.

The queue reports the exact current content version, whether the ledger record
is `missing`, `current` or `stale`, the current bilingual and pronunciation
states, exact audio completeness, flagged clips that need listening, release
state and the next evidence action. A stale record remains visible but is never
treated as approval for the current version.

For an actual reviewer, add `--packet` to produce a self-contained Markdown
review packet for the selected calibration/pilot/unit scope. The packet includes
the exact approval token, every current sense and Persian meaning, grammar,
examples, collocations, mistake guidance, GB/US IPA, exact current word/example
audio asset paths, listener flags, and the last authored check reserved as the
held-out candidate. `--limit` can be combined with `--packet` to create a
smaller review batch. For example:

```sh
npm run content:review-queue -- --unit 08-work-study --packet --limit 10 > unit-08-review.md
```

The packet is still read-only. It is evidence for a human reviewer, not a
decision form: generating or saving it does not approve content, clear an audio
flag, or change `review.json`. The decision commands printed inside the packet
must only be run after a person has reviewed that exact `entry@version`.

The queue is deliberately read-only. Complete audio means the required current
files exist; it is not pronunciation approval. Likewise an automatic audio flag
means “listen to this clip”, not “reject this clip”. Normal CI validates the
calibration, pilot and full 900-entry A1 queues in `--check` mode. The full-A1
queue must exactly match the canonical A1 plan while following curriculum
order, so catalogue, curriculum and editorial membership cannot silently
drift apart.

For unit-level release decisions, pair the queue with the qualification report:

```sh
npm run content:qualification
npm run content:qualification -- --unit 08-work-study
npm run content:qualification -- --unit 08-work-study --require-ready
npm run content:qualification -- --unit 08-work-study --require-qualified
```

`--require-ready` checks only machine evidence: filled unit target, current
enhanced content, a reservable held-out check for every sense and complete
current GB/US audio. `--require-qualified` additionally requires explicit
current bilingual and pronunciation approvals for every entry. Neither mode
creates a decision, clears an audio flag or proves learner effectiveness.

A reviewer then reads the entry in the app (Words → the entry) or in its source
file, listens to its clips in both accents, and records the outcome using the
exact `entry@version` token printed by the queue:

```sh
npm run content:approve -- --entry lex:A1:bring@<VERSION> --bilingual approved --reviewer "Name"
npm run content:approve -- --entry lex:A1:bring@<VERSION> --pronunciation approved --reviewer "Name"
npm run content:approve -- --entry lex:A1:close@<VERSION> --pronunciation changes --reviewer "Name" --notes "adjective clip says /kləʊz/"
```

`--entry` may repeat. Statuses are `pending`, `approved` and `changes`.
An `approved` or `changes` decision requires both the exact current
`entry@version` token and an explicit reviewer name; `changes` also requires
notes explaining what must be corrected. The command preflights every target
before writing the ledger, so a stale token cannot partially approve a batch.
Bare entry IDs remain available only for setting/resetting a status to
`pending`.

The script records the reviewed content version, reviewer and date in
`review.json`; then run `npm run content:build` to release entries whose
current bilingual and pronunciation decisions are both approved. After content
changes, the old record stays in the ledger but no longer releases the entry,
and the next review of the new version starts both statuses again from
`pending`. Git history keeps every earlier record.

What reviewers check:

- **Bilingual:** the Persian meaning is precise for this sense, the examples are
  natural A1 English with faithful translations, the common mistake is one
  Persian speakers really make, and every check item has one clearly correct
  answer.
- **Pronunciation:** the IPA matches each accent, the word clip and every example
  clip sound right, and the clips in `audio-report.json` for this entry have been
  heard and accepted or fixed.

## Expanding across A1

Every A1 entry now has enhanced content. The same process continues with the
rest of the catalogue ([CATALOGUE.md](CATALOGUE.md)). `content/plans/A1.json`
places every one of the 900 A1 entries in one batch: the pilot first, then
`batch-02` … `batch-09`, 100 entries each (the last 50 in `batch-09`), in order
of usefulness. The workflow for a batch:

1. **Scaffold.** `npm run content:scaffold -- --batch batch-02 --limit 20`
   writes drafts to `content/drafts/A1/batch-02/`. A draft is prefilled with
   the headword, gloss, IPA and the dataset's example, starts one sense per
   part of speech, and lists what is left to write. Drafts are not compiled.
2. **Draft.** Fill in each draft. `npm run content:drafts` lists what each one
   still needs, by the same schema the build uses.
3. **Promote.** `npm run content:promote -- --entry lex:A1:her` validates the
   whole entry, adds it to `content/pilot/entries/A1-batch-02.json` and
   deletes the draft.
4. **Build and check.** `npm run content:build` compiles the content and runs
   the authoring checks (below).
5. **Record audio** ([AUDIO.md](AUDIO.md#regenerating)) and **review**
   ([Reviewing](#reviewing)).

`npm run content:status -- --level A1` shows each batch: drafts in progress,
entries with content, released entries, approvals made stale by later edits,
entries with complete audio and audio still to be heard. It also lists the
next entries to draft, with the flags and reference notes described in
[CATALOGUE.md](CATALOGUE.md#plans).

### Authoring checks

`npm run content:lint` (part of `content:build`; errors fail CI) reads all
enhanced content.

| Check | Severity |
|---|---|
| Two options in a choice are the same | error |
| A scene never uses one of its target words | error |
| A writing task's model answer does not use a word it asks for | error |
| Words above the next level in an example, a check or a scene line (above A2 for A1 content) | warning |
| Words not in the Oxford lists (names, *pizza*) | warning |
| A scene where more than 5% of words are above the next level | warning |
| A check that nearly repeats a teaching example (assessment needs new sentences) | warning |
| A cloze whose answer already appears in its sentence | warning |
| Accepted answers that repeat each other | warning |

Words are matched to their dictionary form (*left* → *leave*, *children* →
*child*, *don't* → *do*), and an entry's own headword is never flagged.
Warnings are for an editor to judge: sometimes a B1 word is the natural one.

### Releasing at the pace of review

The app's build chooses which content learners meet, with
`VITE_CONTENT_CHANNEL` (`src/lib/learn/channel.ts`):

- `draft` (default): every entry with content, unreviewed ones labelled as
  drafts. Use it for the pilot study and for reviewers.
- `released`: only entries whose bilingual and pronunciation reviews are both
  approved for their current content are introduced in lessons, counted on
  Today and shown in detail on Words. Contrasts and scenes appear once all
  their words are released. Cards a learner already has keep their content.

A public deployment set to `released` therefore grows exactly as fast as
entries are approved, with no other change.

A third value, `none`, turns guided lessons off. The same words are then
introduced in Review, in curriculum order, with their original cards. This is the pilot study's
comparison arm ([EVALUATION.md](EVALUATION.md#the-pilot-study)).

