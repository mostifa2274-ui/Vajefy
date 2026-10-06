import { posLabel, type Copy } from "./i18n";
import { bareHeadword, cloze, shuffle } from "./text";
import type { Lang, LexWord, Question } from "./types";

function option(key: string, text: string, dir: "ltr" | "rtl") {
  return { key, text, dir };
}

function headKey(word: LexWord): string {
  return (bareHeadword(word.w) || word.w).toLowerCase();
}

function distinct<T>(items: T[], same: (a: T, b: T) => boolean, count: number): T[] {
  const picked: T[] = [];
  for (const item of items) {
    if (picked.length >= count) break;
    if (picked.some((have) => same(have, item))) continue;
    picked.push(item);
  }
  return picked;
}

export function lexQuestions(
  words: LexWord[],
  mode: "to-fa" | "to-en" | "spell" | "cloze" | "listen",
  count: number,
  copy: Copy,
  lang: Lang = "fa",
): Question[] {
  const questions: Question[] = [];
  for (const word of shuffle(words)) {
    if (questions.length >= count) break;
    const made = lexQuestion(word, words, mode, copy, lang);
    if (made) questions.push(made);
  }
  return questions;
}

export function lexQuestion(
  word: LexWord,
  pool: LexWord[],
  mode: "to-fa" | "to-en" | "spell" | "cloze" | "listen",
  copy: Copy,
  lang: Lang = "fa",
): Question | null {
  if (!word.fa || !word.w) return null;
  const pos = posLabel(word.pos, lang);
  // Homographs (like "similar" / like "enjoy") share a spelling and a sound,
  // so one can never be a wrong option for the other.
  const target = headKey(word);
  const others = shuffle(
    pool.filter((item) => item.id !== word.id && item.fa && item.fa !== word.fa && headKey(item) !== target),
  );
  const samePos = others.filter((item) => word.pos && item.pos === word.pos);
  const distractors = distinct(
    [...samePos, ...others],
    (a, b) => a.fa === b.fa || headKey(a) === headKey(b),
    3,
  );
  if (mode !== "spell" && distractors.length < 3) return null;

  if (mode === "spell") {
    return {
      kind: "type",
      practiceSkill: "spelling",
      id: word.id,
      prompt: word.fa,
      promptDir: "rtl",
      hint: [pos, word.ipa].filter(Boolean).join(" · "),
      answer: bareHeadword(word.w) || word.w,
      accept: [word.w, bareHeadword(word.w)].filter(Boolean),
      explain: word.ex,
    };
  }

  if (mode === "cloze") {
    const blank = cloze(word.ex, word.w);
    if (!blank) return null;
    const choices = distinct(
      [word, ...shuffle(pool.filter((item) => item.id !== word.id))],
      (a, b) => headKey(a) === headKey(b),
      4,
    );
    if (choices.length < 4) return null;
    const options = shuffle(
      choices.map((item) => option(item.id, bareHeadword(item.w) || item.w, "ltr")),
    );
    return {
      kind: "mcq",
      practiceSkill: "context",
      id: word.id,
      prompt: blank,
      promptDir: "ltr",
      hint: word.fa,
      options,
      answerKey: word.id,
      explain: word.ex,
      reveal: bareHeadword(word.w) || word.w,
    };
  }

  if (mode === "to-en") {
    const options = shuffle([
      option(word.id, bareHeadword(word.w) || word.w, "ltr"),
      ...distractors.map((item) => option(item.id, bareHeadword(item.w) || item.w, "ltr")),
    ]);
    return {
      kind: "mcq",
      practiceSkill: "meaning",
      id: word.id,
      prompt: word.fa,
      promptDir: "rtl",
      hint: pos,
      options,
      answerKey: word.id,
      explain: word.ex,
      reveal: word.w,
    };
  }

  const options = shuffle([
    option(word.id, word.fa, "rtl"),
    ...distractors.map((item) => option(item.id, item.fa, "rtl")),
  ]);
  return {
    kind: "mcq",
    practiceSkill: mode === "listen" ? "listening" : "meaning",
    id: word.id,
    prompt: mode === "listen" ? copy.listenPrompt : word.w,
    promptDir: mode === "listen" && lang === "fa" ? "rtl" : "ltr",
    hint: mode === "listen" ? undefined : pos,
    speak: mode === "listen" ? bareHeadword(word.w) || word.w : undefined,
    options,
    answerKey: word.id,
    explain: word.ex,
    reveal: word.fa,
  };
}
