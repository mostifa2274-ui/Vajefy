# Full Oxford 3000/5000 legacy-catalogue and ChatGPT-authorship map

**Status: COMPLETE INVENTORY, ZERO RIGHTS CLEARANCES. Gate 0 remains BLOCKED.**

## Scope and exact outputs

Run `npm run assurance:rights:authorship`. The generated, SHA-256-bound, spreadsheet-compatible inventories live in `content/rights-staging/legacy-full-lineage/`:

- `vocabulary-5322.csv` — **all 5,322 existing lexical records** at A1 (900), A2 (872), B1 (809), B2 (727), B2+ (699), C1 (1,315), keyed by their exact stable ID and existing headword;
- `supplementary-2950.csv` — **all 2,950 existing supplementary entries** (occupations, phrasal verbs, collocations, prepositions, antonyms, confusing words, verb patterns, irregular verbs, formations, synonyms and word families);
- `teaching-a1-1057.csv` — **1,027 A1 enhanced teaching senses**, plus 14 scene stories and 16 contrast lessons, each bound to the exact current source JSON object;
- `map-summary.json` — per-level and per-material counts, source distinction, author-report status and zero-approval declaration.

A vocabulary *record* is not necessarily one unique lemma: the underlying Oxford 3000 has 3,000 selected words and the Oxford 5000 adds **2,000** words, while this app has 5,322 records across levels, homographs, POS and sense-specific variants. These files map **every current app record**, not an independently verified reproduction of Oxford's 5,000 distinct source headwords. The precise Oxford 3000-vs-extra-2000 membership of each existing row remains `UNVERIFIED_PER_RECORD`; do not guess from CEFR alone, particularly at B2.

## Which fields were created with ChatGPT?

The owner reports on 2026-10-09 that the English examples, Persian translations and other teaching materials were generated with ChatGPT. This is a **user-reported authorship assertion**, not a prompt transcript audit. For all catalogue records, the mapping distinguishes:

- **Selection / identifiers:** `id`, `w` or supplementary headword/group selectors, CEFR group, frequency/level metadata — remain inherited or `UNVERIFIED` lineage; not described as newly written by ChatGPT.
- **Reported model-authored instructional fields:** `fa`, `tr`, `ex`, `pr`, `ipa`, explanations, guides and every other non-selection content field present on the row — marked `USER_REPORTS_CHATGPT_NOT_INDEPENDENTLY_VERIFIED`.
- **A1 enhanced sense content:** each sense, scene, and contrast is separately SHA-256-bound. Existing `content/assurance/generation.json` remains authoritative for any actually recorded generator; historical `unknown` entries stay unknown despite the newer owner statement. Audio and images require separate model/voice/media rights proof.

OpenAI's consumer terms state that as between a user and OpenAI, and to the extent permitted by law, the user owns their output; they also make the user responsible for third-party rights and do not transfer third-party content rights. See https://openai.com/policies/terms-of-use/.

The original Oxford word-list **selection, arrangement and material sourced from the workbook** remains a separate rights issue. Oxford's legal notice reserves rights in its content; reading or downloading a list does not provide a general licence to reproduce it in a commercial offline app. See https://www.oxfordlearnersdictionaries.com/us/legal-notice.html and https://www.oxfordlearnersdictionaries.com/about/wordlists/oxford3000-5000.

A non-verbatim independently generated translation may avoid copying a dictionary's original wording, but machine generation alone does **not** verify source independence, third-party inputs, semantic accuracy, applicable database rights, voice permissions or commercial redistribution.

## How the Gate 0 migration proceeds

1. Retain the stable legacy IDs only for technical traceability; independently reconstruct the selected corpus using permitted sources, including the pinned NGSL 1.2 proposals in the separate A1 mapping work. Follow attribution and ShareAlike conditions of any material actually adapted.
2. Replace any inherited selection, protected sentences, examples or definitions requiring rights. Perform qualified independent semantic, Persian and pedagogical review as specified in `docs/RIGHTS_MIGRATION.md`.
3. Bind every approved replacement to exact item bytes and a permissible source in `content/assurance/provenance.json` and `content/assurance/rights-lineage.json`; maintain site/audio/artwork media evidence separately. A user attestation is useful for tracing authored fields but **cannot** substitute for licence evidence.
4. Do not change `GATE0-RIGHTS` from BLOCKED or relax the production-deploy guard until the per-item and bundle-level audits actually clear.

## Reproducibility and integrity

The inventory generator runs in read-only `--check` mode during `npm run validate:data`. It verifies exact current row hashes, complete roster membership, non-duplicated stable IDs, A1 1,027 sense coverage, 30 narrative/contrast units, all supplementary counts, and the invariant that **reported AI authorship is not redistribution permission**. Any changed source data makes the committed CSV stale and blocks CI until an updated, reviewed inventory is generated.

**No learner-facing word, translation, lesson, audio, artwork, license declaration or production release setting is changed by this mapping.**
