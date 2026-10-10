import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCefrjSelection,
  normalizeHeadword,
  parseCsv,
  readCefrjRows,
  readNgslList,
} from "./rights-cefrj-selection";

const cefrjCsv = [
  "headword,pos,CEFR,CoreInventory 1,CoreInventory 2,Threshold",
  'apple,noun,A1,Food and drink,,"Food, drink"',
  "colour/color,noun,A1,,,",
  "film,noun,A2,,,",
  "like,verb,A1,,,",
  "like,preposition,A1,,,",
  "foot,noun,B1,,,",
  "house,noun,A1,,,",
].join("\r\n") + "\r\n";

const input = () => ({
  cefrj: readCefrjRows(cefrjCsv),
  ngslCore: readNgslList("word,rank\nlike,40\nhouse,300\ncolor,900\nfilm,700\n", true),
  ngslSupplement: readNgslList("Monday\n", false),
  ngslExtension: readNgslList("word,rank\napple,5000\n", true),
  catalogue: [
    { id: "lex:A1:colour", headword: "colour" },
    { id: "lex:A1:like-1", headword: "like (find sb/sth pleasant)" },
    { id: "lex:A1:like-2", headword: "like (similar)" },
    { id: "lex:A1:film", headword: "film" },
    { id: "lex:A1:foot", headword: "foot" },
    { id: "lex:A1:oh", headword: "oh" },
  ],
});

test("parses quoted CEFR-J fields that contain commas", () => {
  assert.deepEqual(parseCsv('a,"b, c",d\r\n'), [["a", "b, c", "d"]]);
  assert.throws(() => parseCsv('a,"b'), /unterminated/);
  assert.throws(() => readCefrjRows("headword,pos,CEFR\nx,noun,C3\n"), /unknown level/);
});

test("normalizes sense labels, superscripts and curly apostrophes", () => {
  assert.equal(normalizeHeadword("last¹ (final)"), "last");
  assert.equal(normalizeHeadword("o’clock"), "o'clock");
  assert.equal(normalizeHeadword("Monday"), "monday");
});

test("selects every CEFR-J A1 headword and nothing graded higher", () => {
  const s = buildCefrjSelection(input());
  assert.deepEqual(s.selected.map((x) => x.cefrjHeadword), ["like", "house", "colour/color", "apple"]);
  assert.equal(s.counts.selected, 4);
  assert.ok(!s.selected.some((x) => x.cefrjHeadword === "film" || x.cefrjHeadword === "foot"));
});

test("maps to NGSL tiers, with British and US spellings treated as one word", () => {
  const s = buildCefrjSelection(input());
  const by = (h: string) => s.selected.find((x) => x.cefrjHeadword === h)!;
  assert.deepEqual(by("like").ngsl, { tier: "NGSL_1_2_CORE", lemma: "like", rank: 40 });
  assert.deepEqual(by("colour/color").ngsl, { tier: "NGSL_1_2_CORE", lemma: "color", rank: 900 });
  assert.deepEqual(by("apple").ngsl, { tier: "NGSL_SFI_31K_EXTENSION", lemma: "apple", rank: 5000 });
  assert.equal(s.counts.byNgslTier.NGSL_SFI_31K_EXTENSION, 1);
});

test("marks retained, new and retired against the current catalogue", () => {
  const s = buildCefrjSelection(input());
  const by = (h: string) => s.selected.find((x) => x.cefrjHeadword === h)!;
  assert.deepEqual(by("like").entryIds, ["lex:A1:like-1", "lex:A1:like-2"]);
  assert.equal(by("colour/color").courseStatus, "RETAINED");
  assert.equal(by("house").courseStatus, "NEW");
  assert.deepEqual(s.retired, [
    { entryId: "lex:A1:film", headword: "film", bestCefrjLevel: "A2" },
    { entryId: "lex:A1:foot", headword: "foot", bestCefrjLevel: "B1" },
    { entryId: "lex:A1:oh", headword: "oh", bestCefrjLevel: "NOT_IN_CEFRJ" },
  ]);
  assert.deepEqual(
    { retained: s.counts.retained, new: s.counts.new, retired: s.counts.retiredEntries },
    { retained: 2, new: 2, retired: 3 },
  );
});

test("selection ids follow NGSL order and are stable", () => {
  const a = buildCefrjSelection(input());
  const b = buildCefrjSelection(input());
  assert.deepEqual(a, b);
  assert.equal(a.selected[0]?.selectionId, "cefrj-a1:0001");
});
