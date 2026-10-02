import { createServerFn } from "@tanstack/react-start";

type Ask = {
  word: string;
  meaning: string;
  example: string;
  pos: string;
  lang: "fa" | "en";
};

const cache = new Map<string, string>();

function clip(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export const explainWord = createServerFn({ method: "POST" })
  .validator((input: Ask): Ask => {
    const word = clip(input?.word, 80);
    const meaning = clip(input?.meaning, 280);
    const example = clip(input?.example, 280);
    const pos = clip(input?.pos, 40);
    const lang = input?.lang === "en" ? "en" : "fa";
    if (!word || !meaning) throw new Error("missing");
    return { word, meaning, example, pos, lang };
  })
  .handler(async ({ data }) => {
    const key = `${data.lang}\n${data.word}\n${data.meaning}`;
    const hit = cache.get(key);
    if (hit) return { ok: true as const, text: hit };

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "unavailable" as const };

    const language = data.lang === "fa" ? "Persian" : "English";
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 180,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: `You tutor English for a ${language}-speaking learner. Write exactly three short sentences in ${language}. Sentence 1: when to use the word. Sentence 2: one close word to avoid mixing up, if any. Sentence 3: a tiny usage note. No headings, no lists, no markdown.`,
          },
          {
            role: "user",
            content: `Word: ${data.word}\nPart of speech: ${data.pos || "unknown"}\nGloss: ${data.meaning}\nExample: ${data.example || "none"}`,
          },
        ],
      }),
    });

    if (!res.ok) return { ok: false as const, error: "failed" as const };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = clip(body.choices?.[0]?.message?.content, 700);
    if (!text) return { ok: false as const, error: "failed" as const };
    cache.set(key, text);
    return { ok: true as const, text };
  });
