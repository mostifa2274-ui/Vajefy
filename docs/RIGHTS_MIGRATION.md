# Gate 0 — redistribution rights and clean-source migration

Updated 2026-10-08. **Status: BLOCKED.** This is an evidence and engineering
procedure, not a legal opinion or an assertion that the existing material is licensed.

## What is known, and what is not

The repository's `content/assurance/provenance.json` lists an
Oxford 3000/5000-derived workbook with **UNVERIFIED** redistribution and
derivative-work rights. Generating explanations, Persian translations, examples,
MP3 clips, or supplementary exercises from that selection does **not** retroactively
license a protected selection or adapted source text. The current source
association in `content/assurance/rights-lineage.json` is deliberately
**conservative and unverified**, not proof that every individual expression
originated in the workbook.

`rights-lineage.json` now explicitly accounts for **900 A1 source entries**, **30 separately authored scenes and contrast lessons**, **59 public JSON assets** (21 top-level catalogue files and all 38 generated `public/data/enhanced/*.json` files), and two governed media groups (published audio and site artwork). All currently remain UNVERIFIED. Each derived JSON file is SHA-256 bound to its exact current bytes: clearing an upstream entry alone cannot automatically approve a published scene, lesson bundle or audio index. A regenerated lesson-part filename changes inventory coverage and fails CI until its source assignment is reviewed. Audio, illustrations and other media also require independent rights evidence. Merely changing a directory or copying an existing Oxford-derived lesson is **not** legal clearance.

## Technically usable open alternative: Open English WordNet

- **Source:** Open English WordNet, 2025 edition, maintained by the Open English
  WordNet Team / Global WordNet Association.
- **Official distribution:** https://en-word.net/downloads
- **Official licence:** https://github.com/globalwordnet/english-wordnet/blob/main/LICENSE.md
- **Permissions:** its team-authored contributions are CC BY 4.0; the resource
  includes Princeton WordNet material subject to the Princeton WordNet licence.
  Attribution to **both Princeton WordNet and the Open English WordNet team** is
  required. Preserve the notices from both licences, document modifications, and
  include source/version/URL and retrieval hash. Licence:
  https://creativecommons.org/licenses/by/4.0/legalcode.en
- This is a candidate for independently sourced English lemmas/lexical senses,
  **not** an Oxford 3000/5000 permission grant, **not** an A1/CEFR-labelled
  list, and not evidence that any *existing* Vajefy content was sourced from it.

Avoid substituting Wiktionary texts unless CC BY-SA 4.0 derivative/attribution
obligations and independently licensed images/sounds have been reviewed.

## Two real paths to removing the rights blocker

**Path A — direct permission.** Obtain a written licence from the actual
rights owner/authorized licensor covering the precise Oxford workbook and its
underlying vocabulary selection, worldwide web/mobile distribution, translations,
derivative teaching text, commercial use, duration, attribution, and redistribution
of downloadable offline bundles. Record the signed authorization and exact
covered version in a verifiable restricted evidence location. Check the contract's
restrictions and confirm the rights of the workbook's *other* contributors.
Do not put confidential licence documents or personal data in a public repo.
Only then change the rights source record and approve individual artifacts.

**Path B — independent reconstruction (preferred for a freely redistributable
product).** Freeze the historical workbook *outside* the new authoring workflow.
Build a new A1 selection from independently licensed sources and pedagogical
criteria, not by relabelling or re-sorting the Oxford roster. Independently
create/review English definitions, bilingual meanings, example sentences, tasks,
scenes and translations; preserve existing stable technical IDs only for
compatibility where that does not carry forward protected selection or
expression. Identify replacement selections that differ from the existing
roster, and record their independently sourced rationale.

For every item and media group:
1. Document `sourceId`, exact version and upstream identifier, licence notices,
   attribution, applicable commercial/derivative permission, and the actual
   independently authored/licensed transformation.
