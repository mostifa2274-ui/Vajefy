import { z } from "zod";

const deck = z.enum(["irr", "pv", "col", "prep", "vp", "fam", "wf", "syn", "conf", "ant", "occ"]);

/** Generated from the actual A1 catalogue links, never from a search substring. */
export const a1ReferenceLinks = z.object({
  schemaVersion: z.literal(1),
  level: z.literal("A1"),
  entries: z.record(z.string().startsWith("lex:A1:").min(8), z.array(z.string().min(1)).min(1)),
  notes: z.record(z.string().min(1), z.object({ deck, title: z.string().min(1) }).strict()),
}).strict().superRefine((value, ctx) => {
  const referenced = new Set<string>();
  for (const [entry, ids] of Object.entries(value.entries)) {
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", path: ["entries", entry], message: "Duplicate reference link" });
    }
    for (const id of ids) {
      referenced.add(id);
      if (!value.notes[id]) {
        ctx.addIssue({ code: "custom", path: ["entries", entry], message: "Missing reference note: " + id });
      }
    }
  }
  for (const [id, note] of Object.entries(value.notes)) {
    if (!id.startsWith(note.deck + ":") || !referenced.has(id)) {
      ctx.addIssue({ code: "custom", path: ["notes", id], message: "Note lacks a matching A1 link and deck" });
    }
  }
});

export type A1ReferenceLinks = z.infer<typeof a1ReferenceLinks>;
