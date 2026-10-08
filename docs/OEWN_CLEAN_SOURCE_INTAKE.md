# Independent A1 lexical-source intake — OEWN 2025

**Status: staging-only; Gate 0 remains BLOCKED.** This is a deterministic,
offline, no-key candidate extractor, not an authorized replacement for the
existing Oxford-derived lessons, scenes, examples, translations, or audio.

## Source and licence requirements

Official download: https://en-word.net/downloads

Use the **2025 WNDB** `english-wordnet-2025.zip` distribution released on
2025-12-31, rather than a third-party CEFR/Oxford compilation.

- Open English WordNet team additions: [CC BY 4.0](https://github.com/globalwordnet/english-wordnet/blob/main/LICENSE.md).
- Underlying Princeton WordNet material: [WordNet License](https://wordnet.princeton.edu/license-and-commercial-use).
- Preserve both licensors' copyright/disclaimer and attribution notices when
  distributing any extracts or adaptation; include a licence reference in the
  actual learner-facing distribution.

The official 2025 WordNet contains lexical English senses, not a certified
CEFR-A1 curriculum. In particular, WordNet is not a complete source for
pronouns, articles, classroom instructions or Persian translations.

## Independent intake

Obtain the official zip using its official URL, record its SHA-256 in a
reviewed internal intake record, and run:

```bash
python3 scripts/rights/oewn_candidates.py \
  --archive /path/to/english-wordnet-2025.zip \
  --expected-sha256 <reviewed-64-character-archive-sha256> \
  --output content/rights-staging/oewn-2025-candidates.json \
  --limit 250

npm run assurance:rights:source:test
```

The script reads **only** the WNDB `index.sense` inside that archive.
It uses corpus-tag-counts only when the archive actually supplies them.
The verified OEWN 2025 WNDB archive's selected senses have **zero tag counts**;
in this case it orders candidates by **number of recorded senses**, then
alphabetically. Sense count is *not* a corpus frequency estimate, a familiarity
measure or an A1/CEFR rating. This limitation is recorded in
`tagCountEvidence` and `selection`. It does **not** load the Oxford workbook,
the 900-entry legacy A1 roster or existing Vajefy lessons. Its staging JSON
records the archive hash, sense keys, independent-source identifiers, original
licence notices and the unreviewed selection method.

A matching `--expected-sha256` catches accidental archive changes but is not
independent authentication of the supplier; review version and upstream release
metadata separately. Without a pin, the output explicitly records that fact.
A staging file is **not** publishable, and must never be silently copied into
`public/`, `src/` or `content/pilot/`. The script rejects these destinations.

## Verified staging receipt — 2026-10-08

The official WNDB archive was retrieved and SHA-256 checked in
[GitHub Actions run 37837033816](https://github.com/mostifa2274-ui/Vajefy/actions/runs/37837033816):
`38b16326159f51853626b7d24a44c453fa88ab33f06fce5ec8fc5996d1c2be93`.
The resulting `content/rights-staging/oewn-2025-candidates.json` holds exactly
**250** unreviewed English candidates. All selected source index tag counts are
zero; ordering by polysemy count is for reproducibility only and MUST NOT be
presented as learner frequency, commonness, familiarity or CEFR evidence.

Following the audio bot's exact content-hashed asset regeneration, the rights
inventory was reconciled for eight renamed lesson-part JSON files under their
same **UNVERIFIED** legacy association. This prevents invisible gaps in Gate 0
coverage; it does not document or grant redistribution rights. Coach-case and
machine-assurance artifacts were separately regenerated and validated by
[run 37838097043](https://github.com/mostifa2274-ui/Vajefy/actions/runs/37838097043).

**No existing Vajefy lesson, scene, audio clip or artwork was re-licensed.**

## Editorial migration (still outstanding)

1. Create a **new** A1 teaching specification based on learner needs and
   independently licensed inputs; do not reproduce the protected selection and
   order of the previous workbook. Manually grade candidate difficulty.
2. Choose and independently author each learner-facing meaning, translation,
   example, answer, distractor, scene and contrast. Apply Persian-language QA
   and qualified independent semantic reviews.
3. Record exact upstream lemma/sense identifiers, release/version/hash,
   whether and how an item was adapted, its attribution requirements, and
   the hash of the **final** new Vajefy artefact.
4. Check source licence compatibility across English/Persian materials,
   illustrations and TTS voice/model terms. Rebuild the independently owned
   recordings. Preserve attribution in the offline package.
5. Only after every replacement passes rights lineage, content QA and
   the audio/semantic release gates may the legacy public data be replaced.

**No legacy entry or compiled bundle is cleared merely because an OEWN
candidate has the same ordinary English headword.** Individual ordinary words
are not the same issue as copying protected definitions, example sentences,
translations, annotations, database selection and arrangement.

This procedure describes technical provenance; complex copyright/database
rights questions need rights-holder confirmation or independent legal review.
