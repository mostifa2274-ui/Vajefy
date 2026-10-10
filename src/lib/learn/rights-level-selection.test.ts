import assert from "node:assert/strict";
import test from "node:test";
import { readCefrjRows, readNgslList } from "./rights-cefrj-selection";
import { buildLevelSelection, type LevelledRow } from "./rights-level-selection";

const cefrj = readCefrjRows([
  "headword,pos,CEFR,CoreInventory 1,CoreInventory 2,Threshold",
  "film,noun,A2,,,",
  "film,verb,B1,,,",
  "colour/color,noun,A1,,,",
  "May,noun,A1,,,",
  "may,modal auxiliary,A1,,,",
  "abandon,verb,B2,,,",
  "house,noun,A1,,,",
].join("\n") + "\n").map((r) => ({ ...r, source: "CEFR-J" as const }));
const octanove = readCefrjRows([
  "headword,pos,CEFR,notes",
  "exterior,noun,C1,",
  "cloak,noun,C2,",
  "abandon,noun,C1,",
  "batter,,C1,one who bats",
].join("\n") + "\n", ["C1", "C2"], true).map((r) => ({ ...r, source: "Octanove" as const }));

const input = (rows: LevelledRow[] = [...cefrj, ...octanove]) => ({
  rows,
  ngslCore: readNgslList("word,rank\nhouse,300\nfilm,700\ncolor,900\nmay,90\n", true),
  ngslSupplement: readNgslList("May\n", false),
  ngslExtension: readNgslList("word,rank\nabandon,4000\nexterior,6000\n", true),
  catalogue: [
    { id: "lex:A1:film", level: "A1" as const, headword: "film" },
    { id: "lex:A2:colour", level: "A2" as const, headword: "colour" },
    { id: "lex:A1:may", level: "A1" as const, headword: "May" },
    { id: "lex:B2x:abandon", level: "B2x" as const, headword: "abandon" },
    { id: "lex:C1:exterior", level: "C1" as const, headword: "exterior" },
    { id: "lex:B1:oh", level: "B1" as const, headword: "oh" },
    { id: "lex:B2x:zeal", level: "B2x" as const, headword: "zeal" },
  ],
});

test("places each word at its lowest level across CEFR-J and Octanove", () => {
  const s = buildLevelSelection(input());
  const level = (h: string) => s.words.find((w) => w.headword === h)!.level;
  assert.equal(level("film"), "A2");
  assert.equal(level("abandon"), "B2");
  assert.equal(level("exterior"), "C1");
  assert.equal(level("cloak"), "C2");
  assert.equal(s.words.find((w) => w.headword === "abandon")!.source, "CEFR-J");
});

test("moves, keeps and owner-keeps current entries; no entry drops out", () => {
  const s = buildLevelSelection(input());
  const e = (id: string) => s.entries.find((x) => x.entryId === id)!;
  assert.deepEqual([e("lex:A1:film").status, e("lex:A1:film").newLevel], ["MOVED", "A2"]);
  assert.deepEqual([e("lex:A2:colour").status, e("lex:A2:colour").newLevel], ["MOVED", "A1"]);
  assert.deepEqual([e("lex:B2x:abandon").status, e("lex:B2x:abandon").newLevel], ["SAME", "B2"]);
  assert.deepEqual([e("lex:C1:exterior").status, e("lex:C1:exterior").newLevel], ["SAME", "C1"]);
  assert.deepEqual([e("lex:B1:oh").status, e("lex:B1:oh").newLevel], ["OWNER_KEPT", "B1"]);
  assert.deepEqual([e("lex:B2x:zeal").status, e("lex:B2x:zeal").newLevel], ["OWNER_KEPT", "B2"]);
  assert.equal(s.entries.length, 7);
  assert.equal(s.counts.same + s.counts.moved + s.counts.ownerKept, 7);
});

test("capitals and spelling variants decide which word an entry teaches", () => {
  const s = buildLevelSelection(input());
  const w = (h: string) => s.words.find((x) => x.headword === h)!;
  assert.deepEqual(w("May").entryIds, ["lex:A1:may"]);
  assert.equal(w("may").status, "NEW");
  assert.deepEqual(w("colour/color").entryIds, ["lex:A2:colour"]);
  assert.equal(w("house").status, "NEW");
});

test("counts per level and stable word ids", () => {
  const s = buildLevelSelection(input());
  assert.deepEqual(s.counts.byLevel.A1, { words: 4, taught: 2, new: 2, ownerKeptEntries: 0, entriesAfter: 2 });
  assert.deepEqual(s.counts.byLevel.B2, { words: 1, taught: 1, new: 0, ownerKeptEntries: 1, entriesAfter: 2 });
  assert.equal(s.words.find((x) => x.level === "C2")!.wordId, "level:C2:0001");
  assert.deepEqual(buildLevelSelection(input()), s);
});

test("a blank Octanove part of speech is recorded as unspecified", () => {
  assert.equal(buildLevelSelection(input()).words.find((w) => w.headword === "batter")!.partsOfSpeech[0], "unspecified");
  assert.throws(() => readCefrjRows("headword,pos,CEFR\nbatter,,C1\n", ["C1"]), /empty headword or POS/);
});

test("rejects an unknown level", () => {
  assert.throws(() => buildLevelSelection(input([{ headword: "x", pos: "noun", level: "C3", source: "CEFR-J" }])), /unknown level/);
});
