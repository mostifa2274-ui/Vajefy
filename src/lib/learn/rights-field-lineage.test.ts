import assert from "node:assert/strict";
import test from "node:test";
import {
  AI_AUTHORSHIP_REPORT, LIST_SOURCE, RIGHTS_PENDING,
  authoredFieldsOf, selectionFieldsOf, requireUncleared,
} from "./rights-field-lineage";

test("Oxford-derived headword identity is tracked separately from reported ChatGPT output", () => {
  const item = {
    id: "lex:A1:apple", w: "apple", pr: "اَپِل",
    ipa: "/ˈæpəl/", pos: "noun", fa: "سیب",
    ex: "An apple is on the table.", tr: "یک سیب روی میز است.",
  };
  assert.deepEqual(selectionFieldsOf(item), ["w"]);
  assert.deepEqual(authoredFieldsOf(item), ["ex","fa","ipa","pos","pr","tr"]);
});

test("supplementary selectors are not misrepresented as ChatGPT-created translations", () => {
  const row = {
    id: "ant:test", a: "day", b: "night", band: 2,
    fa: "روز/شب", guide: "دو واژه با معنای متضاد",
  };
  assert.deepEqual(selectionFieldsOf(row), ["a","b","band"]);
  assert.deepEqual(authoredFieldsOf(row), ["fa","guide"]);
});

test("reported authorship can never upgrade a row to redistributed or legally approved", () => {
  const base = {
    selectionProvenance: LIST_SOURCE,
    aiAuthorship: AI_AUTHORSHIP_REPORT,
    rightsStatus: RIGHTS_PENDING,
  };
  assert.doesNotThrow(() => requireUncleared(base));
  assert.throws(() => requireUncleared({ ...base, rightsStatus: "CLEARED" }), /cannot grant/);
  assert.throws(() => requireUncleared({ ...base, selectionProvenance: "PUBLIC_DOMAIN" }), /cannot grant/);
  assert.throws(() => requireUncleared({ ...base, aiAuthorship: "COPYRIGHT_CLEARED" }), /cannot grant/);
});
