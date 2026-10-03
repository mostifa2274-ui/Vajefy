import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Num, PageHeader, SpeakButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { loadDeckEntries } from "@/lib/learn/faces";
import { useCopy, type CopyKey } from "@/lib/learn/i18n";
import { loadMeta } from "@/lib/learn/load";
import { searchKey } from "@/lib/learn/text";
import { useProgress } from "@/lib/learn/store";
import type { LibDeckId, Meta, RefEntry } from "@/lib/learn/types";

export const Route = createFileRoute("/library")({
  validateSearch: (search: Record<string, unknown>): { d?: string; q?: string } => {
    const next: { d?: string; q?: string } = {};
    if (typeof search.d === "string" && search.d) next.d = search.d;
    if (typeof search.q === "string" && search.q.trim()) next.q = search.q.trim().slice(0, 80);
    return next;
  },
  component: LibraryPage,
});

const DECKS: { id: LibDeckId; title: CopyKey; hint: CopyKey; countKey: string }[] = [
  { id: "irr", title: "irregular", hint: "deckHintIrr", countKey: "irregular" },
  { id: "pv", title: "phrasal", hint: "deckHintPv", countKey: "phrasal" },
  { id: "col", title: "collocations", hint: "deckHintCol", countKey: "collocations" },
  { id: "prep", title: "prepositions", hint: "deckHintPrep", countKey: "prepositions" },
  { id: "vp", title: "patterns", hint: "deckHintVp", countKey: "patterns" },
  { id: "fam", title: "families", hint: "deckHintFam", countKey: "families" },
  { id: "wf", title: "formation", hint: "deckHintWf", countKey: "formation" },
  { id: "syn", title: "synonyms", hint: "deckHintSyn", countKey: "synonyms" },
  { id: "conf", title: "confusing", hint: "deckHintConf", countKey: "confusing" },
  { id: "ant", title: "antonyms", hint: "deckHintAnt", countKey: "antonyms" },
  { id: "occ", title: "occupations", hint: "deckHintOcc", countKey: "occupations" },
];

function isDeck(value: string | undefined): value is LibDeckId {
  return DECKS.some((deck) => deck.id === value);
}

