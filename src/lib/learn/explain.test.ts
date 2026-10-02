import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { entryFile, entryText } from "./entry-text";
import { createLimiter, createLru } from "./limits";

const DATA = "public/data";
const read = (file: string) => JSON.parse(readFileSync(`${DATA}/${file}`, "utf8")) as Record<string, unknown>[];

test("every entry in every data file resolves to its file and a usable prompt", () => {
  for (const file of readdirSync(DATA).filter((name) => name.endsWith(".json") && name !== "meta.json")) {
    const rows = read(file);
    const unresolved = rows.filter((row) => entryFile(String(row.id)) !== file);
    assert.deepEqual(unresolved.map((row) => row.id), [], `${file}: ids that map to another file`);
    const empty = rows.filter((row) => !entryText(String(row.id), row));
    assert.deepEqual(empty.map((row) => row.id), [], `${file}: entries without word or meaning`);
  }
});

test("unknown ids do not resolve", () => {
  assert.equal(entryFile("lex:Z9:about"), null);
  assert.equal(entryFile("nope:about"), null);
  assert.equal(entryFile("constructor:x"), null);
});

test("prompt text drops the bidi isolates used in the data", () => {
  const entry = entryText("conf:x", { pair: "do / make", guide: "⁦do⁩ یعنی انجام", ex: "" });
  assert.equal(entry?.meaning, "do یعنی انجام");
});

test("the limiter allows `limit` hits per window and then refuses", () => {
  const limiter = createLimiter({ limit: 2, windowMs: 1000 });
  assert.equal(limiter.take("a", 0), true);
  assert.equal(limiter.take("a", 10), true);
  assert.equal(limiter.take("a", 20), false);
  assert.equal(limiter.take("b", 20), true);
  assert.equal(limiter.take("a", 1011), true);
});

test("the limiter forgets the oldest keys past its bound", () => {
  const limiter = createLimiter({ limit: 1, windowMs: 1000, maxKeys: 2 });
  limiter.take("a", 0);
  limiter.take("b", 0);
  limiter.take("c", 0);
  assert.equal(limiter.take("a", 1), true);
});

test("the LRU keeps recently used entries", () => {
  const lru = createLru<number>(2);
  lru.set("a", 1);
  lru.set("b", 2);
  lru.get("a");
  lru.set("c", 3);
  assert.equal(lru.get("b"), undefined);
  assert.equal(lru.get("a"), 1);
  assert.equal(lru.size, 2);
});
