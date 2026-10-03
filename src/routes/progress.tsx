import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { LabeledWords } from "@/components/labeled-words";
import { LearningSummary, OfflineAudio } from "@/components/progress-extras";
import { Num, PageHeader, Sep } from "@/components/ui";
import { cn } from "@/lib/cn";
import { parseBackup } from "@/lib/learn/backup";
import { downloadProgressBackup } from "@/lib/learn/download-backup";
import { useFormat } from "@/lib/learn/format";
import { useCopy, type Copy } from "@/lib/learn/i18n";
import { loadMeta } from "@/lib/learn/load";
import {
  countLevel,
  liveStreak,
  todayLog,
  totals,
  useProgress,
  weakIds,
  type DayLog,
  type SavedProgress,
} from "@/lib/learn/store";
import { todayKey } from "@/lib/learn/text";
import type { Lang, Meta } from "@/lib/learn/types";

export const Route = createFileRoute("/progress")({ component: ProgressPage });

type Day = { date: Date; reviews: number };

function lastDays(logs: DayLog[], n = 14): Day[] {
  const rows: Day[] = [];
  const today = new Date();
  for (let offset = n - 1; offset >= 0; offset--) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = todayKey(date);
    rows.push({ date, reviews: logs.find((row) => row.date === key)?.reviews ?? 0 });
  }
  return rows;
}

