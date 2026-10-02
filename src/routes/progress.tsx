import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { LabeledWords } from "@/components/labeled-words";
import { Num, PageHeader } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useCopy } from "@/lib/learn/i18n";
import { loadMeta } from "@/lib/learn/load";
import { countLevel, todayLog, totals, useProgress, weakIds, type DayLog } from "@/lib/learn/store";
import { todayKey } from "@/lib/learn/text";
import type { Meta } from "@/lib/learn/types";

export const Route = createFileRoute("/progress")({ component: ProgressPage });

function lastDays(logs: DayLog[], n = 14) {
  const rows: { date: string; reviews: number }[] = [];
  const today = new Date();
  for (let offset = n - 1; offset >= 0; offset--) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = todayKey(date);
    rows.push({ date: key.slice(5), reviews: logs.find((row) => row.date === key)?.reviews ?? 0 });
  }
  return rows;
}

function ProgressPage() {
  const lang = useProgress((state) => state.lang);
  const hydrated = useProgress((state) => state.hydrated);
  const cards = useProgress((state) => state.cards);
  const logs = useProgress((state) => state.logs);
  const xp = useProgress((state) => state.xp);
  const streak = useProgress((state) => state.streak);
  const focus = useProgress((state) => state.focus);
  const sessionSize = useProgress((state) => state.sessionSize);
  const newPerDay = useProgress((state) => state.newPerDay);
  const voice = useProgress((state) => state.voice);
  const dailyGoal = useProgress((state) => state.dailyGoal);
  const bookmarks = useProgress((state) => state.bookmarks);
  const setSessionSize = useProgress((state) => state.setSessionSize);
  const setNewPerDay = useProgress((state) => state.setNewPerDay);
  const setVoice = useProgress((state) => state.setVoice);
  const setDailyGoal = useProgress((state) => state.setDailyGoal);
  const setLang = useProgress((state) => state.setLang);
  const reset = useProgress((state) => state.reset);
  const copy = useCopy(lang);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [chartOn, setChartOn] = useState(false);

  useEffect(() => {
    void loadMeta().then(setMeta).catch(() => undefined);
    setChartOn(true);
  }, []);

  const all = totals(cards);
  const summed = logs.reduce(
    (sum, row) => ({ reviews: sum.reviews + row.reviews, correct: sum.correct + row.correct }),
    { reviews: 0, correct: 0 },
  );
  const accuracy = summed.reviews ? Math.round((100 * summed.correct) / summed.reviews) : null;
  const data = hydrated ? lastDays(logs) : [];
  const reviewsToday = hydrated ? todayLog(logs).reviews : 0;
  const weak = hydrated ? weakIds(cards, 8) : [];
  const weakMeta = Object.fromEntries(weak.map((item) => [item.id, item.lapses]));

  return (
    <div>
      <PageHeader title={copy.progress} lede={copy.accuracyHint} />
      <section className="panel grid grid-cols-2 sm:grid-cols-4">
        <Stat label={copy.streakLabel} value={<Num value={hydrated ? streak : 0} />} />
        <Stat label={copy.masteredLabel} value={<Num value={hydrated ? all.mastered : 0} />} />
        <Stat label={copy.reviewsLabel} value={<Num value={hydrated ? summed.reviews : 0} />} />
        <Stat label={copy.xpLabel} value={<Num value={hydrated ? xp : 0} />} />
      </section>
      <p className="mt-3 text-sm text-muted">
        {copy.accuracyLabel}: {accuracy === null ? "–" : `${accuracy}%`}
        <span className="mx-2">·</span>
        {copy.goalCaption}: <Num value={reviewsToday} /> / <Num value={dailyGoal} />
      </p>

      {weak.length ? (
        <section className="mt-8">
          <h2 className="text-lg font-medium">{copy.weakTitle}</h2>
          <p className="mt-1 text-sm text-muted">{copy.weakHint}</p>
          <div className="mt-3">
            <LabeledWords ids={weak.map((item) => item.id)} meta={weakMeta} />
          </div>
        </section>
      ) : null}

      {bookmarks.length ? (
        <p className="mt-6 text-sm">
          <Link to="/lexicon" search={{ saved: true }} className="text-accent">
            {copy.savedTitle} <Num value={bookmarks.length} />
          </Link>
        </p>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-medium">{copy.chartTitle}</h2>
        <div className="mt-3 h-48">
          {chartOn ? <ReviewsChart data={data} /> : null}
        </div>
      </section>

      <section className="mt-8 grid gap-2">
        <h2 className="text-lg font-medium">{copy.pathTitle}</h2>
        {(meta?.levels ?? []).map((level) => {
          const counts = countLevel(cards, level.id);
          const pct = level.count ? Math.round((100 * counts.mastered) / level.count) : 0;
          return (
            <div key={level.id} className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-3">
              <span className={cn("lex-word text-lg", focus === level.id && "text-accent")}>{level.label}</span>
              <div className="h-1 rounded-full bg-line">
                <div className="h-1 rounded-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-muted tabular-nums">
                <Num value={counts.seen} /> / <Num value={level.count} />
              </span>
            </div>
          );
        })}
      </section>

      <section className="mt-8 max-w-xl">
        <h2 className="text-lg font-medium">{copy.settings}</h2>
        <Setting label={copy.dailyGoal}>
          {[10, 20, 40].map((n) => (
            <Toggle key={n} active={dailyGoal === n} onClick={() => setDailyGoal(n)}>
              {String(n)}
            </Toggle>
          ))}
        </Setting>
        <Setting label={copy.sessionSize}>
          {[10, 20, 30].map((n) => (
            <Toggle key={n} active={sessionSize === n} onClick={() => setSessionSize(n)}>
              {String(n)}
            </Toggle>
          ))}
        </Setting>
        <Setting label={copy.newPerDay}>
          {[5, 10, 20].map((n) => (
            <Toggle key={n} active={newPerDay === n} onClick={() => setNewPerDay(n)}>
              {String(n)}
            </Toggle>
          ))}
        </Setting>
        <label className="mt-4 flex min-h-11 items-center justify-between gap-3 text-sm">
          <span>
            {copy.voice}
            <span className="mt-1 block text-xs text-muted">{copy.voiceHint}</span>
          </span>
          <input type="checkbox" checked={voice} onChange={(event) => setVoice(event.target.checked)} className="size-5" />
        </label>
        <button type="button" className="mt-2 min-h-11 text-sm text-muted" onClick={() => setLang(lang === "fa" ? "en" : "fa")}>
          {lang === "fa" ? "English" : "فارسی"}
        </button>
        <div className="mt-6">
          {confirm ? (
            <div className="rounded-lg border border-line p-3">
              <p className="text-sm text-pretty">{copy.resetWarn}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="min-h-11 rounded-md bg-accent px-3 text-sm text-accent-fg"
                  onClick={() => {
                    reset();
                    setConfirm(false);
                  }}
                >
                  {copy.resetYes}
                </button>
                <button type="button" className="min-h-11 px-3 text-sm" onClick={() => setConfirm(false)}>
                  {copy.resetNo}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="min-h-11 text-sm text-bad" onClick={() => setConfirm(true)}>
              {copy.reset}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-medium">{value}</p>
    </div>
  );
}

function Setting({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <p className="text-sm text-muted">{label}</p>
      <div className="mt-2 flex gap-2">{children}</div>
    </div>
  );
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-md px-3 text-sm",
        active ? "bg-ink text-paper" : "bg-paper-2 shadow-[var(--shadow-border)]",
      )}
    >
      {children}
    </button>
  );
}

function ReviewsChart({ data }: { data: { date: string; reviews: number }[] }) {
  const [mod, setMod] = useState<typeof import("recharts") | null>(null);
  useEffect(() => {
    void import("recharts").then(setMod);
  }, []);
  if (!mod) return null;
  const { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } = mod;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <XAxis dataKey="date" tick={{ fill: "var(--color-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip cursor={false} />
        <Bar dataKey="reviews" fill="var(--color-accent)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
