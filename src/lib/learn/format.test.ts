import assert from "node:assert/strict";
import test from "node:test";
import { formatFor } from "./format";

test("numbers use Persian digits once the language is known, and each format is built once", () => {
  assert.equal(formatFor("fa", true).num(1234), "۱٬۲۳۴");
  assert.equal(formatFor("fa", true).pct(0.5), "۵۰٪");
  assert.equal(formatFor("en", true).num(1234), "1,234");
  // Before the saved language loads, numbers match the server render.
  assert.equal(formatFor("fa", false).num(1234), "1234");
  assert.equal(formatFor("fa", false).pct(0.5), "50%");
  assert.equal(formatFor("fa", true), formatFor("fa", true));
  assert.equal(formatFor("fa", true).sep, "، ");
});
