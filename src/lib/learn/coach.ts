import { createServerFn } from "@tanstack/react-start";
import type { Lang } from "./types";

// The handlers import ./coach.server lazily so none of it reaches the browser.

/** Whether notes can be written at all (the deployment has an xAI key). */
export const explainStatus = createServerFn({ method: "GET" }).handler(async () => ({
  available: Boolean(process.env.XAI_API_KEY),
}));

/**
 * A short usage note for one entry. Takes only an entry id: the prompt is
 * built from the dataset on the server, never from text the client sends.
 */
export const explainWord = createServerFn({ method: "POST" })
  .validator((input: { id: string; lang: Lang }) => {
    const id = typeof input?.id === "string" ? input.id : "";
    if (!/^[a-z]+:[A-Za-z0-9:_-]{1,160}$/.test(id)) throw new Error("invalid id");
    return { id, lang: input?.lang === "en" ? ("en" as const) : ("fa" as const) };
  })
  .handler(async ({ data }) => {
    const { explainEntry } = await import("./coach.server");
    return explainEntry(data.id, data.lang);
  });
