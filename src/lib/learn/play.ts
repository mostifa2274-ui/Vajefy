import { bareHeadword, shuffle } from "./text";
import type { LexWord } from "./types";

export type PlayPair = {
  id: string;
  en: string;
  fa: string;
};

function firstSense(value: string): string {
  return (value.split(/[؛;]/)[0] ?? value).trim();
}

export function playPairs(words: LexWord[], count: number): PlayPair[] {
  const usedEn = new Set<string>();
  const usedFa = new Set<string>();
  const pairs: PlayPair[] = [];
  for (const word of shuffle(words)) {
    const en = bareHeadword(word.w);
    const fa = firstSense(word.fa);
    if (!en || !fa || en.length > 22 || fa.length > 28) continue;
    const enKey = en.toLowerCase();
    if (usedEn.has(enKey) || usedFa.has(fa)) continue;
    usedEn.add(enKey);
    usedFa.add(fa);
    pairs.push({ id: word.id, en, fa });
    if (pairs.length >= count) break;
  }
  return pairs;
}
