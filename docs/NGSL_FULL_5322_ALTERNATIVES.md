# Full 5,322-item NGSL 1.2 alternative-source mapping (Oxford legacy corpus)

**Status: staging only, zero clearance. Gate 0 remains BLOCKED.**

This extends the 900-row A1 source comparison to **every current A1–C1 lexical record** in the existing 5,322-record Oxford-derived catalogue. The Oxford 3000 includes 3,000 selected words and the Oxford 5000 adds 2,000; our 5,322 catalogue records are not a claim about unique official lemma counts or source-list subset membership.

## Generated, checked outputs

- `content/rights-staging/ngsl-1.2/full-5322-alternatives.csv` — item-ID/level/headword, pinned NGSL source tier, matching lemma, source rank, match kind and explicit `NOT_CLEARED` fields.
- `content/rights-staging/ngsl-1.2/full-5322-alternatives.json` — identical item-level evidence in machine-readable form.
- `content/rights-staging/ngsl-1.2/full-5322-summary.json` — coverage/counts and status.

The matching policy is deliberately **conservative**. Exact written forms and multi-form headwords can map to an actual lemma in the pinned NGSL 1.2 core, supplementary days/months/numbers, or the wider NGSL-associated SFI 31k extension. The wider extension is *not* itself the NGSL 1.2 2,809-lemma core and **not** a CEFR list. If an entry does not have a direct source lemma, it is marked `NO_DIRECT_SOURCE_LEMMA`, with no invented synonym, form, translation, POS equivalence, approval or replacement lesson. Superscript homograph markers and parenthetical glosses require extra semantic review.

For A1 this file preserves all original staging decisions from `a1-900-alternatives.json`; it does not erase the 59 cases with non-identical source lemmas or the 3 known unmatched terms. Source-candidate matching alone does not certify the correct sense, B2/C1 placement, or a Persian translation.

## Rights, source and authored-field separation

The pinned NGSL alternatives and source notices are documented in `docs/NGSL_A1_RIGHTS_ALTERNATIVES.md` with verified upstream Git blob hashes. The original NGSL source is by Charles Browne, Brent Culligan and Joseph Phillips; materials staged here use CC BY-SA 4.0, with attribution and ShareAlike obligations where applicable. Original Oxford-derived learner-facing data, examples, translations, site images and audio remain independently subject to their own rights checks.

The owner reports that the examples, Persian translations, and other instructional text were made using ChatGPT; the separate all-catalogue, per-field SHA-256 authorship inventory is maintained in PR #169 and `docs/FULL_OXFORD_CHATGPT_AUTHORSHIP_MAP.md`. That user statement is not a licence for Oxford's independently selected word list nor verified historical source independence.

`npm run assurance:ngsl:full:check` reproduces and byte-compares the full CSV/JSON against the exact 5,322 currently staged catalogue IDs, confirms all referenced lemmas and ranks exist in SHA-pinned source snapshots, and fails if anyone stages a false legal approval. It is included in `npm run validate:data`.

**Follow-on action before public release:** independently select and reconstruct any redistributed curriculum from permissible sources, review POS/senses/CEFR/translation, maintain compliant credit and licence information, rebuild audio/art assets with independently valid permissions, and clear every SHA-bound published artifact under `content/assurance/rights-lineage.json`. Neither this map nor PR #168 alone passes Gate 0.
