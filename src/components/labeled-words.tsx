import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { entryIdOf } from "@/lib/learn/targets";
import { loadLevel } from "@/lib/learn/load";
import { loadPilot } from "@/lib/learn/pilot";
import { levelOf } from "@/lib/learn/text";
import type { LevelId } from "@/lib/learn/types";
import { Num } from "./ui";
import { Fa } from "./mixed-text";

export function LabeledWords({
  ids,
  meta,
}: {
  ids: string[];
  meta?: Record<string, number>;
}) {
  const [loaded, setLoaded] = useState<{
    key: string;
    rows: { id: string; w: string; fa: string }[];
  }>({ key: "", rows: [] });
  const key = ids.join("|");

  useEffect(() => {
    let alive = true;
    const wanted = ids;
    if (!wanted.length) return;
    const levels = [...new Set(wanted.map((id) => levelOf(id)).filter((level): level is LevelId => Boolean(level)))];
    const senses = wanted.some((id) => id.includes("#")) ? loadPilot().catch(() => null) : Promise.resolve(null);
    void Promise.all([Promise.all(levels.map((level) => loadLevel(level))), senses]).then(([lists, pilot]) => {
      if (!alive) return;
      const byId = new Map(lists.flat().map((word) => [word.id, word]));
      setLoaded({
        key,
        rows: wanted.flatMap((id) => {
          // A further sense of a word shows that sense's own meaning.
          const target = pilot?.bySense.get(id);
          if (target) return [{ id, w: target.entry.headword, fa: target.sense.gloss }];
          const word = byId.get(entryIdOf(id));
          return word ? [{ id, w: word.w, fa: word.fa }] : [];
        }),
      });
    });
    return () => {
      alive = false;
    };
    // key captures the id list; the array identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const rows = loaded.key === key ? loaded.rows : [];
  if (!rows.length) return null;

  return (
    <ul className="divide-y divide-line border-y border-line">
      {rows.map((row) => (
        <li key={row.id}>
          <Link to="/lexicon" search={{ q: row.w }} className="flex min-h-14 items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span lang="en" dir="ltr" className="lex-word block text-lg">
                {row.w}
              </span>
              <span lang="fa" dir="rtl" className="block truncate text-sm text-muted">
                <Fa text={row.fa} />
              </span>
            </span>
            {meta?.[row.id] != null ? (
              <span className="text-sm text-bad">
                <Num value={meta[row.id] ?? 0} />
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
