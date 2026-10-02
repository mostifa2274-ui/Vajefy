import { useEffect, useRef, useState } from "react";
import { useCopy } from "@/lib/learn/i18n";
import type { PlayPair } from "@/lib/learn/play";
import { gradeSpelling } from "@/lib/learn/text";
import type { Lang } from "@/lib/learn/types";
import { cn } from "@/lib/cn";
import { Button, Num } from "./ui";

const SECONDS = 45;

export function SprintRun({
  pairs,
  lang,
  onResult,
  onExit,
}: {
  pairs: PlayPair[];
  lang: Lang;
  onResult: (id: string, ok: boolean) => void;
  onExit: () => void;
}) {
  const copy = useCopy(lang);
  const [left, setLeft] = useState(SECONDS);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [misses, setMisses] = useState<{ fa: string; en: string }[]>([]);
  const [reveal, setReveal] = useState<{ ok: boolean; en: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number | null>(null);
  const lock = useRef(false);
  const over = left <= 0 || index >= pairs.length;
  const current = pairs[index];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (over) return;
    const id = window.setInterval(() => setLeft((seconds) => (seconds <= 1 ? 0 : seconds - 1)), 1000);
    return () => window.clearInterval(id);
  }, [over]);

  useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    },
    [],
  );

  function finish(ok: boolean) {
    if (!current || reveal || over || lock.current) return;
    lock.current = true;
    const nextCombo = ok ? combo + 1 : 0;
    if (ok) {
      setCombo(nextCombo);
      setBest((high) => Math.max(high, nextCombo));
      setCorrect((count) => count + 1);
    } else {
      setCombo(0);
      setMisses((list) => [...list, { fa: current.fa, en: current.en }]);
    }
    setReveal({ ok, en: current.en });
    setValue("");
    onResult(current.id, ok);
    timer.current = window.setTimeout(() => {
      lock.current = false;
      setReveal(null);
      setIndex((cursor) => cursor + 1);
      inputRef.current?.focus();
    }, ok ? 220 : 700);
  }

  if (over && !reveal) {
    return (
      <section className="mx-auto max-w-xl">
        <p className="text-sm text-accent">{copy.sprintMode}</p>
        <h1 className="mt-1 text-3xl font-medium text-balance">{copy.sprintOver}</h1>
        <p className="mt-3 text-muted">
          {copy.typedLabel} <Num value={correct} />
          <span className="mx-2">·</span>
          {copy.bestCombo} <Num value={best} />
        </p>
        {misses.length ? (
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {misses.slice(0, 8).map((miss) => (
              <li key={`${miss.en}-${miss.fa}`} className="flex items-baseline justify-between gap-3 py-2">
                <span lang="en" dir="ltr" className="lex-word text-lg">
                  {miss.en}
                </span>
                <span lang="fa" dir="rtl" className="truncate text-sm text-muted">
                  {miss.fa}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">{copy.cleanSession}</p>
        )}
        <div className="mt-6">
          <Button onClick={onExit}>{copy.roundAgain}</Button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center justify-between gap-3 text-sm text-muted">
        <span>
          {copy.secondsLeft} <Num value={left} />
        </span>
        <span>
          {copy.comboLabel} <Num value={combo} />
        </span>
      </div>
      <div className="h-1 rounded-full bg-line">
        <div className="h-1 rounded-full bg-accent" style={{ width: `${(100 * left) / SECONDS}%` }} />
      </div>
      {current ? (
        <form
          className="mt-8"
          onSubmit={(event) => {
            event.preventDefault();
            finish(gradeSpelling(value, current.en) !== "wrong");
          }}
        >
          <p lang="fa" dir="rtl" className="text-center text-3xl font-medium text-balance">
            {current.fa}
          </p>
          <input
            ref={inputRef}
            value={value}
            disabled={Boolean(reveal)}
            onChange={(event) => setValue(event.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            lang="en"
            dir="ltr"
            placeholder={copy.typePlaceholder}
            aria-label={copy.typePlaceholder}
            className="mt-6 h-14 w-full rounded-lg border border-line bg-paper-2 px-4 text-center text-2xl outline-none"
          />
          <p
            className={cn(
              "mt-3 min-h-6 text-center text-sm",
              reveal?.ok ? "text-good" : "text-bad",
            )}
          >
            {reveal && !reveal.ok ? reveal.en : reveal?.ok ? copy.correct : ""}
          </p>
          <Button type="submit" className="mt-4 w-full" disabled={Boolean(reveal) || !value.trim()}>
            {copy.check}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
