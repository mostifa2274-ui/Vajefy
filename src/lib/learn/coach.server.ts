import { getRequestIP } from "@tanstack/react-start/server";
import { entryFile, entryText, type EntryText } from "./entry-text";
import { createLimiter, createLru } from "./limits";
import type { Lang } from "./types";

// The same JSON the browser fetches from /data, bundled into server chunks
// (one lazy chunk per file) so the prompt is built only from the dataset.
const FILES = import.meta.glob<Record<string, unknown>[]>("/public/data/*.json", { import: "default" });

export type ExplainResult =
  | { ok: true; text: string }
  | { ok: false; error: "unavailable" | "missing" | "busy" | "failed" };

const answers = createLru<string>(2000);
const indexes = new Map<string, Promise<Map<string, Record<string, unknown>>>>();
// A learner opens a few notes a session; these bound what one client, and all
// clients on one server instance, can spend of the owner's xAI quota.
const perClient = createLimiter({ limit: 20, windowMs: 10 * 60_000 });
const overall = createLimiter({ limit: 600, windowMs: 60 * 60_000 });

function rowsById(file: string) {
  let index = indexes.get(file);
  if (!index) {
    const load = FILES[`/public/data/${file}`];
    if (!load) return null;
    index = load().then((rows) => new Map(rows.map((row) => [String(row.id), row])));
    index.catch(() => indexes.delete(file));
    indexes.set(file, index);
  }
  return index;
}

async function lookup(id: string): Promise<EntryText | null> {
  const file = entryFile(id);
  const index = file ? rowsById(file) : null;
  const row = index ? (await index).get(id) : undefined;
  return row ? entryText(id, row) : null;
}

function clip(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export async function explainEntry(id: string, lang: Lang): Promise<ExplainResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "unavailable" };

  const key = `${lang}\n${id}`;
  const cached = answers.get(key);
  if (cached) return { ok: true, text: cached };

  const entry = await lookup(id);
  if (!entry) return { ok: false, error: "missing" };

  const client = getRequestIP({ xForwardedFor: true }) ?? "unknown";
  if (!perClient.take(client) || !overall.take("all")) return { ok: false, error: "busy" };

  const language = lang === "fa" ? "Persian" : "English";
  let res: Response;
  try {
    res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(15_000),
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
            content: `Word: ${clip(entry.word, 120)}\nPart of speech: ${clip(entry.pos, 40) || "unknown"}\nGloss: ${clip(entry.meaning, 400)}\nExample: ${clip(entry.example, 300) || "none"}`,
          },
        ],
      }),
    });
  } catch {
    return { ok: false, error: "failed" };
  }

  if (!res.ok) return { ok: false, error: "failed" };
  const body = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
  const text = clip(body?.choices?.[0]?.message?.content ?? "", 700);
  if (!text) return { ok: false, error: "failed" };
  answers.set(key, text);
  return { ok: true, text };
}
