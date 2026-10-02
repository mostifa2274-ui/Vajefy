import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LabeledWords } from "@/components/labeled-words";
import { Onboard } from "@/components/onboard";
import { GoalRing, Num, SpeakButton, ButtonLink } from "@/components/ui";
import { useFormat } from "@/lib/learn/format";
import { useCopy } from "@/lib/learn/i18n";
import { loadLevel, loadMeta, loadPairs } from "@/lib/learn/load";
import { countLevel, dueIds, liveStreak, todayLog, totals, useProgress, weakIds } from "@/lib/learn/store";
import { dayNumber } from "@/lib/learn/text";
import type { LexWord, Meta, PairNote } from "@/lib/learn/types";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const lang = useProgress((state) => state.lang);
  const hydrated = useProgress((state) => state.hydrated);
  const cards = useProgress((state) => state.cards);
  const logs = useProgress((state) => state.logs);
  const focus = useProgress((state) => state.focus);
  const setFocus = useProgress((state) => state.setFocus);
  const streak = useProgress((state) => state.streak);
  const lastStudyDate = useProgress((state) => state.lastStudyDate);
  const lifetime = useProgress((state) => state.lifetime);
  const sessionSize = useProgress((state) => state.sessionSize);
  const newPerDay = useProgress((state) => state.newPerDay);
  const dailyGoal = useProgress((state) => state.dailyGoal);
  const onboarded = useProgress((state) => state.onboarded);
  const bookmarks = useProgress((state) => state.bookmarks);
  const setOnboarded = useProgress((state) => state.setOnboarded);
  const addToReview = useProgress((state) => state.addToReview);
  const copy = useCopy(lang);
  const { pct } = useFormat();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [word, setWord] = useState<LexWord | null>(null);
  const [nuance, setNuance] = useState<PairNote | null>(null);
  const [when, setWhen] = useState("");

  const hasHistory = hydrated && (Object.keys(cards).length > 0 || logs.length > 0);

  useEffect(() => {
    if (hasHistory && !onboarded) setOnboarded();
  }, [hasHistory, onboarded, setOnboarded]);

  useEffect(() => {
    void loadMeta()
      .then(setMeta)
      .catch(() => undefined);
  }, []);

  // Today's entry comes from the learner's own level, once it is known.
  useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    void (async () => {
      try {
        const [words, notes] = await Promise.all([loadLevel(focus), loadPairs("synonyms.json")]);
        if (!alive) return;
        setWord(words[dayNumber() % words.length] ?? null);
        setNuance(notes[dayNumber() % notes.length] ?? null);
      } catch {
        /* home still works without the daily cards */
      }
    })();
    return () => {
      alive = false;
    };
  }, [hydrated, focus]);

  useEffect(() => {
    if (!hydrated) return;
    const id = window.setTimeout(() => {
      const formatted = new Intl.DateTimeFormat(lang === "fa" ? "fa-IR" : "en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date());
      setWhen(formatted);
    }, 0);
    return () => window.clearTimeout(id);
  }, [hydrated, lang]);

  if (hydrated && !onboarded && !hasHistory) return <Onboard />;

  const due = hydrated ? dueIds(cards).length : 0;
  const introducedToday = hydrated ? todayLog(logs).introduced : 0;
  const reviewsToday = hydrated ? todayLog(logs).reviews : 0;
  const roomForNew = Math.max(0, newPerDay - introducedToday);
  const focusMeta = meta?.levels.find((level) => level.id === focus);
  const focusCounts = countLevel(cards, focus);
  const remainingNew = focusMeta ? Math.max(0, focusMeta.count - focusCounts.seen) : 0;
  const willIntroduce = Math.min(roomForNew, remainingNew, Math.max(0, sessionSize - Math.min(due, sessionSize)));
  const all = totals(cards);
  const accuracy = lifetime.reviews ? lifetime.correct / lifetime.reviews : null;
  const totalWords = meta?.levels.reduce((sum, level) => sum + level.count, 0) ?? 0;
  const inReview = Boolean(word && cards[word.id]);
  const weak = hydrated ? weakIds(cards, 5) : [];
  const weakMeta = Object.fromEntries(weak.map((item) => [item.id, item.lapses]));

  let headline = copy.nothingDue;
  let detail = copy.clearDetail;
  if (due > 0) {
    headline = copy.cardsToReview;
    detail = copy.dueDetail;
  } else if (willIntroduce > 0 && focusMeta) {
    headline = copy.newWords;
    detail = copy.newDetail;
  } else if (reviewsToday >= dailyGoal && dailyGoal > 0) {
    detail = copy.goalMet;
  }

  return (
    <div>
      <section className="panel p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted">{when || " "}</p>
            <h1 className="mt-1 max-w-xl text-3xl font-medium text-balance sm:text-4xl">
              {due > 0 ? (
                <>
                  <Num value={due} /> {headline}
                </>
              ) : willIntroduce > 0 && focusMeta ? (
                <>
                  {headline} {focusMeta.label}
                </>
              ) : (
                headline
              )}
            </h1>
            <p className="mt-2 max-w-xl text-pretty text-muted">{detail}</p>
          </div>
          <GoalRing value={reviewsToday} goal={dailyGoal} label={copy.goalCaption} />
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <ButtonLink to="/study">{copy.startSession}</ButtonLink>
          <Link
            to="/drill"
            search={{ play: "smart" }}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-paper-2 px-4 text-sm font-medium shadow-[var(--shadow-border)]"
          >
            {copy.smartPractice}
          </Link>
          <Link to="/drill" search={{ play: "match" }} className="inline-flex min-h-11 items-center px-1 text-sm text-accent">
            {copy.openMatch}
          </Link>
          <Link to="/drill" search={{ play: "sprint" }} className="inline-flex min-h-11 items-center px-1 text-sm text-accent">
            {copy.openSprint}
          </Link>
        </div>
        <p className="mt-5 text-sm text-muted">
          <Num value={due} /> {copy.dueLabel}
          <span className="mx-2">·</span>
          <Num value={hydrated ? liveStreak(streak, lastStudyDate) : 0} /> {copy.streakLabel}
          <span className="mx-2">·</span>
          <Num value={hydrated ? all.mastered : 0} /> {copy.masteredLabel}
          <span className="mx-2">·</span>
          {accuracy === null ? "–" : pct(accuracy)}
        </p>
      </section>

      <section className="mt-8 grid gap-3 lg:grid-cols-2">
        {word ? (
          <article className="panel p-5">
            <p className="text-sm text-muted">{copy.wordOfDay}</p>
            <h2 lang="en" dir="ltr" className="lex-word mt-2 text-5xl">
              {word.w}
            </h2>
            <p lang="en" dir="ltr" className="mt-1 text-sm text-muted">
              {word.ipa}
            </p>
            <p lang="fa" dir="rtl" className="mt-3 text-lg text-pretty">
              {word.fa}
            </p>
            <p lang="en" dir="ltr" className="mt-3 border-s-2 border-accent ps-3 text-pretty">
              {word.ex}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <SpeakButton text={word.w} label={copy.listen} />
              <button
                type="button"
                disabled={!hydrated || inReview}
                onClick={() => addToReview(word.id)}
                className="min-h-11 text-sm text-accent disabled:opacity-40"
              >
                {inReview ? copy.added : copy.learnThis}
              </button>
            </div>
          </article>
        ) : null}
        {nuance ? (
          <article className="panel p-5">
            <p className="text-sm text-muted">{copy.nuanceOfDay}</p>
            <h2 lang="en" dir="ltr" className="lex-word mt-2 text-3xl">
              {nuance.title}
            </h2>
            <p lang="fa" dir="rtl" className="mt-3 line-clamp-4 text-pretty text-muted">
              {nuance.guide}
            </p>
            <p lang="en" dir="ltr" className="mt-3 text-pretty">
              {nuance.ex}
            </p>
            <Link
              to="/library"
              search={{ d: "syn", q: nuance.title }}
              className="mt-4 inline-flex min-h-11 items-center text-sm text-accent"
            >
              {copy.openNote}
            </Link>
          </article>
        ) : null}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">{copy.pathTitle}</h2>
            <p className="text-sm text-muted">{copy.pathHint}</p>
          </div>
          {meta ? (
            <p className="text-sm text-muted">
              <Num value={totalWords} /> {copy.wordsInLevels}
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(meta?.levels ?? []).map((level) => {
            const counts = countLevel(cards, level.id);
            const pct = level.count ? Math.round((100 * counts.mastered) / level.count) : 0;
            const active = focus === level.id;
            return (
              <button
                key={level.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFocus(level.id)}
                className={
                  active
                    ? "rounded-lg bg-ink p-3 text-start text-paper"
                    : "panel p-3 text-start"
                }
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="lex-word text-2xl">{level.label}</span>
                  <span className={active ? "text-xs text-paper/70" : "text-xs text-muted"}>
                    <Num value={counts.mastered} /> / <Num value={level.count} />
                  </span>
                </div>
                <div className={active ? "mt-3 h-1 rounded-full bg-paper/20" : "mt-3 h-1 rounded-full bg-line"}>
                  <div className={active ? "h-1 rounded-full bg-paper" : "h-1 rounded-full bg-accent"} style={{ width: `${pct}%` }} />
                </div>
                <p className={active ? "mt-2 text-xs text-paper/70" : "mt-2 text-xs text-muted"}>
                  {copy.seenLabel} <Num value={counts.seen} />
                </p>
              </button>
            );
          })}
        </div>
      </section>

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

      <p className="mt-8 text-sm text-muted">{copy.sourceLine}</p>
    </div>
  );
}
