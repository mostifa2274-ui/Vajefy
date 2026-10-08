import assert from "node:assert/strict";
import { test } from "node:test";
import type { CheckItem } from "./content";
import { taskSupportIssues } from "./task-support";

const cloze: CheckItem = {
  type: "cloze",
  id: "c1",
  text: "___ book",
  answer: "my",
  accept: [],
  fa: "کتاب من",
  why: "my پیش از اسم",
  support: [{ en: "book", fa: "کتاب" }],
};

test("glosses visible context without leaking the missing answer", () => {
  assert.deepEqual(taskSupportIssues(cloze), []);
  assert.match(
    taskSupportIssues({
      ...cloze,
      support: [{ en: "my", fa: "من" }],
    })[0] ?? "",
    /not visible/,
  );
  assert.match(
    taskSupportIssues({
      ...cloze,
      text: "My ___ is here.",
      answer: "book",
      support: [{ en: "book", fa: "کتاب" }],
    })[0] ?? "",
    /not visible/,
  );
});

test("a visible gloss containing a missing or accepted answer is rejected", () => {
  const item: CheckItem = {
    ...cloze,
    text: "What is my ___?",
    answer: "name",
    accept: ["my name"],
    support: [{ en: "my name", fa: "نام من" }],
  };
  assert.match(taskSupportIssues(item).join(" "), /not visible/);

  const leaking: CheckItem = {
    ...cloze,
    text: "Choose my ___ book.",
    answer: "my",
    support: [{ en: "my", fa: "من" }],
  };
  assert.match(taskSupportIssues(leaking).join(" "), /reveals a correct answer/);

  const accepted: CheckItem = {
    ...cloze,
    text: "We\u0027re ___ ready.",
    answer: "are",
    accept: ["we're"],
    support: [{ en: "we're", fa: "ما هستیم" }],
  };
  assert.match(taskSupportIssues(accepted).join(" "), /reveals a correct answer/);
});

test("shared choice vocabulary may be glossed, but a discriminating option may not", () => {
  const choice: CheckItem = {
    type: "choice",
    id: "q1",
    prompt: "کدام عبارت یعنی کتاب من؟",
    options: [
      { text: "my book", ok: true, why: "درست" },
      { text: "I book", ok: false, why: "نادرست" },
      { text: "you book", ok: false, why: "نادرست" },
    ],
    support: [{ en: "book", fa: "کتاب" }],
  };
  assert.deepEqual(taskSupportIssues(choice), []);
  assert.match(
    taskSupportIssues({
      ...choice,
      support: [{ en: "my", fa: "من" }],
    }).join(" "),
    /only 1\/3 choices/,
  );
  assert.deepEqual(
    taskSupportIssues({
      ...choice,
      prompt: "Which book?",
      support: [{ en: "Which", fa: "کدام" }],
    }),
    [],
  );
});

test("glosses are whole-token, visibly grounded and not duplicated", () => {
  assert.deepEqual(
    taskSupportIssues({
      ...cloze,
      text: "___ cat",
      answer: "my",
      support: [{ en: "a", fa: "یک" }],
    }),
    ['support "a" is not visible in the task text'],
  );
  assert.match(
    taskSupportIssues({
      ...cloze,
      support: [{ en: "book", fa: "کتاب" }, { en: "BOOK", fa: "کتاب" }],
    }).join(" "),
    /repeats the gloss/,
  );
});
