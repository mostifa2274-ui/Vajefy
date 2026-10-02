import assert from "node:assert/strict";
import test from "node:test";
import { gradeSpelling, searchKey, spellings } from "./text";

test("American spellings of British headwords are exact answers", () => {
  for (const [british, american] of [
    ["centre", "center"],
    ["metre", "meter"],
    ["theatre", "theater"],
    ["programme", "program"],
    ["dialogue", "dialog"],
    ["grey", "gray"],
    ["tyre", "tire"],
    ["mum", "mom"],
    ["jewellery", "jewelry"],
    ["colour", "color"],
  ]) {
    assert.equal(gradeSpelling(american, british), "exact", `${american} for ${british}`);
    assert.equal(gradeSpelling(british, british), "exact");
  }
});

test("look-alike words are not accepted as variants", () => {
  assert.equal(gradeSpelling("for", "four"), "wrong");
  assert.equal(gradeSpelling("tor", "tour"), "wrong");
  assert.deepEqual(spellings("hour"), ["hour"]);
});

test("one-letter typos on longer words still count as close", () => {
  assert.equal(gradeSpelling("collor", "colour"), "close");
  assert.equal(gradeSpelling("gry", "grey"), "wrong");
});

test("Persian search ignores keyboard and spacing differences", () => {
  const data = searchKey("کتاب‌خانه؛ دست‌دوم");
  for (const typed of ["كتاب", "کتابخانه", "كتاب خانه", "دست دوم", "دستدوم", "دست‌دوم"]) {
    assert.ok(data.includes(searchKey(typed)), typed);
  }
});

test("search keys drop diacritics and fold English case", () => {
  assert.equal(searchKey("مُعَلِّم"), searchKey("معلم"));
  assert.equal(searchKey("Look After"), "lookafter");
});
