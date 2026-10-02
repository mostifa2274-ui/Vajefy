import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, SpeakButton } from "@/components/ui";
import { Explain } from "@/components/explain";
import { cn } from "@/lib/cn";
import { useCopy } from "@/lib/learn/i18n";
import { loadLevel, loadMeta } from "@/lib/learn/load";
import { useProgress } from "@/lib/learn/store";
import { levelOf, POS_FILTERS } from "@/lib/learn/text";
import type { LevelId, LexWord, Meta } from "@/lib/learn/types";

export const Route = createFileRoute("/lexicon")({
  validateSearch: (search: Record<string, unknown>): { q?: string; saved?: boolean } => {
    const next: { q?: string; saved?: boolean } = {};
    if (typeof search.q === "string" && search.q.trim()) next.q = search.q.trim().slice(0, 80);
    if (search.saved === true || search.saved === "1" || search.saved === "true") next.saved = true;
    return next;
  },
  component: LexiconPage,
});

function levelLabel(id: string): string {
  const level = levelOf(id);
  if (level === "B2x") return "B2+";
  return level ?? "";
}

function LexiconPage() {
  const initial = Route.useSearch();
  const lang = useProgress((state) => state.lang);
  const hydrated = useProgress((state) => state.hydrated);
  const cards = useProgress((state) => state.cards);
  const bookmarks = useProgress((state) => state.bookmarks);
  const toggleBookmark = useProgress((state) => state.toggleBookmark);
  const addToReview = useProgress((state) => state.addToReview);
  const markKnown = useProgress((state) => state.markKnown);
  const copy = useCopy(lang);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [scope, setScope] = useState<LevelId | "all">(initial.q || initial.saved ? "all" : "A1");
  const [q, setQ] = useState(initial.q ?? "");
  const [pos, setPos] = useState<string | null>(null);
  const [savedOnly, setSavedOnly] = useState(Boolean(initial.saved));
  const [words, setWords] = useState<LexWord[] | null>(null);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [limit, setLimit] = useState(40);

  useEffect(() => {
    void loadMeta()
      .then(setMeta)
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    let alive = true;
    setError(false);
    setWords(null);
    void (async () => {
      try {
        if (scope === "all") {
          const info = meta ?? (await loadMeta());
          const lists = await Promise.all(info.levels.map((level) => loadLevel(level.id)));
          if (alive) setWords(lists.flat());
        } else {
          const list = await loadLevel(scope);
          if (alive) setWords(list);
        }
      } catch {
        if (alive) setError(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [scope, meta]);

  useEffect(() => {
    setLimit(40);
  }, [q, pos, scope, savedOnly]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const raw = q.trim();
    const list = (words ?? []).filter((word) => {
      if (savedOnly && !bookmarks.includes(word.id)) return false;
      if (pos && !word.pos.includes(pos)) return false;
      if (!query) return true;
      return (
        word.w.toLowerCase().includes(query) ||
        word.fa.includes(raw) ||
        word.ipa.toLowerCase().includes(query) ||
        (query.length >= 3 && word.ex.toLowerCase().includes(query))
      );
    });
    if (!query) return list;
    const rank = (word: LexWord) => {
      const head = word.w.toLowerCase();
      if (head === query) return 0;
      if (head.startsWith(query)) return 1;
      if (head.includes(query)) return 2;
      if (word.fa.includes(raw)) return 3;
      return 4;
    };
    return list.slice().sort((a, b) => rank(a) - rank(b));
  }, [words, q, pos, savedOnly, bookmarks]);

  const selected = filtered.find((word) => word.id === selectedId) ?? null;
  const shown = filtered.slice(0, limit);

  return (
    <div>
      <PageHeader title={copy.lexicon} lede={copy.sourceLine} />
      <input
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder={copy.searchPlaceholder}
        aria-label={copy.search}
        className="field h-12 w-full px-3 text-base outline-none"
      />
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <Chip active={scope === "all"} onClick={() => setScope("all")}>
          {copy.bandAll}
        </Chip>
        {(meta?.levels ?? []).map((level) => (
          <Chip key={level.id} active={scope === level.id} onClick={() => setScope(level.id)}>
            {level.label}
          </Chip>
        ))}
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        <Chip
          active={savedOnly}
          onClick={() => {
            setSavedOnly((value) => {
              if (!value) setScope("all");
              return !value;
            });
          }}
        >
          {copy.savedFilter}
        </Chip>
        <Chip active={!pos} onClick={() => setPos(null)}>
          {copy.posAll}
        </Chip>
        {POS_FILTERS.map((item) => (
          <Chip key={item} active={pos === item} onClick={() => setPos(item)}>
            {item}
          </Chip>
        ))}
      </div>

      {error ? <p className="mt-6 text-sm text-bad">{copy.loadFailed}</p> : null}
      {!words && !error ? <p className="mt-6 text-sm text-muted">{copy.loading}</p> : null}

      <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6">
        <div className={selected ? "hidden lg:block" : ""}>
          {words && filtered.length === 0 ? <p className="text-sm text-muted">{copy.noResults}</p> : null}
          <ul className="divide-y divide-line border-y border-line">
            {shown.map((word) => {
              const saved = bookmarks.includes(word.id);
              return (
                <li key={word.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedId(word.id)}
                    className="flex min-h-14 min-w-0 flex-1 items-baseline justify-between gap-3 py-3 text-start"
                  >
                    <span className="min-w-0">
                      <span lang="en" dir="ltr" className="lex-word block text-xl">
                        {word.w}
                      </span>
                      <span lang="fa" dir="rtl" className="mt-1 block truncate text-sm text-muted">
                        {word.fa}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">{levelLabel(word.id)}</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={saved}
                    aria-label={saved ? copy.bookmarked : copy.bookmark}
                    disabled={!hydrated}
                    onClick={() => toggleBookmark(word.id)}
                    className={cn(
                      "inline-flex size-11 shrink-0 items-center justify-center rounded-md",
                      saved ? "text-accent" : "text-muted",
                    )}
                  >
                    <Star className={cn("size-4", saved && "fill-current")} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          {filtered.length > limit ? (
            <button type="button" className="mt-3 min-h-11 text-sm text-accent" onClick={() => setLimit((n) => n + 40)}>
              {copy.loadMore}
            </button>
          ) : null}
        </div>
        <aside className={cn("lg:sticky lg:top-6 lg:self-start", selected ? "" : "hidden lg:block")}>
          {selected ? (
            <article className="panel p-5">
              <button type="button" className="mb-2 text-sm text-muted lg:hidden" onClick={() => setSelectedId(null)}>
                {copy.back}
              </button>
              <p className="text-xs text-muted">
                {levelLabel(selected.id)}
                {selected.pos ? ` · ${selected.pos}` : ""}
              </p>
              <h2 lang="en" dir="ltr" className="lex-word mt-2 text-4xl text-balance">
                {selected.w}
              </h2>
              <p lang="en" dir="ltr" className="mt-1 text-muted">
                {selected.ipa}
              </p>
              <p lang="fa" dir="rtl" className="mt-1 text-sm text-muted">
                {copy.pron}: {selected.pr}
              </p>
              <div className="mt-3">
                <SpeakButton text={selected.w} label={copy.listen} />
              </div>
              <p lang="fa" dir="rtl" className="mt-4 text-xl font-medium text-pretty">
                {selected.fa}
              </p>
              <blockquote lang="en" dir="ltr" className="mt-4 border-s-2 border-accent ps-3 text-pretty">
                {selected.ex}
              </blockquote>
              <p lang="fa" dir="rtl" className="mt-2 text-sm text-pretty text-muted">
                {selected.tr}
              </p>
              <Explain id={selected.id} />
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!hydrated}
                  onClick={() => toggleBookmark(selected.id)}
                  className="min-h-11 rounded-md border border-line px-3 text-sm"
                >
                  {bookmarks.includes(selected.id) ? copy.bookmarked : copy.bookmark}
                </button>
                <button
                  type="button"
                  disabled={!hydrated || Boolean(cards[selected.id])}
                  onClick={() => addToReview(selected.id)}
                  className="min-h-11 rounded-md border border-line px-3 text-sm disabled:opacity-40"
                >
                  {cards[selected.id] ? copy.added : copy.learnThis}
                </button>
                <button
                  type="button"
                  disabled={!hydrated || (cards[selected.id]?.interval ?? 0) >= 21}
                  onClick={() => markKnown(selected.id)}
                  className="min-h-11 rounded-md border border-line px-3 text-sm disabled:opacity-40"
                >
                  {(cards[selected.id]?.interval ?? 0) >= 21 ? copy.known : copy.know}
                </button>
              </div>
            </article>
          ) : (
            <p className="hidden text-sm text-muted lg:block">{copy.detailEmpty}</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 shrink-0 rounded-md px-3 text-sm",
        active ? "bg-ink text-paper" : "bg-paper-2 text-ink shadow-[var(--shadow-border)]",
      )}
    >
      {children}
    </button>
  );
}
