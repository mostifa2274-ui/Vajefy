import { useEffect, useMemo, useRef, useState } from "react";
import { useCopy } from "@/lib/learn/i18n";
import type { PlayPair } from "@/lib/learn/play";
import { shuffle } from "@/lib/learn/text";
import type { Lang } from "@/lib/learn/types";
import { cn } from "@/lib/cn";
import { Button, Num } from "./ui";

type Tile = {
  key: string;
  pairId: string;
  text: string;
  dir: "ltr" | "rtl";
  face: "en" | "fa";
};

function clock(ms: number, lang: Lang): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const text = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  if (lang !== "fa") return text;
  const digits = "۰۱۲۳۴۵۶۷۸۹";
  return text.replace(/\d/g, (digit) => digits[Number(digit)] ?? digit);
}

export function MatchBoard({
  pairs,
  lang,
  onPair,
  onExit,
}: {
  pairs: PlayPair[];
  lang: Lang;
  onPair: (id: string) => void;
  onExit: () => void;
}) {
  const copy = useCopy(lang);
  const tiles = useMemo<Tile[]>(
    () =>
      shuffle(
        pairs.flatMap((pair) => [
          { key: `${pair.id}:en`, pairId: pair.id, text: pair.en, dir: "ltr" as const, face: "en" as const },
          { key: `${pair.id}:fa`, pairId: pair.id, text: pair.fa, dir: "rtl" as const, face: "fa" as const },
        ]),
      ),
    [pairs],
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<string>>(() => new Set());
  const [wrong, setWrong] = useState(false);
  const [moves, setMoves] = useState(0);
  // Pairs that were part of a wrong guess; matching them later proves little.
  const missed = useRef(new Set<string>());
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lock = useRef(false);
  const timer = useRef<number | null>(null);
  const done = matched.size === pairs.length;

  useEffect(() => {
    if (started == null || done) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [started, done]);

  useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    },
    [],
  );

  function pick(key: string) {
    if (lock.current || done) return;
    const tile = tiles.find((item) => item.key === key);
    if (!tile || matched.has(tile.pairId) || selected.includes(key)) return;
    if (started == null) setStarted(Date.now());
    if (selected.length === 0) {
      setSelected([key]);
      setWrong(false);
      return;
    }
    const first = tiles.find((item) => item.key === selected[0]);
    setMoves((count) => count + 1);
    if (first && first.pairId === tile.pairId) {
      setMatched((prev) => {
        const next = new Set(prev);
        next.add(tile.pairId);
        return next;
      });
      setSelected([]);
      setWrong(false);
      // The last pair is solved by elimination, so only earlier clean matches count.
      const isLast = matched.size + 1 === pairs.length;
      if (!isLast && !missed.current.has(tile.pairId)) onPair(tile.pairId);
      return;
    }
    if (first) {
      missed.current.add(first.pairId);
      missed.current.add(tile.pairId);
    }
    setSelected([selected[0]!, key]);
    setWrong(true);
    lock.current = true;
    timer.current = window.setTimeout(() => {
      setSelected([]);
      setWrong(false);
      lock.current = false;
    }, 480);
  }

  if (done) {
    return (
      <section className="mx-auto max-w-xl">
        <p className="text-sm text-accent">{copy.matchMode}</p>
        <h1 className="mt-1 text-3xl font-medium text-balance">{copy.matchClear}</h1>
        <p className="mt-3 text-muted">
          {copy.movesLabel} <Num value={moves} />
          {started != null ? ` · ${clock(now - started, lang)}` : ""}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={onExit}>{copy.roundAgain}</Button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3 text-sm text-muted">
        <span>{copy.matchMode}</span>
        <span className="tabular-nums">
          <Num value={matched.size} /> / <Num value={pairs.length} />
          <span className="mx-2">·</span>
          {started == null ? "0:00" : clock(now - started, lang)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map((tile) => {
          const isMatched = matched.has(tile.pairId);
          const isOn = selected.includes(tile.key);
          return (
            <button
              key={tile.key}
              type="button"
              disabled={isMatched}
              onClick={() => pick(tile.key)}
              aria-pressed={isOn}
              lang={tile.dir === "ltr" ? "en" : "fa"}
              dir={tile.dir}
              className={cn(
                "flex min-h-20 items-center justify-center rounded-lg px-2 text-center text-sm leading-snug text-balance shadow-[var(--shadow-border)]",
                tile.face === "en" && "lex-word text-lg",
                isMatched && "bg-accent-soft text-ink",
                isOn && wrong && "bg-paper-2 text-bad",
                isOn && !wrong && "bg-ink text-paper",
                !isMatched && !isOn && "bg-paper-2 text-ink",
              )}
            >
              {tile.text}
            </button>
          );
        })}
      </div>
    </section>
  );
}