2. Verify the exact current content SHA-256 computed by
   `scripts/rights-lineage-audit.ts`; record `sourceReference`,
   `method` (`licensed-copy` or `independent-rebuild`), evidence locations,
   and `reviewedAt` under `clearedEvidence.entries` or
   `clearedEvidence.publicData`, `clearedEvidence.curatedContent` or `clearedEvidence.mediaGroups`.
3. Update the corresponding explicit `sourceAssignments` to a verifiably
   cleared `content/assurance/provenance.json` source. Keep any legacy
   attribution and historic proof separately; do not fabricate a source link.
4. Repeat for every compiled lesson JSON file, authored scene and contrast, public data file and separately governed media group; audit shipped media,
   model/voice terms, illustrations, licence notices and generated works.
5. Verify licence compatibility and attribution in the actual UI/build output.
   For a legal interpretation that remains ambiguous, obtain rights-holder
   confirmation or professional advice. An internal AI review is not a licence.

## Independent A1 authoring staging — new, not approved

`content/rights-staging/independent-a1-editorial-drafts.json` contains **50 newly
drafted bilingual teaching entries** from the separate SHA-pinned OEWN 2025
candidate pool. They were written as fresh examples rather than transplanted
legacy exercises, but the automated checks **cannot prove clean-room
independence**, verify the intended WordNet sense, or confirm translation
quality. Each draft explicitly remains `A1_UNVERIFIED`,
`NOT_YET_VERIFIED` for source-sense matching, and
`DRAFT_NEEDS_HUMAN_PEDAGOGY_RIGHTS_AND_SENSE_REVIEW`.

`npm run assurance:rights:drafts:check` runs in `validate:data`. It verifies
the exact upstream lemma/POS/sense-key and archive hash, checks bilingual
presence and duplicate copy, and refuses verbatim or eight-English-token
reuse from the original lesson/scene/contrast sources. A regression suite
covers forged source keys, unreviewed-to-cleared relabelling, and reuse. This
does **not** remove legal/database selection risk or itself grant rights.

The second staging batch adds 25 more new Persian/English draft lessons for common daily verbs and concrete nouns. The 50/250 candidate coverage is **drafting progress only**, not a rights clearance fraction, CEFR qualification, licence finding or completed app migration. Source-sense keys are selected from a pinned independent intake but the intended definitions have **not** been checked against the corresponding WordNet synset glosses. No staged draft enters a public bundle.\n\n**Required before use:** independently validate that each chosen lexical
sense is correct and appropriate to A1; independently review and revise
all Persian/English prose; settle attribution and commercial redistribution;
author separate exercises and new media with appropriate permission; create
SHA-bound evidence for final canonical assets and their public derivatives.
Until this happens, no staged draft is linked to the deployed app or to any
cleared rights assignment. The old 900-item canonical corpus, its historical
derivatives, and Gate 0 remain unchanged and blocked.

## Machine checks

- `npm run assurance:rights:inventory -- --check` verifies no entry, authored scene/contrast, or
  nested public-data JSON file is silently missing, that assigned sources exist,
  and that submitted item hash/evidence matches current content.
- `npm run assurance:rights:inventory -- --require-cleared` **fails** until
  every tracked item and governed media group has a cleared source and\ncurrent item/group evidence.
- `npm run assurance:provenance` reports combined source/item blockers.
- `npm run assurance:gate0` remains a hard release gate.
- `npm run validate:data` includes the non-bypassable rights inventory
  integrity check without pretending that all content is licensable today.

The code can ensure evidence coverage and prevent accidental changes from
silently inheriting a previous approval. It cannot authenticate a contract,
prove a clean-room process, or decide copyright/database-right questions.

## Do not confuse these statuses

- *Licensed source available* ≠ *an existing Oxford-derived item cleared*.
- *AI-authored explanation* ≠ *permission for upstream source selection*.
- *0 public lessons released* ≠ *all static files publicly accessible are
  compliant*. A deployment/access audit is still required.
- *Gate 0 provenance checks installed* ≠ *Gate 0 passed*.

Gate 0 must remain BLOCKED until legally supported, artifact-specific clearance
exists for every distributed canonical source and associated media.
