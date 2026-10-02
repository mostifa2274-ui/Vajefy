import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader, SpeakButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { posLabel, useCopy } from "@/lib/learn/i18n";
import { loadLevel, loadMeta } from "@/lib/learn/load";
import { useProgress } from "@/lib/learn/store";
import { levelOf, POS_FILTERS, searchKey } from "@/lib/learn/text";
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
  const focus = useProgress((state) => state.focus);
  const copy = useCopy(lang);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [scope, setScope] = useState<LevelId | "all">(initial.q || initial.saved ? "all" : "A1");
  const [q, setQ] = useState(initial.q ?? "");
  const [pos, setPos] = useState<string | null>(null);
  const [savedOnly, setSavedOnly] = useState(Boolean(initial.saved));
  const [loaded, setLoaded] = useState<{ scope: LevelId | "all"; words: LexWord[] } | null>(null);
  const [errorScope, setErrorScope] = useState<LevelId | "all" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState({ key: "", limit: 40 });

  // Open on the learner's level once it is known, unless the URL asked for
  // a search or saved words, or a level was already picked here.
  const scopeTouched = useRef(Boolean(initial.q || initial.saved));
  useEffect(() => {
    if (hydrated && !scopeTouched.current) setScope(focus);
  }, [hydrated, focus]);
  const pickScope = (next: LevelId | "all") => {
    scopeTouched.current = true;
    setScope(next);
  };

  useEffect(() => {
    void loadMeta()
      .then(setMeta)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        let next: LexWord[];
        if (scope === "all") {
          const info = meta ?? (await loadMeta());
          const lists = await Promise.all(info.levels.map((level) => loadLevel(level.id)));
          next = lists.flat();
        } else {
          next = await loadLevel(scope);
        }
        if (!alive) return;
        setLoaded({ scope, words: next });
        setErrorScope((failed) => (failed === scope ? null : failed));
      } catch {
        if (alive) setErrorScope(scope);
      }
    })();
    return () => {
      alive = false;
    };
  }, [scope, meta]);

  const words = loaded?.scope === scope ? loaded.words : null;
  const error = errorScope === scope;
  const pageKey = `${scope}\u0000${q}\u0000${pos ?? ""}\u0000${savedOnly ? "1" : "0"}`;
  const limit = page.key === pageKey ? page.limit : 40;

  // Normalised once per word list, so typing only compares prepared keys.
  const keyed = useMemo(
    () =>
      (words ?? []).map((word) => ({
        word,
        head: searchKey(word.w),
        fa: searchKey(word.fa),
        ipa: searchKey(word.ipa),
        ex: searchKey(word.ex),
      })),
    [words],
  );

  const filtered = useMemo(() => {
    const query = searchKey(q);
    const saved = new Set(bookmarks);
    const list = keyed.filter((item) => {
      if (savedOnly && !saved.has(item.word.id)) return false;
      if (pos && !item.word.pos.includes(pos)) return false;
      if (!query) return true;
      return (
        item.head.includes(query) ||
        item.fa.includes(query) ||
        item.ipa.includes(query) ||
        (query.length >= 3 && item.ex.includes(query))
      );
    });
    const rank = (item: (typeof keyed)[number]) => {
      if (item.head === query) return 0;
      if (item.head.startsWith(query)) return 1;
      if (item.head.includes(query)) return 2;
      if (item.fa.includes(query)) return 3;
      return 4;
    };
    const ranked = query ? list.slice().sort((a, b) => rank(a) - rank(b)) : list;
    return ranked.map((item) => item.word);
  }, [keyed, q, pos, savedOnly, bookmarks]);

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
        <Chip active={scope === "all"} onClick={() => pickScope("all")}>
          {copy.bandAll}
        </Chip>
        {(meta?.levels ?? []).map((level) => (
          <Chip key={level.id} active={scope === level.id} onClick={() => pickScope(level.id)}>
            {level.label}
          </Chip>
        ))}
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        <Chip
          active={savedOnly}
          onClick={() => {
            if (!savedOnly) pickScope("all");
            setSavedOnly(!savedOnly);
          }}
        >
          {copy.savedFilter}
        </Chip>
        <Chip active={!pos} onClick={() => setPos(null)}>
          {copy.posAll}
        </Chip>
        {POS_FILTERS.map((item) => (
          <Chip key={item} active={pos === item} onClick={() => setPos(item)}>
            {posLabel(item, lang)}
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
            <button
              type="button"
              className="mt-3 min-h-11 text-sm text-accent"
              onClick={() => setPage({ key: pageKey, limit: limit + 40 })}
            >
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
                {selected.pos ? ` · ${posLabel(selected.pos, lang)}` : ""}
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
      aria-pressed={active}
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
