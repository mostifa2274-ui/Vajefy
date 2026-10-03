import { useEffect, useRef, useState } from "react";
import { useActiveTime } from "@/lib/learn/active-time";
import { useFormat } from "@/lib/learn/format";
import { posLabel, useCopy } from "@/lib/learn/i18n";
import {
  answerReview,
  lastUndoable,
  newId,
  nextReview,
  reviewStats,
  undoReview,
  type ReviewSession,
} from "@/lib/learn/session";
import { freshCard, schedule } from "@/lib/learn/srs";
import { cancelSpeech, speakEnglish } from "@/lib/learn/speech";
import { useProgress } from "@/lib/learn/store";
import { formatDelay } from "@/lib/learn/text";
import type { CardProg, Grade, Lang, StudyFace } from "@/lib/learn/types";
import { useKeepFocus } from "@/lib/focus";
import { ProgressMeter } from "./feedback";
import { Button, SpeakButton } from "./ui";

const GRADES: Grade[] = ["again", "hard", "good", "easy"];

/**
 * One review sitting. Every change is saved with the session, so leaving and
 * returning resumes at the same card; each grade is saved together with it.
 */
export function StudySession({
  initial,
  faces,
  cards,
  lang,
  voice,
  requestRetention,
  resumed,
  onExit,
  onNewSession,
}: {
  initial: ReviewSession;
  faces: Map<string, StudyFace>;
  cards: Record<string, CardProg>;
  lang: Lang;
  voice: boolean;
  requestRetention: number;
  resumed: boolean;
  onExit: () => void;
  onNewSession: () => void;
}) {
  const copy = useCopy(lang);
  const { num, pct, sep } = useFormat();
  const review = useProgress((state) => state.review);
  const undo = useProgress((state) => state.undo);
  const saveSession = useProgress((state) => state.saveSession);
  const [session, setSession] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const next = nextReview(session, now);
  const current = "item" in next ? next.item : undefined;
  const face = current ? faces.get(current.id) : undefined;
  const teaching = Boolean(current?.isNew && !session.taught.includes(current.id));
  const elapsed = useActiveTime(current ? `${current.id}:${session.answers.length}` : undefined);
  const stats = reviewStats(session);
  const word = useRef<HTMLHeadingElement>(null);
  useKeepFocus(word, `${stats.reviews}:${current?.id ?? ""}:${session.revealed}:${teaching}`);
  const undoable = lastUndoable(session);

  function update(changed: ReviewSession) {
    setSession(changed);
    saveSession(changed);
  }

  // While only cards that are not yet due again remain, count down to the next.
  const waitUntil = "waitUntil" in next ? next.waitUntil : 0;
  useEffect(() => {
    if (!waitUntil) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [waitUntil]);

  useEffect(() => {
    if (!voice || !face) return;
    speakEnglish(face.speak, face.clip);
    return () => cancelSpeech();
  }, [face, voice]);

  function reveal() {
    if (session.revealed) return;
    update({ ...session, revealed: true, updatedAt: Date.now() });
  }

  function beginRecall() {
    if (!current) return;
    update({ ...session, taught: [...session.taught, current.id], revealed: false, updatedAt: Date.now() });
  }

  function answer(grade: Grade) {
    if (!current) return;
    const at = Date.now();
    const op = newId();
    const card = schedule(cards[current.id] ?? freshCard(at), grade, at, requestRetention);
    const changed = answerReview(session, current.id, grade, card, op, at);
    review(current.id, grade, {
      id: op,
      at,
      session: session.id,
      prompt: current.isNew ? "recall-new" : "recall",
      ...(face?.version ? { contentVersion: face.version } : {}),
      responseMs: elapsed(),
      sessionState: changed,
    });
    setSession(changed);
    setNow(at);
  }

  function undoLast() {
    if (!undoable) return;
    const changed = undoReview(session, undoable.op, Date.now());
    undo(undoable.op, changed);
    setSession(changed);
    setNow(Date.now());
  }

  function finish() {
    update({ ...session, status: "done", updatedAt: Date.now() });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || !current) return;
      if (event.key === " ") {
        event.preventDefault();
        if (teaching) beginRecall();
        else reveal();
        return;
      }
      if (teaching || !session.revealed) return;
      const grade = ({ "1": "again", "2": "hard", "3": "good", "4": "easy" } as const)[event.key];
      if (grade) {
        event.preventDefault();
        answer(grade);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const undoButton = undoable ? (
    <button type="button" onClick={undoLast} className="min-h-11 px-1 text-sm text-accent">
      {copy.undoGrade}
    </button>
  ) : null;

  if ("done" in next || session.status === "done") {
    const accuracy = stats.reviews ? stats.correct / stats.reviews : 0;
    return (
      <section className="mx-auto max-w-xl">
        <h1 className="text-3xl font-medium text-balance">{copy.sessionDone}</h1>
        <p className="mt-3 text-muted">
          {num(stats.reviews)} {copy.reviewed}
          {stats.reviews ? `${sep}${pct(accuracy)}` : ""}
        </p>
        {stats.misses.length ? (
          <div className="mt-6">
            <h2 className="text-sm text-muted">{copy.missesTitle}</h2>
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {stats.misses.map((id) => (
                <li key={id} lang="en" dir="ltr" className="lex-word py-2 text-lg">
                  {faces.get(id)?.title ?? id}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">{copy.cleanSession}</p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={onExit}>{copy.backHome}</Button>
          {undoButton}
        </div>
      </section>
    );
  }

  const done = stats.reviews;
  const remaining = session.queue.length;
  const progressBar = <ProgressMeter value={done} max={done + remaining} label={copy.sessionProgress} count={false} />;

  if ("waitUntil" in next) {
    const seconds = Math.max(0, Math.ceil((next.waitUntil - now) / 1000));
    return (
      <section className="mx-auto max-w-xl">
        {progressBar}
        <div className="panel p-4 sm:p-6" role="status">
          <h1 className="text-2xl font-medium">
            {copy.waitingTitle}{" "}
            <span className="tabular-nums" dir="ltr">
              {num(Math.floor(seconds / 60))}:{String(seconds % 60).padStart(2, "0")}
            </span>
          </h1>
          <p className="mt-2 text-sm text-pretty text-muted">{copy.waitingHint}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={finish}>{copy.finishNow}</Button>
            <Button
              variant="secondary"
              onClick={() => {
                const soonest = [...session.queue].sort((a, b) => a.dueAt - b.dueAt)[0]!;
                update({
                  ...session,
                  queue: [{ ...soonest, dueAt: 0 }, ...session.queue.filter((item) => item !== soonest)],
                  updatedAt: Date.now(),
                });
              }}
            >
              {copy.showNow}
            </Button>
          </div>
        </div>
        <div className="mt-2">{undoButton}</div>
      </section>
    );
  }

  if (!current || !face) return null;
  const base: CardProg = cards[current.id] ?? freshCard(now);
  const labels: Record<Grade, string> = {
    again: copy.again,
    hard: copy.hard,
    good: copy.good,
    easy: copy.easy,
  };

  return (
    <section className="mx-auto max-w-xl">
      {resumed ? (
        <p className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted" role="status">
          <span>{copy.resumed}</span>
          <button type="button" onClick={onNewSession} className="min-h-11 text-accent">
            {copy.newSessionInstead}
          </button>
        </p>
      ) : null}
      {progressBar}
      <div key={current.id + String(session.revealed) + String(teaching)} className="panel rise p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3 text-sm text-muted">
          <span>
            {teaching ? copy.teachNew : current.isNew ? copy.newCard : copy.reviewCard}
            {face.level ? `${sep}${face.level}` : ""}
            {face.pos ? `${sep}${posLabel(face.pos, lang)}` : ""}
          </span>
          <span className="tabular-nums">
            {num(done + 1)} / {num(done + remaining)}
          </span>
        </div>
        {teaching ? <p className="mt-3 text-sm text-pretty text-muted">{copy.teachNewHint}</p> : null}
        <div className="px-2 py-8 text-center">
          <h2 ref={word} tabIndex={-1} lang="en" dir="ltr" className="lex-word text-5xl text-balance text-ink outline-none sm:text-6xl">
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
            <SpeakButton text={face.speak} label={copy.listen} clip={face.clip} slow item={face.id} />
          </div>
        </div>

        {teaching || session.revealed ? <Meaning face={face} noteLabel={copy.note} exampleLabel={copy.listenExample} draftLabel={copy.draftContent} /> : null}

        {teaching ? (
          <Button className="mt-5 w-full" onClick={beginRecall}>
            {copy.tryRecall}
          </Button>
        ) : !session.revealed ? (
          <Button variant="secondary" className="w-full" onClick={reveal}>
            {copy.reveal}
          </Button>
        ) : null}
      </div>

      {!teaching && session.revealed ? (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {GRADES.map((grade) => {
            const delay = schedule(base, grade, now, requestRetention).due - now;
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
                <span
                  className={
                    grade === "again"
                      ? "text-bad"
                      : grade === "easy"
                        ? "text-good"
                        : grade === "good"
                          ? "text-accent-fg"
                          : "text-ink"
                  }
                >
                  {labels[grade]}
                </span>
                <span className={grade === "good" ? "text-xs text-accent-fg" : "text-xs text-muted"}>
                  {formatDelay(delay, lang)}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="mt-3 flex min-h-11 items-center justify-between gap-3">
        <p className="text-xs text-muted">{teaching ? copy.teachNewHint : copy.keyboardHint}</p>
        {undoButton}
      </div>
    </section>
  );
}

function Meaning({
  face,
  noteLabel,
  exampleLabel,
  draftLabel,
}: {
  face: StudyFace;
  noteLabel: string;
  exampleLabel: string;
  draftLabel: string;
}) {
  return (
    <div className="border-t border-line pt-4">
      <p lang="fa" dir="rtl" className="text-xl font-medium text-pretty">
        {face.meaning}
      </p>
      {face.detail ? (
        <p lang="fa" dir="rtl" className="mt-2 text-sm text-pretty text-muted">
          {face.detail}
        </p>
      ) : null}
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
      {face.example && face.exampleClip ? (
        <div className="mt-2">
          <SpeakButton text={face.example} label={exampleLabel} clip={face.exampleClip} item={face.id} exposure="example" />
        </div>
      ) : null}
      {face.note ? (
        <details className="mt-3">
          <summary className="min-h-11 text-sm text-muted">{noteLabel}</summary>
          <p lang="fa" dir="rtl" className="mt-2 text-sm whitespace-pre-wrap text-pretty text-muted">
            {face.note}
          </p>
        </details>
      ) : null}
      {face.draft ? <p className="mt-3 text-xs text-muted">{draftLabel}</p> : null}
    </div>
  );
}
