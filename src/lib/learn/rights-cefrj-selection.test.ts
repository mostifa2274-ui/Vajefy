import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCefrjSelection,
  matchKey,
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
  "May,noun,A1,,,",
  "may,modal auxiliary,A1,,,",
  "Miss,noun,A1,,,",
  "miss,verb,A2,,,",
  "about,preposition,A1,,,",
  "about,adverb,A1,,,",
].join("\r\n") + "\r\n";

const input = () => ({
  cefrj: readCefrjRows(cefrjCsv),
  ngslCore: readNgslList("word,rank\nlike,40\nhouse,300\ncolor,900\nfilm,700\nmay,90\nmiss,800\nabout,30\n", true),
  ngslSupplement: readNgslList("Monday\nMay\n", false),
  ngslExtension: readNgslList("word,rank\napple,5000\n", true),
  catalogue: [
    { id: "lex:A1:colour", headword: "colour", partsOfSpeech: ["noun"] },
    { id: "lex:A1:like-1", headword: "like (find sb/sth pleasant)", partsOfSpeech: ["verb"] },
    { id: "lex:A1:like-2", headword: "like (similar)", partsOfSpeech: ["preposition"] },
    { id: "lex:A1:film", headword: "film", partsOfSpeech: ["noun"] },
    { id: "lex:A1:foot", headword: "foot", partsOfSpeech: ["noun"] },
    { id: "lex:A1:oh", headword: "oh", partsOfSpeech: ["exclamation"] },
    { id: "lex:A1:may", headword: "May", partsOfSpeech: ["noun"] },
    { id: "lex:A1:miss", headword: "miss", partsOfSpeech: ["verb"] },
    { id: "lex:A1:about", headword: "about", partsOfSpeech: ["preposition"] },
  ],
});
const find = (s: ReturnType<typeof buildCefrjSelection>, h: string, pos: string) =>
  s.selected.find((x) => x.cefrjHeadword === h && x.pos === pos)!;

test("parses quoted CEFR-J fields that contain commas", () => {
  assert.deepEqual(parseCsv('a,"b, c",d\r\n'), [["a", "b, c", "d"]]);
  assert.throws(() => parseCsv('a,"b'), /unterminated/);
  assert.throws(() => readCefrjRows("headword,pos,CEFR\nx,noun,C3\n"), /unknown level/);
});

test("normalizes sense labels, superscripts and curly apostrophes; keeps capitals for matching", () => {
  assert.equal(normalizeHeadword("last¹ (final)"), "last");
  assert.equal(normalizeHeadword("o’clock"), "o'clock");
  assert.equal(matchKey("May"), "May");
  assert.equal(matchKey("like (similar)"), "like");
});

test("selects every CEFR-J A1 record and nothing graded higher", () => {
  const s = buildCefrjSelection(input());
  assert.equal(s.counts.records, 10);
  assert.equal(s.counts.headwords, 8);
  assert.ok(!s.selected.some((x) => ["film", "foot", "miss"].includes(x.cefrjHeadword)));
});

test("maps to NGSL tiers, with British and US spellings treated as one word", () => {
  const s = buildCefrjSelection(input());
  assert.deepEqual(find(s, "like", "verb").ngsl, { tier: "NGSL_1_2_CORE", lemma: "like", rank: 40 });
  assert.deepEqual(find(s, "colour/color", "noun").ngsl, { tier: "NGSL_1_2_CORE", lemma: "color", rank: 900 });
  assert.deepEqual(find(s, "apple", "noun").ngsl, { tier: "NGSL_SFI_31K_EXTENSION", lemma: "apple", rank: 5000 });
});

test("capitals keep different words apart", () => {
  const s = buildCefrjSelection(input());
  assert.deepEqual(find(s, "May", "noun").entryIds, ["lex:A1:may"]);
  assert.equal(find(s, "may", "modal auxiliary").courseStatus, "NEW");
  assert.equal(find(s, "Miss", "noun").courseStatus, "NEW");
  assert.deepEqual(s.retired.find((r) => r.entryId === "lex:A1:miss"), {
    entryId: "lex:A1:miss", headword: "miss", bestCefrjLevel: "A2",
  });
});

test("marks retained, new and retired, and reports untaught A1 parts of speech", () => {
  const s = buildCefrjSelection(input());
  assert.deepEqual(find(s, "like", "verb").entryIds, ["lex:A1:like-1", "lex:A1:like-2"]);
  assert.equal(find(s, "like", "preposition").posTaught, true);
  assert.equal(find(s, "about", "preposition").posTaught, true);
  assert.equal(find(s, "about", "adverb").courseStatus, "RETAINED");
  assert.equal(find(s, "about", "adverb").posTaught, false);
  assert.equal(find(s, "house", "noun").courseStatus, "NEW");
  assert.deepEqual(s.retired.map((r) => [r.entryId, r.bestCefrjLevel]), [
    ["lex:A1:film", "A2"], ["lex:A1:foot", "B1"], ["lex:A1:miss", "A2"], ["lex:A1:oh", "NOT_IN_CEFRJ"],
  ]);
  assert.deepEqual(
    { retained: s.counts.retained, new: s.counts.new, posNotTaught: s.counts.posNotTaught, retired: s.counts.retiredEntries },
    { retained: 4, new: 4, posNotTaught: 1, retired: 4 },
  );
});

test("a lesson whose part of speech CEFR-J labels differently is kept", () => {
  const s = buildCefrjSelection({
    ...input(),
    cefrj: readCefrjRows("headword,pos,CEFR\nhello,noun,A1\ntry,noun,A1\ntry,verb,A2\n"),
    catalogue: [
      { id: "lex:A1:hello", headword: "hello", partsOfSpeech: ["exclamation"] },
      { id: "lex:A1:try", headword: "try", partsOfSpeech: ["verb"] },
    ],
  });
  assert.deepEqual(s.retired, []);
  assert.equal(find(s, "try", "noun").courseStatus, "RETAINED");
  assert.equal(find(s, "try", "noun").posTaught, false);
});

test("rejects an unmapped part of speech and gives stable ids", () => {
  assert.throws(() => buildCefrjSelection({ ...input(), cefrj: readCefrjRows("headword,pos,CEFR\nx,gerund,A1\n") }), /no catalogue mapping/);
  const a = buildCefrjSelection(input());
  assert.deepEqual(a, buildCefrjSelection(input()));
  assert.equal(a.selected[0]?.selectionId, "cefrj-a1:0001");
});
