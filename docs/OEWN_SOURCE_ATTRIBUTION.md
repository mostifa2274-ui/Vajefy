# Attribution and limitations — staged OEWN 2025 synset excerpts

**Staging only. Nothing in this directory is approved for public learner release.**

The source-gloss strings in `content/rights-staging/oewn-2025-sense-references.json`
were extracted from the *official* Open English WordNet 2025 WNDB distribution.
The one-use evidence generation run verified the exact source archive SHA-256
`38b16326159f51853626b7d24a44c453fa88ab33f06fce5ec8fc5996d1c2be93`.
Glosses and synonym members reproduce upstream lexical content as unmodified
synset data; surrounding JSON metadata and the grouping of 250 candidates were
created for this project.

## Upstream attribution and notices

- **Open English WordNet team**, *Open English WordNet 2025*, December 31, 2025.
  Community contributions are licensed **Creative Commons Attribution 4.0
  International (CC BY 4.0)**; original copyright retained by their authors.
  Source: https://en-word.net/downloads
  License and notice: https://github.com/globalwordnet/english-wordnet/blob/main/LICENSE.md
  License terms: https://creativecommons.org/licenses/by/4.0/
- **Princeton University**, *WordNet* underlying database. The original WordNet
  licence applies to underlying Princeton WordNet content. Preserve its
  copyright notices and disclaimer when distributing copies or derivatives.
  WordNet 3.0 Copyright 2006 by Princeton University. All rights reserved.
  License and commercial-use notice:
  https://wordnet.princeton.edu/license-and-commercial-use

The upstream `LICENSE.md` from OEWN tag `2025-edition` is preserved
**verbatim** as `content/rights-staging/OEWN-2025-LICENSE.md`
(upstream Git blob `fe4d1dce8109caa7016fca97f48e49a9ced36ad4`).
The staging audit checks that its full contents have not been changed or dropped.

These citations and the upstream licences govern the **OEWN-derived staged
glosses only**. They do **not** confer rights to the pre-existing
Oxford-derived vocabulary workbook, its adaptations, public lesson packages,
generated audio, site artwork, or any third-party images.

## Critical lexical accuracy warning

The original 250-candidate intake chose a WordNet sense key from **zero tag-count
evidence** and sorted ties lexicographically; it did not select or verify the
first or most suitable A1 sense. Exact-source lookup revealed that **all 50
existing independent bilingual drafts reference non-primary WordNet senses**
(sense number greater than 1), and multiple glosses demonstrably differ from
the teaching meaning. Example mismatches include **run** (movement vs routing),
**plate** (a dish vs an amount), **be** and **have**.

Non-primary does not *by itself* mean the sense is wrong; conversely a first
sense is not proof of CEFR A1 suitability. No draft is semantically approved.
Do not auto-change sense keys or automatically infer a Persian translation
from the source gloss. A separate, independently evidenced sense-selection
process must choose and verify a meaning before reauthoring new content.

The included source-reference validator checks that all 250 source keys,
parts of speech, synset coordinates and gloss hashes match the pinned intake,
that both licences remain credited, and that every review status remains
unapproved. It cannot authenticate any editorial judgment or prove that a
draft teaches the cited synset.

**Gate 0 stays BLOCKED** until actual source/content/media licences,
independent reconstruction, rights clearance, and exact artifact hashes are
documented in the canonical rights-lineage inventory.

## Unapproved alternative senses for the first 50 drafts

The first 50 independent teaching drafts referenced source keys selected by a
zero-tag-count heuristic. They cannot be treated as trustworthy lexical sense
choices: for example, the original `run` key describes routing a wire rather
than running on foot. Simply relabelling that key as `run` would perpetuate
the error. Some non-primary senses can be legitimate, so neither "sense 1"
nor any automatic keyword score is approval.

`content/rights-staging/oewn-2025-draft-alternatives.json` is a reproducible,
unapproved **editorial comparison set**, generated from the *same SHA-pinned
official WNDB zip* and solely the independent staging draft roster. Each
draft retains its exact originally referenced source sense and English
authored teaching meaning, and includes all other source senses for that
lemma and part of speech with precise sense keys, source synset offsets, source
glosses, independent source hashes and licence attribution. It does **not**
choose a sense, assert CEFR level, revise the Persian meaning or copy legacy
lesson prose. No content in this file is a public lesson.

`npm run assurance:rights:alternatives:check` checks cardinality, provenance,
the original pinned reference, source gloss hashes and unapproved status
offline; the Python unit suite also checks that forged approvals, drifted
drafts, modified glosses and wrong archives fail. The original archive is
verified **when generating** the comparison set; an offline hash of a copied
gloss is structural integrity evidence, not proof of legal clearance or
human lexical correctness. The one-use generation workflow checks the entire
official archive SHA-256 before extracting any of these options.

Next editorial action: inspect a draft's intended meaning against its
available OEWN synsets, select a genuinely appropriate source key with
documented justification and an independent reviewer, re-author or correct
the bilingual lesson as needed, then document the final artifact's lineage
and exact SHA-256. All 50 remain unapproved in the current staging system,
and no existing learner-facing corpus, audio, public artwork, or Gate 0 status
has been changed.

