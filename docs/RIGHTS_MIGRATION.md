# Gate 0 — redistribution rights and clean-source migration

Updated 2026-10-09. **Status: BLOCKED.** This is an evidence and engineering
procedure, not a legal opinion or an assertion that the existing material is licensed.

## Owner statement on ChatGPT-generated content — 2026-10-09

The project owner states: **“All lessons, existing audio, artwork, or historical repository content are made by chatgpt.”** The exact statement is preserved in `content/assurance/owner-authorship-attestation.json`. Its scope includes teaching materials, audio, artwork and historical repository content, but its evidence type is **owner-reported, not independently verified against per-item prompt/media histories**. The existing 5,322-word legacy selection plus 2,950 supplemental-record authorship inventory remains separately tracked and is not replaced by this record.

OpenAI's Terms of Use give users ownership of output **as between users and OpenAI, to the extent permitted by law**, while explicitly excluding others' outputs and third-party material. The user remains responsible for having permissions for the inputs. See https://openai.com/policies/terms-of-use/ (Content / Ownership of content). This statement therefore does **not** confirm whether protected third-party descriptions, selections, images or recordings were supplied as inputs. Some audio build evidence also documents separate offline synthesis models/voices, so each audio file and the model/voice redistribution terms require their own validation.

The owner statement is **not a licence grant, independent generation-history proof, or item-level release clearance**. `npm run assurance:rights:owner:check` validates this distinction, including the explicit categories, and runs inside `npm run validate:data`; its regression tests refuse fabricated permissions. The SHA-256-bound `content/assurance/rights-lineage.json` item evidence and `content/assurance/provenance.json` source permissions continue to determine Gate 0. The existing NGSL clean-source reconstruction remains necessary unless separately sufficient source-specific licences are obtained.

## Owner statement and rebuild decision — 2026-10-10

The owner states that **only the headword list** came from the
Oxford-derived workbook. All other teaching material was written with
ChatGPT, and no Oxford text was given as input. The owner chose to replace the
headword list with **every CEFR-J Wordlist 1.5 A1 headword** (1,066),
using NGSL 1.2 for frequency order and attribution, and to unfreeze Units 1–3.
The statement and answers are kept verbatim in
`content/assurance/owner-authorship-attestation.json` (`laterStatements`).
The owner then extended the rule to every level: each word in CEFR-J (A1–B2)
or the Octanove profile (C1–C2, CC BY-SA 4.0) goes to its lowest level, the
app's levels become A1–C2, and no current word drops out. The selections,
sources and the three-phase plan are in `docs/A1_CEFRJ_REBUILD.md`. This is the Path B reconstruction below, with the
selection made by a written rule over open sources rather than by relabelling
the Oxford roster. Gate 0 stays BLOCKED until the item, media and source
evidence is complete.

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

The second staging batch adds 25 more new Persian/English draft lessons for common daily verbs and concrete nouns. The 50/250 candidate coverage is **drafting progress only**, not a rights clearance fraction, CEFR qualification, licence finding or completed app migration. Source-sense keys are selected from a pinned independent intake but the intended definitions have **not** been checked against the corresponding WordNet synset glosses. No staged draft enters a public bundle.

**Required before use:** independently validate that each chosen lexical
sense is correct and appropriate to A1; independently review and revise
all Persian/English prose; settle attribution and commercial redistribution;
author separate exercises and new media with appropriate permission; create
SHA-bound evidence for final canonical assets and their public derivatives.
Until this happens, no staged draft is linked to the deployed app or to any
cleared rights assignment. The old 900-item canonical corpus, its historical
derivatives, and Gate 0 remain unchanged and blocked.

**Source-level clearance rule:** The provenance manifest refuses a source
labelled `cleared` unless its redistribution and derivative-work permissions
are explicit, its licence is identified, at least one supporting licence/rights
evidence reference is recorded, and its attribution requirement is resolved
(`required` or `not-required`, never `unknown`). These are machine-enforced
minimum fields, not verification of the authenticity or legal sufficiency of
the provided documents. The independent draft stage and all legacy source
assignments remain unapproved.

## Pinned synset verification — 2026-10-09

A read-only staging reference manifest now records all **250 exact OEWN 2025
source synsets**, including WNDB coordinates, synonym members, raw upstream
definition, gloss SHA-256 and immutable unreviewed status. Generation used the
official source archive with the pinned SHA-256 and offline regression tests;
see `scripts/rights/oewn_sense_references.py` and
`docs/OEWN_SOURCE_ATTRIBUTION.md` for full attribution and source links.

**Major discovered risk:** all 50 current independent bilingual drafts were
linked to WordNet sense numbers above 1. Several links are demonstrably
incompatible with the meaning taught: for instance `run`, `plate`, `be`,
`have` and `make`. This is a defect in the intake's **sense selection**,
not merely a proofreading issue. Non-primary sense numbering alone does not
prove an error; the actual synset must be checked independently. Do **not**
silently promote or substitute synonyms, or claim any of these 50 drafts
ready for A1. Selecting an actual intended sense and verifying translations
remains mandatory.

`npm run assurance:rights:drafts:check` now validates source-reference
coverage and hashes and reports the high-risk non-primary count. The new
source licence/attribution notice applies only to the OEWN-derived staging
synsets, **not** to existing Oxford-derived content. Source rights and all
existing learner-facing audio and content remain uncleared.

## Production deployment safety while Gate 0 remains blocked

The repository's production npm command now runs `assurance:gate0` **before**
building or uploading with Wrangler. A missing/invalid source or item licence,
derivative-work permission, media approval, or SHA-bound clearance causes
`npm run deploy` to refuse publication. Development builds, CI, and private
editorial staging remain usable so the independent OEWN migration can continue.

**Cloudflare Workers Builds requires an external dashboard setting.** Its
default deploy command is `npx wrangler deploy`, which **does not execute**
the npm `predeploy` hook. Configure the connected Worker's **Deploy command**
as `npm run deploy` (and keep the Build command as needed). The code change
cannot verify or change that external setting. Any other direct Wrangler,
Dashboard, or CI deploy path must be protected separately. No claim is made
that an already-active public Worker or public GitHub history has been removed
or is legally cleared.

Once source, item, and public-media evidence is genuinely complete, a successful
`npm run assurance:gate0` will permit the original production command again.
Do **not** set an override/bypass environment variable or fabricate a clearance
to get a deployment through.

## Machine checks

- `npm run assurance:rights:inventory -- --check` verifies no entry, authored scene/contrast, or
  nested public-data JSON file is silently missing, that assigned sources exist,
  and that submitted item hash/evidence matches current content.
- `npm run assurance:rights:inventory -- --require-cleared` **fails** until
  every tracked item and governed media group has a cleared source and
  current item/group evidence.
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
