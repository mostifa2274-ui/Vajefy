import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Copy } from "./i18n";
import { lexQuestion } from "./quiz";
import { bareHeadword, cloze } from "./text";
import type { LexWord } from "./types";

const copy = { listenPrompt: "?" } as Copy;
const level = (name: string) => JSON.parse(readFileSync(`public/data/lex-${name}.json`, "utf8")) as LexWord[];
const head = (word: LexWord) => (bareHeadword(word.w) || word.w).toLowerCase();

test("a homograph is never offered as a wrong option for its twin", () => {
  for (const name of ["a1", "a2", "b1", "b2", "b2x", "c1"]) {
    const words = level(name);
    const byId = new Map(words.map((word) => [word.id, word]));
    const twins = words.filter((word) => words.some((other) => other.id !== word.id && head(other) === head(word)));
    for (const word of twins) {
      for (const mode of ["to-en", "to-fa", "listen"] as const) {
        for (let round = 0; round < 200; round++) {
          const question = lexQuestion(word, words, mode, copy);
          if (question?.kind !== "mcq") continue;
          const clash = question.options.filter((option) => option.key !== word.id && head(byId.get(option.key)!) === head(word));
          assert.deepEqual(clash, [], `${name} ${mode} ${word.id}`);
        }
      }
    }
  }
});

test("cloze finds regular inflections and blanks every occurrence", () => {
  assert.equal(cloze("The class begins at nine.", "begin"), "The class ______ at nine.");
  assert.equal(cloze("This book costs ten dollars.", "dollar"), "This book costs ten ______.");
  assert.equal(cloze("A rainbow appeared after the rain.", "appear"), "A rainbow ______ after the rain.");
  assert.equal(cloze("She is studying hard.", "study"), "She is ______ hard.");
  assert.equal(cloze("He is as tall as his brother.", "as"), "He is ______ tall ______ his brother.");
  assert.equal(cloze("Nothing to see.", "begin"), null);
});

test("most headwords can be clozed", () => {
  let eligible = 0;
  let total = 0;
  for (const name of ["a1", "a2", "b1", "b2", "b2x", "c1"]) {
    for (const word of level(name)) {
      total += 1;
      if (cloze(word.ex, word.w)) eligible += 1;
    }
  }
  assert.ok(eligible / total > 0.95, `${eligible} / ${total}`);
});
