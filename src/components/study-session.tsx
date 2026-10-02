import { useEffect, useState } from "react";
import { useCopy } from "@/lib/learn/i18n";
import { schedule } from "@/lib/learn/srs";
import { cancelSpeech, speakEnglish } from "@/lib/learn/speech";
import { formatDelay } from "@/lib/learn/text";
import type { CardProg, Grade, Lang, StudyFace } from "@/lib/learn/types";
import { Button, SpeakButton } from "./ui";
import { Explain } from "./explain";

const GRADES: Grade[] = ["again", "hard", "good", "easy"];

export function StudySession({
  items,
  faces,
  cards,
  lang,
  voice,
  onGrade,
  onExit,
}: {
  items: { id: string; isNew: boolean }[];
  faces: Map<string, StudyFace>;
  cards: Record<string, CardProg>;
  lang: Lang;
  voice: boolean;
  onGrade: (id: string, grade: Grade) => void;
  onExit: () => void;
}) {
  const copy = useCopy(lang);
  const [order, setOrder] = useState(items);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState({ reviews: 0, correct: 0 });
  const [misses, setMisses] = useState<{ id: string; title: string }[]>([]);
  const current = order[index];
  const face = current ? faces.get(current.id) : undefined;

  useEffect(() => {
    if (!voice || !face) return;
    speakEnglish(face.speak);
    return () => cancelSpeech();
  }, [face, voice]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (event.key === " ") {
        event.preventDefault();
        setRevealed(true);
        return;
      }
      if (!revealed || !current) return;
      const grade = ({ "1": "again", "2": "hard", "3": "good", "4": "easy" } as const)[event.key];
      if (grade) {
        event.preventDefault();
        answer(grade);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function answer(grade: Grade) {
    if (!current) return;
    const now = Date.now();
    const prev = cards[current.id];
    const projected = schedule(
      prev ?? {
        ease: 2.5,
        interval: 0,
        due: now,
        reps: 0,
        lapses: 0,
        state: "learning",
        step: 0,
      },
      grade,
      now,
    );
    onGrade(current.id, grade);
    if (grade === "again") {
      setMisses((list) =>
        list.some((item) => item.id === current.id) ? list : [...list, { id: current.id, title: face?.title ?? current.id }],
      );
    }
    setStats((state) => ({
      reviews: state.reviews + 1,
      correct: state.correct + (grade === "again" ? 0 : 1),
    }));
    setOrder((queue) => {
      const next = queue.slice();
      next.splice(index, 1);
      if (grade === "again" || (grade === "hard" && projected.state === "learning")) {
        const at = Math.min(next.length, index + 2);
        next.splice(at, 0, current);
      }
      return next;
    });
    setRevealed(false);
  }

  if (!current || !face) {
    const accuracy = stats.reviews ? Math.round((100 * stats.correct) / stats.reviews) : 0;
    return (
      <section className="mx-auto max-w-xl">
        <h1 className="text-3xl font-medium text-balance">{copy.sessionDone}</h1>
        <p className="mt-3 text-muted">
          {stats.reviews} {copy.reviewed}
          {stats.reviews ? ` · ${accuracy}%` : ""}
        </p>
        {misses.length ? (
          <div className="mt-6">
            <h2 className="text-sm text-muted">{copy.missesTitle}</h2>
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {misses.map((miss) => (
                <li key={miss.id} lang="en" dir="ltr" className="lex-word py-2 text-lg">
                  {miss.title}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">{copy.cleanSession}</p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={onExit}>{copy.backHome}</Button>
        </div>
      </section>
    );
  }

  const now = Date.now();
  const base =
    cards[current.id] ??
    ({
      ease: 2.5,
      interval: 0,
      due: now,
      reps: 0,
      lapses: 0,
      state: "learning" as const,
      step: 0,
    } satisfies CardProg);
  const labels: Record<Grade, string> = {
    again: copy.again,
    hard: copy.hard,
    good: copy.good,
    easy: copy.easy,
  };

  return (
    <section className="mx-auto max-w-xl">
      <div className="mb-3 h-1 rounded-full bg-line">
        <div
          className="h-1 rounded-full bg-accent"
          style={{
            width: `${Math.round((100 * stats.reviews) / Math.max(1, stats.reviews + order.length - index))}%`,
          }}
        />
      </div>
      <div key={current.id + String(revealed)} className="panel rise p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3 text-sm text-muted">
          <span>
            {current.isNew ? copy.newCard : copy.reviewCard}
            {face.level ? ` · ${face.level}` : ""}
            {face.pos ? ` · ${face.pos}` : ""}
          </span>
          <span className="tabular-nums">
            {index + 1} / {order.length}
          </span>
        </div>
        <div className="px-2 py-8 text-center">
          <h2 lang="en" dir="ltr" className="lex-word text-5xl text-balance text-ink sm:text-6xl">
            {face.title}
          </h2>
          {face.ipa ? (
            <p lang="en" dir="ltr" className="mt-2 text-muted">
              {face.ipa}
            </p>
          ) : null}
          {face.pron ? (
            <p lang="fa" dir="rtl" className="mt-1 text-sm text-muted">
              {face.pron}
            </p>
          ) : null}
          <div className="mt-4 flex justify-center">
            <SpeakButton text={face.speak} label={copy.listen} />
          </div>
        </div>
        {revealed ? (
          <div className="border-t border-line pt-4">
            <p lang="fa" dir="rtl" className="text-xl font-medium text-pretty">
              {face.meaning}
            </p>
            {face.example ? (
              <blockquote lang="en" dir="ltr" className="mt-4 border-s-2 border-accent ps-3 text-pretty">
                {face.example}
              </blockquote>
            ) : null}
            {face.exampleFa ? (
              <p lang="fa" dir="rtl" className="mt-2 text-sm text-pretty text-muted">
                {face.exampleFa}
              </p>
            ) : null}
            {face.note ? (
              <details className="mt-3">
                <summary className="text-sm text-muted">{copy.note}</summary>
                <p lang="fa" dir="rtl" className="mt-2 text-sm whitespace-pre-wrap text-pretty text-muted">
                  {face.note}
                </p>
              </details>
            ) : null}
            <Explain word={face.title} meaning={face.meaning} example={face.example} pos={face.pos} />
          </div>
        ) : (
          <Button variant="secondary" className="w-full" onClick={() => setRevealed(true)}>
            {copy.reveal}
          </Button>
        )}
      </div>

      {revealed ? (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {GRADES.map((grade) => {
            const delay = schedule(base, grade, now).due - now;
            return (
              <button
                key={grade}
                type="button"
                onClick={() => answer(grade)}
                className={
                  grade === "good"
                    ? "flex min-h-14 flex-col items-center justify-center rounded-md bg-accent px-1 py-2 text-sm text-accent-fg"
                    : "flex min-h-14 flex-col items-center justify-center rounded-md bg-paper-2 px-1 py-2 text-sm shadow-[var(--shadow-border)]"
                }
              >
                <span className={grade === "again" ? "text-bad" : grade === "easy" ? "text-good" : grade === "good" ? "text-accent-fg" : "text-ink"}>
                  {labels[grade]}
                </span>
                <span className={grade === "good" ? "text-xs text-accent-fg" : "text-xs text-muted"}>{formatDelay(delay, lang)}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      <p className="mt-4 text-center text-xs text-muted">{copy.keyboardHint}</p>
    </section>
  );
}
