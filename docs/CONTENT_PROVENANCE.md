# Content provenance and release gate

Vajefy ships a derived English-learning dataset in `public/data/`.
The repository also contains the source workbook used for the current conversion:

`attachments/Oxford_3000_5000_Clean_Final_RTL_Safe_Global_EN_FA.xlsx`

The application identifies its learning vocabulary with the Oxford 3000/5000
lists. The technical pipeline verifies counts, required fields, Unicode
normalisation, global id uniqueness, metadata consistency and stable learner
identifiers. Run:

```sh
npm run validate:data
```

The current data contract covers 8,272 records across 17 datasets.

## Rights boundary

This repository's automated checks do **not** establish a licence to redistribute
third-party vocabulary selections, definitions, examples, pronunciations,
translations, branding, or other source material. Before a public or commercial
release, the project owner should verify the rights and attribution requirements
for every source represented in the workbook and generated JSON.

Do not add a permissive licence covering the learning content unless those
rights have been confirmed. Code licensing and content licensing can be handled
separately.

## Safe editing

- Preserve existing `id` values whenever wording changes.
- If an id must change, add an explicit progress migration before updating the
  stable-id hash in `scripts/data-contract.json`.
- Update source workbook and generated JSON together when the workbook remains
  authoritative.
- Treat a changed contract hash as a review event, not a routine formatting fix.

## Enhanced pilot content

The sense-level teaching content in `content/pilot/` (meanings, examples,
grammar notes, mistakes, checks, contrasts and scenes) was written for this
project as drafts for bilingual review. It refers to the Oxford list entries
only by their headwords and stable ids. Every entry stays marked as a draft in
the app until a reviewer approves it ([PILOT_CONTENT.md](PILOT_CONTENT.md)).

The pronunciation clips in `public/audio/pilot/` are synthesised with Kokoro
v1.0, whose weights are released under Apache 2.0 ([AUDIO.md](AUDIO.md)). The
same rights review applies to them before a public or commercial release.
