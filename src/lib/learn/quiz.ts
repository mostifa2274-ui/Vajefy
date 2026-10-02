import { posLabel, type Copy } from "./i18n";
import { bareHeadword, cloze, escapeReg, shuffle } from "./text";
import type { Antonym, Irregular, Lang, LexWord, PairNote, PatternItem, Question } from "./types";

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
    id: word.id,
    prompt: mode === "listen" ? copy.listenPrompt : word.w,
    promptDir: mode === "listen" ? "rtl" : "ltr",
    hint: mode === "listen" ? undefined : pos,
    speak: mode === "listen" ? bareHeadword(word.w) || word.w : undefined,
    options,
    answerKey: word.id,
    explain: word.ex,
    reveal: word.fa,
  };
}

export function chunkQuestions(
  items: PatternItem[],
  direction: "to-fa" | "to-en",
  count: number,
): Question[] {
  const questions: Question[] = [];
  for (const item of shuffle(items)) {
    if (questions.length >= count) break;
    if (!item.fa || !item.w) continue;
    const distractors = distinct(
      shuffle(items.filter((other) => other.id !== item.id && other.fa !== item.fa)),
      (a, b) => (direction === "to-fa" ? a.fa === b.fa : a.w === b.w),
      3,
    );
    if (distractors.length < 3) continue;
    const correct =
      direction === "to-fa"
        ? option(item.id, item.fa, "rtl")
        : option(item.id, item.w, "ltr");
    const rest = distractors.map((other) =>
      direction === "to-fa" ? option(other.id, other.fa, "rtl") : option(other.id, other.w, "ltr"),
    );
    questions.push({
      kind: "mcq",
      id: item.id,
      prompt: direction === "to-fa" ? item.w : item.fa,
      promptDir: direction === "to-fa" ? "ltr" : "rtl",
      options: shuffle([correct, ...rest]),
      answerKey: item.id,
      explain: item.ex || item.guide,
      reveal: direction === "to-fa" ? item.fa : item.w,
    });
  }
  return questions;
}

export function antonymQuestions(items: Antonym[], count: number): Question[] {
  const questions: Question[] = [];
  for (const item of shuffle(items)) {
    if (questions.length >= count) break;
    const distractors = distinct(
      shuffle(items.filter((other) => other.id !== item.id && other.b !== item.b)),
      (a, b) => a.b === b.b,
      3,
    );
    if (distractors.length < 3) continue;
    questions.push({
      kind: "mcq",
      id: item.id,
      prompt: item.a,
      promptDir: "ltr",
      options: shuffle([
        option(item.id, item.b, "ltr"),
        ...distractors.map((other) => option(other.id, other.b, "ltr")),
      ]),
      answerKey: item.id,
      explain: item.fa,
      reveal: item.b,
    });
  }
  return questions;
}

export function irregularQuestions(items: Irregular[], count: number): Question[] {
  return shuffle(items)
    .slice(0, count)
    .map((item) => ({
      kind: "irregular" as const,
      id: item.id,
      base: item.base,
      fa: item.fa,
      past: item.past,
      pp: item.pp,
      guide: item.guide,
    }));
}

export function confusingQuestions(items: PairNote[], count: number): Question[] {
  const questions: Question[] = [];
  for (const item of shuffle(items)) {
    if (questions.length >= count) break;
    const words = item.title
      .split("/")
      .map((part) => part.trim())
      .filter((part) => part && /^[A-Za-z][A-Za-z' -]*$/.test(part));
    if (words.length < 2) continue;
    const sentences = item.ex.split(/\s+\/\s+|\n+/).map((part) => part.trim()).filter(Boolean);
    const sentence = sentences.find((line) =>
      words.some((token) => new RegExp(`\\b${escapeReg(token)}\\b`, "i").test(line)),
    );
    if (!sentence) continue;
    const hit = words.find((token) => new RegExp(`\\b${escapeReg(token)}\\b`, "i").test(sentence));
    if (!hit) continue;
    const blanked = sentence.replace(new RegExp(`\\b${escapeReg(hit)}\\b`, "i"), "______");
    const unique = [...new Set(words)];
    questions.push({
      kind: "mcq",
      id: item.id,
      prompt: blanked,
      promptDir: "ltr",
      options: shuffle(unique.map((token) => option(token, token, "ltr"))),
      answerKey: hit,
      explain: item.guide,
      reveal: hit,
    });
  }
  return questions;
}