function ProgressPage() {
  const lang = useProgress((state) => state.lang);
  const hydrated = useProgress((state) => state.hydrated);
  const cards = useProgress((state) => state.cards);
  const logs = useProgress((state) => state.logs);
  const lifetime = useProgress((state) => state.lifetime);
  const xp = useProgress((state) => state.xp);
  const streak = useProgress((state) => state.streak);
  const lastStudyDate = useProgress((state) => state.lastStudyDate);
  const focus = useProgress((state) => state.focus);
  const sessionSize = useProgress((state) => state.sessionSize);
  const newPerDay = useProgress((state) => state.newPerDay);
  const voice = useProgress((state) => state.voice);
  const accent = useProgress((state) => state.accent);
  const dailyGoal = useProgress((state) => state.dailyGoal);
  const requestRetention = useProgress((state) => state.requestRetention);
  const reviewHistory = useProgress((state) => state.reviewHistory);
  const bookmarks = useProgress((state) => state.bookmarks);
  const setSessionSize = useProgress((state) => state.setSessionSize);
  const setNewPerDay = useProgress((state) => state.setNewPerDay);
  const setVoice = useProgress((state) => state.setVoice);
  const setAccent = useProgress((state) => state.setAccent);
  const setDailyGoal = useProgress((state) => state.setDailyGoal);
  const setRequestRetention = useProgress((state) => state.setRequestRetention);
  const setLang = useProgress((state) => state.setLang);
  const reset = useProgress((state) => state.reset);
  const copy = useCopy(lang);
  const { num, pct } = useFormat();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    void loadMeta().then(setMeta).catch(() => undefined);
  }, []);

  const all = totals(cards);
  const accuracy = lifetime.reviews ? lifetime.correct / lifetime.reviews : null;
  const practiceAccuracy = lifetime.practice ? lifetime.practiceCorrect / lifetime.practice : null;
  const data = hydrated ? lastDays(logs) : [];
  const reviewsToday = hydrated ? todayLog(logs).reviews : 0;
  const weak = hydrated ? weakIds(cards, 8) : [];
  const weakMeta = Object.fromEntries(weak.map((item) => [item.id, item.lapses]));

  return (
    <div>
      <PageHeader title={copy.progress} lede={copy.accuracyHint} />
      <section className="panel grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label={copy.streakLabel} value={<Num value={hydrated ? liveStreak(streak, lastStudyDate) : 0} />} />
        <Stat label={copy.masteredLabel} value={<Num value={hydrated ? all.mastered : 0} />} />
        <Stat label={copy.reviewsLabel} value={<Num value={hydrated ? lifetime.reviews : 0} />} />
        <Stat label={copy.practiceLabel} value={<Num value={hydrated ? lifetime.practice : 0} />} />
        <Stat label={copy.reviewEvidence} value={<Num value={hydrated ? reviewHistory.length : 0} />} />
        <Stat label={copy.xpLabel} value={<Num value={hydrated ? xp : 0} />} />
      </section>
      <p className="mt-3 text-sm text-muted">
        {copy.accuracyLabel}: {accuracy === null ? "–" : pct(accuracy)}
        <Sep />
        {copy.practiceAccuracyLabel}: {practiceAccuracy === null ? "–" : pct(practiceAccuracy)}
        <Sep />
        {copy.goalCaption}: <Num value={reviewsToday} /> / <Num value={dailyGoal} />
      </p>

      {hydrated ? <LearningSummary copy={copy} /> : null}

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
        <div className="mt-3">
          {data.some((day) => day.reviews > 0) ? (
            <ReviewsChart data={data} lang={lang} label={copy.reviewsLabel} />
          ) : (
            <p className="text-sm text-muted text-pretty">{copy.chartEmpty}</p>
          )}
        </div>
      </section>

      <section className="mt-8 grid gap-2">
        <h2 className="text-lg font-medium">{copy.pathTitle}</h2>
        {(meta?.levels ?? []).map((level) => {
          const counts = countLevel(cards, level.id);
          const width = level.count ? Math.round((100 * counts.mastered) / level.count) : 0;
          return (
            <div key={level.id} className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-3">
              <span className={cn("lex-word text-lg", focus === level.id && "text-accent")}>{level.label}</span>
              <div className="h-1 rounded-full bg-line">
                <div className="h-1 rounded-full bg-accent" style={{ width: `${width}%` }} />
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
              {num(n)}
            </Toggle>
          ))}
        </Setting>
        <Setting label={copy.sessionSize}>
          {[10, 20, 30].map((n) => (
            <Toggle key={n} active={sessionSize === n} onClick={() => setSessionSize(n)}>
              {num(n)}
            </Toggle>
          ))}
        </Setting>
        <Setting label={copy.newPerDay}>
          {[5, 10, 20].map((n) => (
            <Toggle key={n} active={newPerDay === n} onClick={() => setNewPerDay(n)}>
              {num(n)}
            </Toggle>
          ))}
        </Setting>
        <Setting label={copy.retentionTarget}>
          {[0.85, 0.9, 0.95].map((n) => (
            <Toggle key={n} active={requestRetention === n} onClick={() => setRequestRetention(n)}>
              {pct(n)}
            </Toggle>
          ))}
        </Setting>
        <p className="mt-1 text-xs text-pretty text-muted">{copy.retentionHint}</p>
        <p className="mt-3 text-xs text-muted">
          {copy.schedulerLabel}: {copy.schedulerFsrs}
        </p>
        <Setting label={copy.accent}>
          <Toggle active={accent === "en-GB"} onClick={() => setAccent("en-GB")}>
            {copy.accentBritish}
          </Toggle>
          <Toggle active={accent === "en-US"} onClick={() => setAccent("en-US")}>
            {copy.accentAmerican}
          </Toggle>
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

        <OfflineAudio copy={copy} />

        <BackupPanel copy={copy} />

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

function BackupPanel({ copy }: { copy: Copy }) {
  const importProgress = useProgress((state) => state.importProgress);
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<SavedProgress | null>(null);
  const [status, setStatus] = useState<"done" | "invalid" | "future" | null>(null);

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const parsed = parseBackup(await file.text());
    setPending(parsed.ok ? parsed.progress : null);
    setStatus(parsed.ok ? null : parsed.reason);
  }

  return (
    <div className="mt-6 rounded-lg border border-line p-3">
      <h3 className="text-sm font-medium">{copy.backupTitle}</h3>
      <p className="mt-1 text-xs text-pretty text-muted">{copy.backupHint}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={downloadProgressBackup} className="min-h-11 rounded-md bg-paper-2 px-3 text-sm shadow-[var(--shadow-border)]">
          {copy.exportProgress}
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="min-h-11 rounded-md bg-paper-2 px-3 text-sm shadow-[var(--shadow-border)]"
        >
          {copy.importProgress}
        </button>
        <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void pick(event)} />
      </div>
      {pending ? (
        <div className="mt-3">
          <p className="text-sm text-pretty">{copy.importWarn}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="min-h-11 rounded-md bg-accent px-3 text-sm text-accent-fg"
              onClick={() => {
                importProgress(pending);
                setPending(null);
                setStatus("done");
              }}
            >
              {copy.importYes}
            </button>
            <button type="button" className="min-h-11 px-3 text-sm" onClick={() => setPending(null)}>
              {copy.resetNo}
            </button>
          </div>
        </div>
      ) : null}
      {status ? (
        <p role="status" className={cn("mt-2 text-sm", status === "done" ? "text-good" : "text-bad")}>
          {status === "done" ? copy.importDone : status === "future" ? copy.importFuture : copy.importBad}
        </p>
      ) : null}
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
      aria-pressed={active}
      className={cn(
        "min-h-11 rounded-md px-3 text-sm",
        active ? "bg-ink text-paper" : "bg-paper-2 shadow-[var(--shadow-border)]",
      )}
    >
      {children}
    </button>
  );
}

