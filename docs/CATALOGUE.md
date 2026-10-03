# Improving the whole catalogue

The A1 pilot established a process for teaching content that is checked,
reviewed and then released ([PILOT_CONTENT.md](PILOT_CONTENT.md)). The same
process now applies to the whole catalogue:

| Part | Size | Process |
|---|---|---|
| Entries, A1 to C1 | 5,322 in six levels | Plans, drafting, authoring checks, bilingual and pronunciation review, release |
| Reference notes | 2,950 in eleven collections | Review ledger and a "Reviewed" mark |
| Everything | | The catalogue audit, in CI |

Work proceeds at the pace editorial review allows. The tooling is in place
for every level, and `npm run content:status` shows where each stands.

## Plans

`node scripts/plan-catalogue.mjs` writes one plan per level in
`content/plans/<LEVEL>.json`. Each places every entry of the level in exactly
one batch:

- **A1:** the 150 pilot entries first, then `batch-02` … `batch-09`.
- **Other levels:** `batch-01` onwards.

Batches hold 100 entries in order of usefulness (`public/data/usefulness.json`)
and never reshuffle once written. An entry new to the data is appended. CI
(`--check`) fails if a plan misses an entry, lists one twice or is out of date.

Each planned entry tells the editor what to know before drafting:

| Field | Meaning |
|---|---|
| `flags: split-senses` | The dataset gives several parts of speech; probably several learning targets |
| `flags: also-B1` (etc.) | The same word is taught at another level, usually with another meaning |
| `flags: irregular-verb` | Teach the irregular forms in the grammar notes and checks |
| `flags: several-forms` | The headword lists variants (`a, an`) |
| `refs` | Reference notes about the word (phrasal verbs, collocations, confusing words, families and so on) |

Where one of the `refs` notes is about the sense being written, the entry must
agree with it, or the note is corrected too. A note about a homograph (the
modal *can* for the tin *can²*) is ignored.

## Enhanced entries at every level

The workflow is the pilot's, with a level:

1. `npm run content:scaffold -- --level A2 --batch batch-01 --limit 20` writes
   drafts to `content/drafts/A2/batch-01/`, prefilled from the dataset, with
   the plan's flags and notes.
2. `npm run content:drafts [-- --level A2]` lists what each draft still needs.
3. `npm run content:promote -- --entry lex:A2:ability` validates the entry and
   adds it to `content/pilot/entries/A2-batch-01.json`.
4. `npm run content:build` compiles every level's entries, in curriculum order
   (A1's plan, then A2's, and so on), into the files the app loads
   (`public/data/enhanced/`, [PILOT_CONTENT.md](PILOT_CONTENT.md)), with
   `public/data/enhanced-order.json` for Today.
5. Audio ([AUDIO.md](AUDIO.md#regenerating)) and review with
   `npm run content:approve` ([PILOT_CONTENT.md](PILOT_CONTENT.md#reviewing)),
   exactly as for A1.

The authoring checks (`npm run content:lint`) judge vocabulary by the entry's
level. Words taught at that level, below it, or at the next level are
expected; anything higher is flagged for an editor.

### In the app

Enhanced content follows the learner's focus level:

- **Learn** offers lessons for that level's enhanced entries first, then the
  other levels' (lowest first), so an A2 learner whose level has none yet
  still meets the A1 lessons.
- **Today** counts lessons for the focus level.
- **Review** leaves the level's enhanced entries to the lessons while any are
  unmet. Their cards show the enhanced sense, example and audio.

Release channels apply to every level alike
([PILOT_CONTENT.md](PILOT_CONTENT.md#releasing-at-the-pace-of-review)).

## Reference notes

Reference notes are reviewed bilingually: the English item, the Persian
meaning, the guide and the example. Their review follows the entries' rule: an
approval names the content version the reviewer read, and any later edit
withdraws it.

```sh
npm run content:notes                                  # progress per collection
npm run content:notes -- --collection conf             # what to review next, essential notes first
npm run content:notes -- approve --note conf:do-make --bilingual approved --reviewer "Name"
```

The ledger is `content/reference/review.json`. Approvals compile into
`public/data/reference-reviewed.json`, and the library marks those notes
**Reviewed**. Other notes are shown as before, since they predate the process.

## The audit

`npm run content:audit` checks every entry and reference note, and runs in CI
as part of `validate:data`:

| Rule | Severity | Finds |
|---|---|---|
| `spacing` | error | Stray or doubled spaces |
| `isolates` | error | A direction isolate (⁦…⁩) left open, which disorders the rest of the line, or one doubled |
| `ipa` | error | Pronunciation not written `/…/` (or `noun /…/; verb /…/`) |
| `latin-in-persian` | warning | English inside Persian text without an isolate, so it can render out of order |
| `example-headword` | warning | An entry's example that never uses its word, in any form |
| `example-item` | warning | A note's example that never uses what the note teaches |
| `example-repeated` | warning | Two entries with the same example, so assessment cannot tell them apart |
| `example-level` | warning | Words more than one level above the entry in its example |
| `example-template` | warning | One generic sentence reused, with only its subject changed, by two or more notes |
| `example-sentence`, `translation-sentence` | warning | Not a full sentence (capital letter, final punctuation) |
| `article` | warning | *an utility*, *a apple* |
| `doubled-word` | warning | The same word twice in a row (some are right: «پس از از دست دادن») |
| `note-word` | warning | A compared word (confusing words, synonyms, irregular verbs) that is not in the vocabulary lists |

Words are matched to their dictionary forms (*upheld* → *uphold*, *closest* →
*close*). Errors always fail. Warnings that are accepted for now are listed in
`content/audit/baseline.json`. CI fails on any warning not in the baseline,
and on a baseline line that no longer occurs. The baseline therefore only
shrinks: after fixing something, run `npm run content:audit -- --update`.

### What the first audit fixed

- English inside Persian text isolated, so it keeps its order: *a*/*an*, *A2*,
  *PDF*, *in spite of*, *CNC* and *RFID*. A stray English word was removed from
  a Persian gloss.
- Eleven examples shared by two entries rewritten, so each entry has its own
  sentence. Examples include *I read a book every night* (book and read) and
  *The clock is on the wall* (clock and wall).
- Six A1 examples that relied on words far above A1 (*noon*, *yard*,
  *password*, *mall*) rewritten.
- Every occupation note whose example and usage line were a generic sentence
  for its category, 866 in all, rewritten in English and Persian to say what
  the job involves. Some of the old sentences were wrong for the job:
  - a fashion model "helped customers complete sales";
  - a legislator "coordinated day-to-day operations";
  - an embalmer "provided recreation services".

  Each note's guide now opens with that use and names the right field. 79
  Persian titles that were plural, garbled or inexact were corrected, and the
  example for *hospital orderly* uses the full title. *A clergy* became
  *a cleric*, and *an urologist* became *a urologist*.
- 36 examples in A2–B2 that relied on a word more than one level higher
  (*pond*, *logo*, *grocery*) rewritten with a simpler word.
- The word forms the checks know were extended with irregular verbs missing
  from the irregular-verb collection.

### What remains

The baseline lists what remains (`npm run content:audit -- --all`):

- **2 A2 examples** that use a harder word on purpose (*human*, *sir*), since
  the example would be unnatural without it. An editor confirms each.
- **4 confusing-word notes** about words outside the lists (*fetch*,
  *economical*, *farther*, *thankful*). This is intended: the note teaches the
  contrast.
- **2 Persian translations** with a word that is correctly written twice
  («پس از از دست دادن», «را کند کند»).

These are editorial work, done note by note and reviewed like the rest.
