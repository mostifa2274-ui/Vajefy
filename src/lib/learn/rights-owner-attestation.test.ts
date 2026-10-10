import assert from "node:assert/strict";
import test from "node:test";
import { attestationCannotClearRights, ownerAuthorshipAttestation } from "./rights-owner-attestation";
import { provenanceBlockers, provenanceManifest } from "./assurance";

const later = {
  "declaredOn": "2026-10-10",
  "declarant": "Project owner (user statement in Claude Code session)",
  "statement": "Map all words to ngsl list, all other materials except words are made of chatgpt",
  "answers": [
    {
      "question": "When the lessons were made with ChatGPT, was any Oxford text (definitions, example sentences, exercises) pasted in as input?",
      "answer": "No, only the words"
    },
    {
      "question": "How should the app's word list be based on NGSL?",
      "answer": "Rebuild by an NGSL rule"
    },
    {
      "question": "Which rule should choose the A1 words?",
      "answer": "All CEFR-J A1 (~1,060)"
    },
    {
      "question": "Frozen Units 1–3 lose about 18 words under the new rule. May I edit them?",
      "answer": "Yes, unfreeze them"
    }
  ],
  "scope": "Only the headword list came from the Oxford-derived workbook. Definitions, Persian text, examples, exercises and other teaching material were written with ChatGPT without Oxford text as input. The headword list is being replaced by the CEFR-J A1 selection (content/rights-staging/a1-rebuild/cefrj-a1-selection.json).",
  "claimKind": "OWNER_SELF_REPORTED_AUTHORSHIP_NOT_INDEPENDENTLY_VERIFIED",
  "legalEffect": "NO_RIGHTS_CLEARANCE_OR_LICENSE_GRANT"
};

const base = {
  schemaVersion: 1,
  declaredOn: "2026-10-09",
  declarant: "Project owner (user statement in ChatGPT conversation)",
  claimKind: "OWNER_SELF_REPORTED_AUTHORSHIP_NOT_INDEPENDENTLY_VERIFIED",
  declaration: "All lessons, existing audio, artwork, or historical repository content are made by chatgpt",
  categories: ["lessons", "audio", "artwork", "historical_repository_content"],
  claimedCreator: "ChatGPT",
  creationEvidence: "USER_STATEMENT_ONLY_NO_ITEM_LEVEL_GENERATION_LOG",
  mediaProductionEvidence: "NOT_FILE_BY_FILE_VERIFIED",
  thirdPartyInputRights: "NOT_ESTABLISHED_BY_THIS_STATEMENT",
  sourceSelectionRights: "NOT_ESTABLISHED_BY_THIS_STATEMENT",
  derivativeRedistributionRights: "NOT_ESTABLISHED_BY_THIS_STATEMENT",
  legalEffect: "NO_RIGHTS_CLEARANCE_OR_LICENSE_GRANT",
  gate0Effect: "GATE0_REMAINS_SUBJECT_TO_INDEPENDENT_SOURCE_AND_ITEM_EVIDENCE",
  notes: [
    "Owner statement is distinct from third-party licence verification.",
    "Output origin has not been checked against historical generation logs.",
    "Rights lineage and content hashes must still be approved separately.",
  ],
  laterStatements: [later],
} as const;

test("accepts owner-reported ChatGPT production without inventing a licence", () => {
  const value = ownerAuthorshipAttestation.parse({
    ...base, categories: [...base.categories], notes: [...base.notes],
  });
  assert.equal(attestationCannotClearRights(value), true);
});

test("refuses any automatic rights approval based only on user testimony", () => {
  for (const [key, proposed] of [
    ["legalEffect", "ALL_RIGHTS_CLEARED"],
    ["sourceSelectionRights", "ALLOWED"],
    ["thirdPartyInputRights", "VERIFIED"],
    ["derivativeRedistributionRights", "ALLOWED"],
    ["creationEvidence", "INDEPENDENTLY_VERIFIED"],
    ["gate0Effect", "GATE0_PASSED"],
  ] as const) {
    assert.equal(ownerAuthorshipAttestation.safeParse({
      ...base, categories: [...base.categories], notes: [...base.notes], [key]: proposed,
    }).success, false, key);
  }
});

test("refuses missing categories, duplicated categories and forged permissions", () => {
  const raw = { ...base, categories: [...base.categories], notes: [...base.notes] };
  assert.equal(ownerAuthorshipAttestation.safeParse({ ...raw, categories: ["lessons", "audio", "audio", "historical_repository_content"] }).success, false);
  assert.equal(ownerAuthorshipAttestation.safeParse({ ...raw, categories: ["lessons", "audio", "artwork"] }).success, false);
  assert.equal(ownerAuthorshipAttestation.safeParse({ ...raw, redistribution: "allowed" }).success, false);
});

test("separate unverified Oxford input rights still block Gate 0", () => {
  ownerAuthorshipAttestation.parse({ ...base, categories: [...base.categories], notes: [...base.notes] });
  const rights = provenanceManifest.parse({
    schemaVersion: 1, sources: [{
      id: "legacy-oxford-3000-5000-workbook",
      name: "Legacy source", version: "1", source: "unverified-workbook",
      license: "UNVERIFIED", redistribution: "unverified",
      derivatives: "unverified", attribution: "unknown",
      status: "unverified", evidence: [],
    }],
  });
  assert.ok(provenanceBlockers(rights).length > 0);
});

test("binds the 2026-10-10 owner statement verbatim and grants no rights", () => {
  const raw = { ...base, categories: [...base.categories], notes: [...base.notes] };
  const value = ownerAuthorshipAttestation.parse(raw);
  assert.equal(attestationCannotClearRights(value), true);
  const reject = (changed: unknown) =>
    assert.equal(ownerAuthorshipAttestation.safeParse({ ...raw, laterStatements: changed }).success, false);
  reject(undefined);
  reject([]);
  reject([{ ...later, statement: "All words come from NGSL." }]);
  reject([{ ...later, answers: later.answers.slice(1) }]);
  reject([{ ...later, answers: [{ ...later.answers[0], answer: "Yes, some Oxford text" }, ...later.answers.slice(1)] }]);
  reject([{ ...later, legalEffect: "RIGHTS_CLEARED" }]);
  reject([{ ...later, licence: "granted" }]);
});