const CHART_H = 168;
const AXIS_H = 22;
const TOP_PAD = 18;

/** Fourteen daily review counts. Time runs left to right in both languages. */
function ReviewsChart({ data, lang, label }: { data: Day[]; lang: Lang; label: string }) {
  const { num, sep } = useFormat();
  const [active, setActive] = useState<number | null>(null);
  // Laid out in real pixels (not a scaled viewBox) so bars and 12px labels
  // keep their size on a phone and on a wide screen alike.
  const box = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(560);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => setWidth(Math.max(240, Math.round(element.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const locale = lang === "fa" ? "fa-IR" : "en-GB";
  const dayOfMonth = new Intl.DateTimeFormat(locale, { day: "numeric" });
  const fullDate = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" });
  const max = Math.max(1, ...data.map((day) => day.reviews));
  const peak = data.reduce((best, day, index) => (day.reviews > data[best]!.reviews ? index : best), 0);
  const slot = width / data.length;
  const barW = Math.min(24, slot - 2);
  const plotH = CHART_H - AXIS_H - TOP_PAD;
  const baseline = CHART_H - AXIS_H;
  const tip = active === null ? null : data[active];
  // Centre the tooltip on its bar, but pin it to the edge near either end.
  const tipShift = active === null ? 0 : active < 2 ? 0 : active > data.length - 3 ? -100 : -50;

  return (
    <figure ref={box} className="relative" dir="ltr">
      <svg width={width} height={CHART_H} viewBox={`0 0 ${width} ${CHART_H}`} className="block" role="group" aria-label={label}>
        <line x1={0} x2={width} y1={baseline + 0.5} y2={baseline + 0.5} stroke="var(--color-line)" strokeWidth={1} />
        {data.map((day, index) => {
          const h = day.reviews ? Math.max(4, (day.reviews / max) * plotH) : 0;
          const x = index * slot + (slot - barW) / 2;
          const y = baseline - h;
          const r = Math.min(4, h);
          return (
            <g
              key={day.date.toISOString()}
              tabIndex={0}
              role="img"
              aria-label={`${fullDate.format(day.date)}: ${num(day.reviews)} ${label}`}
              onPointerEnter={() => setActive(index)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              className="outline-none"
            >
              <rect x={index * slot} y={0} width={slot} height={CHART_H} fill="transparent" />
              {h ? (
                <path
                  d={`M${x},${baseline} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${baseline} Z`}
                  fill="var(--color-accent)"
                  opacity={active === null || active === index ? 1 : 0.45}
                />
              ) : null}
              {index === peak && day.reviews ? (
                <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize={12} fill="var(--color-ink)">
                  {num(day.reviews)}
                </text>
              ) : null}
              {index % 2 === (data.length - 1) % 2 ? (
                <text x={index * slot + slot / 2} y={CHART_H - 6} textAnchor="middle" fontSize={12} fill="var(--color-muted)">
                  {dayOfMonth.format(day.date)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {tip && active !== null ? (
        <figcaption
          dir={lang === "fa" ? "rtl" : "ltr"}
          className="pointer-events-none absolute top-0 rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-paper"
          style={{
            left: `${((active + (tipShift === 0 ? 0 : tipShift === -100 ? 1 : 0.5)) / data.length) * 100}%`,
            transform: `translateX(${tipShift}%)`,
          }}
        >
          <strong className="font-medium">{num(tip.reviews)}</strong> {label}
          {sep}
          {fullDate.format(tip.date)}
        </figcaption>
      ) : null}
    </figure>
  );
}
