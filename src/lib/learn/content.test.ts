import assert from "node:assert/strict";
import { test } from "node:test";
import { headwordOf } from "./content";

test("a dataset headword loses its homograph number and sense qualifier", () => {
  assert.equal(headwordOf("long¹"), "long");
  assert.equal(headwordOf("can²"), "can");
  assert.equal(headwordOf("last¹ (final)"), "last");
  assert.equal(headwordOf("lie² (tell a lie)"), "lie");
  assert.equal(headwordOf("bank (money)"), "bank");
  assert.equal(headwordOf("like (find sb/sth pleasant)"), "like");
  assert.equal(headwordOf("next to"), "next to");
  assert.equal(headwordOf("a, an"), "a, an");
});