function LibraryPage() {
  const search = Route.useSearch();
  const lang = useProgress((state) => state.lang);
  const hydrated = useProgress((state) => state.hydrated);
  const cards = useProgress((state) => state.cards);
  const addToReview = useProgress((state) => state.addToReview);
  const copy = useCopy(lang);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [deck, setDeck] = useState<LibDeckId | null>(isDeck(search.d) ? search.d : null);
  const [loaded, setLoaded] = useState<{ deck: LibDeckId; entries: RefEntry[] } | null>(null);
  const [errorDeck, setErrorDeck] = useState<LibDeckId | null>(null);
  const [q, setQ] = useState(search.q ?? "");
  const [band, setBand] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const expose = useProgress((state) => state.expose);
  // Reading a reference note is exposure to it, recorded for evaluation.
  useEffect(() => {
    if (selectedId) expose(selectedId, "reference");
  }, [selectedId, expose]);
  const [page, setPage] = useState({ key: "", limit: 40 });

  useEffect(() => {
    void loadMeta()
      .then(setMeta)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!deck) return;
    let alive = true;
    void loadDeckEntries(deck, copy)
      .then((rows) => {
        if (!alive) return;
        setLoaded({ deck, entries: rows });
        setErrorDeck((failed) => (failed === deck ? null : failed));
        if (search.q) {
          const wanted = searchKey(search.q);
          const hit = rows.find((row) => row.title === search.q || searchKey(row.search).includes(wanted));
          if (hit) setSelectedId(hit.id);
        }
      })
      .catch(() => {
        if (alive) setErrorDeck(deck);
      });
    return () => {
      alive = false;
    };
  }, [deck, copy, search.q]);

  const entries = deck && loaded?.deck === deck ? loaded.entries : null;
  const error = Boolean(deck && errorDeck === deck);
  const pageKey = `${deck ?? ""}\u0000${q}\u0000${band ?? ""}`;
  const limit = page.key === pageKey ? page.limit : 40;

  const keys = useMemo(() => new Map((entries ?? []).map((entry) => [entry.id, searchKey(`${entry.title} ${entry.search}`)])), [entries]);

  const filtered = useMemo(() => {
    const query = searchKey(q);
    return (entries ?? []).filter((entry) => {
      if (band && entry.band !== band) return false;
      if (!query) return true;
      return keys.get(entry.id)?.includes(query) ?? false;
    });
  }, [entries, keys, q, band]);

  const selected = filtered.find((entry) => entry.id === selectedId) ?? entries?.find((entry) => entry.id === selectedId) ?? null;

  if (!deck) {
    return (
      <div>
        <PageHeader title={copy.library} lede={copy.libraryLead} />
        <div className="grid gap-3 sm:grid-cols-2">
          {DECKS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setDeck(item.id);
                setSelectedId(null);
              }}
              className="panel p-4 text-start"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{copy[item.title]}</span>
                <span className="text-sm text-muted tabular-nums">
                  {meta?.counts[item.countKey] != null ? <Num value={meta.counts[item.countKey]!} /> : null}
                </span>
              </span>
              <span className="mt-1 block text-sm text-pretty text-muted">{copy[item.hint]}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const current = DECKS.find((item) => item.id === deck);

  return (
    <div>
      <button
        type="button"
        className="mb-3 min-h-11 text-sm text-muted"
        onClick={() => {
          setDeck(null);
          setSelectedId(null);
        }}
      >
        {copy.back}
      </button>
      <PageHeader title={current ? copy[current.title] : copy.library} lede={current ? copy[current.hint] : undefined} />
      <input
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder={copy.searchPlaceholder}
        aria-label={copy.search}
        className="field h-12 w-full px-3 outline-none"
      />
      <div className="mt-3 flex gap-2 overflow-x-auto">
        <Filter active={band === null} onClick={() => setBand(null)}>
          {copy.bandAll}
        </Filter>
        <Filter active={band === 1} onClick={() => setBand(1)}>
          {copy.bandEssential}
        </Filter>
        <Filter active={band === 2} onClick={() => setBand(2)}>
          {copy.bandMid}
        </Filter>
        <Filter active={band === 3} onClick={() => setBand(3)}>
          {copy.bandAdv}
        </Filter>
      </div>
      {error ? <p className="mt-4 text-sm text-bad">{copy.loadFailed}</p> : null}
      {!entries && !error ? <p className="mt-4 text-sm text-muted">{copy.loading}</p> : null}
      <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6">
        <div className={selected ? "hidden lg:block" : ""}>
          {entries && filtered.length === 0 ? <p className="text-sm text-muted">{copy.noResults}</p> : null}
          <ul className="divide-y divide-line border-y border-line">
            {filtered.slice(0, limit).map((entry) => (
              <li key={entry.id}>
                <button type="button" onClick={() => setSelectedId(entry.id)} className="w-full py-3 text-start">
                  <span lang="en" dir="ltr" className="lex-word block text-xl">
                    {entry.title}
                  </span>
                  <span lang="fa" dir="rtl" className="mt-1 block truncate text-sm text-muted">
                    {entry.subtitle}
                  </span>
                </button>
              </li>
            ))}
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
              <p className="text-xs text-muted">{selected.kicker}</p>
              <h2 lang="en" dir="ltr" className="lex-word mt-2 text-3xl text-balance">
                {selected.title}
              </h2>
              {selected.subtitle ? (
                <p lang="fa" dir="rtl" className="mt-2 text-pretty">
                  {selected.subtitle}
                </p>
              ) : null}
              <div className="mt-3">
                <SpeakButton text={selected.title} label={copy.listen} item={selected.id} />
              </div>
              <div className="mt-4 grid gap-4">
                {selected.blocks.map((block) => (
                  <div key={block.label}>
                    <p className="text-xs text-muted">{block.label}</p>
                    <p dir={block.dir} lang={block.dir === "ltr" ? "en" : "fa"} className="mt-1 whitespace-pre-wrap text-pretty">
                      {block.text}
                    </p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={!hydrated || Boolean(cards[selected.id])}
                onClick={() => addToReview(selected.id)}
                className="mt-4 min-h-11 text-sm text-accent disabled:opacity-40"
              >
                {cards[selected.id] ? copy.added : copy.learnThis}
              </button>
            </article>
          ) : (
            <p className="hidden text-sm text-muted lg:block">{copy.detailEmpty}</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function Filter({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
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
