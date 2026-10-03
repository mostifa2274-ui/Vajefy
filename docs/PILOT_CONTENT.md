# Pilot content and editorial workflow

The enhanced A1 pilot teaches the 150 entries in `content/pilot-a1.json` at the
level of individual senses. Its source lives in `content/pilot/`, and
`npm run content:build` compiles it into `public/data/pilot-a1.json`, the file
the app loads.

| File | Contents |
|---|---|
| `entries/1-function.json` … `4-ambiguous.json` | 150 entries, 193 senses, one file per pilot group |
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

All 150 entries are currently drafts. Their content was drafted for review and
has passed the automated checks, but no bilingual reviewer has approved it yet.

## Editing

1. Edit the entry, contrast or scene in `content/pilot/`.
2. Run `npm run content:build`. It validates every entry, cross-reference and
   review record, then writes `public/data/pilot-a1.json`. It reports how many
   entries are released and how many senses have current audio.
3. If the change touches an example, a headword or `tts` phonemes, regenerate
   audio ([AUDIO.md](AUDIO.md)); until then that clip is not attached and the app
   falls back to browser speech.
4. Commit the source and the compiled file together. `npm run validate:data` runs
   `content:build --check` in CI and fails if the compiled file is out of date.

The build also checks that:

- every pilot id exists exactly once and belongs to A1;
- sense ids are unique and follow the naming rule;
- every contrast and scene refers to existing entries or senses;
- each `choice` has exactly one correct option, and each cloze and frame has a
  blank;
- every review record is valid.

## Reviewing

A reviewer reads the entry in the app (Words → the entry) or in its source file,
listens to its clips in both accents, and records the outcome:

```sh
npm run content:approve -- --entry lex:A1:bring --bilingual approved --reviewer "Name"
npm run content:approve -- --entry lex:A1:bring --pronunciation approved --reviewer "Name"
npm run content:approve -- --entry lex:A1:close --pronunciation changes --notes "adjective clip says /kləʊz/"
```

`--entry` may repeat. Statuses are `pending`, `approved` and `changes`. The script
records the current content version, the reviewer and the date in `review.json`;
then run `npm run content:build` to release approved entries. After the content
changes, the old record stays in the ledger but no longer releases the entry, and
the next review of the new version starts both statuses again from `pending`. Git
history keeps every earlier record.

What reviewers check:

- **Bilingual:** the Persian meaning is precise for this sense, the examples are
  natural A1 English with faithful translations, the common mistake is one
  Persian speakers really make, and every check item has one clearly correct
  answer.
- **Pronunciation:** the IPA matches each accent, the word clip and every example
  clip sound right, and the clips in `audio-report.json` for this entry have been
  heard and accepted or fixed.
