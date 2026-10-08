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

`rights-lineage.json` now explicitly accounts for the 900 A1 source entries
all 21 top-level public JSON files (including the non-A1 source catalogue),\nand two governed media groups: all published audio and published site artwork.
Generated `public/data/enhanced/**` is tied to the A1 source entries; audio,
illustration and any other media also need independent upstream/model/artist
rights evidence before a public release is approved. Merely moving those assets
outside this manifest is **not** legal clearance.

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
   `clearedEvidence.publicData` or `clearedEvidence.mediaGroups`.
3. Update the corresponding explicit `sourceAssignments` to a verifiably
   cleared `content/assurance/provenance.json` source. Keep any legacy
   attribution and historic proof separately; do not fabricate a source link.
4. Repeat for public JSON files and separately governed media groups; audit shipped media,
   model/voice terms, illustrations, licence notices and generated works.
5. Verify licence compatibility and attribution in the actual UI/build output.
   For a legal interpretation that remains ambiguous, obtain rights-holder
   confirmation or professional advice. An internal AI review is not a licence.

## Machine checks

- `npm run assurance:rights:inventory -- --check` verifies no entry or
  top-level public-data file is silently missing, that assigned sources exist,
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
