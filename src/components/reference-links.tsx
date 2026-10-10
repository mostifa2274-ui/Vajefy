import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadA1ReferenceLinks } from "@/lib/learn/load";
import type { A1ReferenceLinks } from "@/lib/learn/a1-reference-links";
import type { Copy } from "@/lib/learn/i18n";

/** Optional course-linked reference, opened from the word it supports. */
export function ReferenceLinks({ entry, copy }: { entry: string; copy: Copy }) {
  const [links, setLinks] = useState<A1ReferenceLinks | null>(null);
  useEffect(() => {
    if (!entry.startsWith("lex:A1:")) return;
    let alive = true;
    void loadA1ReferenceLinks().then(value => {
      if (alive) setLinks(value);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [entry]);
  const ids = links?.entries[entry] ?? [];
  if (!ids.length) return null;
  return (
    <details className="mt-4 border-t border-line pt-3">
      <summary className="min-h-11 text-sm text-muted">{copy.referenceNotes}</summary>
      <ul className="grid gap-1">
        {ids.map(id => {
          const note = links!.notes[id]!;
          return (
            <li key={id}>
              <Link
                to="/library"
                search={{ d: note.deck, n: id }}
                lang="en"
                dir="ltr"
                className="inline-flex min-h-11 items-center text-sm text-accent"
              >
                {note.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
