import { useEffect, useRef, useState } from "react";
import { useActiveTime } from "@/lib/learn/active-time";
import { useCopy } from "@/lib/learn/i18n";
import { advanceQuiz, answerQuiz, newId, quizAnswerFor, quizStats, type QuizAnswer, type QuizSession } from "@/lib/learn/session";
import { cancelSpeech, speakEnglish } from "@/lib/learn/speech";
import { useProgress } from "@/lib/learn/store";
import { formMatches, bestSpelling } from "@/lib/learn/text";
import { useFormat } from "@/lib/learn/format";
import type { Grade, Lang, Question } from "@/lib/learn/types";
import { cn } from "@/lib/cn";
import { useKeepFocus } from "@/lib/focus";
import { AnswerFeedback, Mark, ProgressMeter } from "./feedback";
import { Button, SpeakButton } from "./ui";

type Miss = { prompt: string; answer: string };

/** Event handlers read the clock through this, outside render. */
function timestamp() {
  return Date.now();
}

function missOf(question: Question): Miss {
  if (question.kind === "irregular") return { prompt: question.base, answer: `${question.past} · ${question.pp}` };
  if (question.kind === "type") return { prompt: question.prompt, answer: question.answer };
  // A listening prompt is only "What did you hear?"; list the word instead.
  return { prompt: question.speak ?? question.prompt, answer: question.reveal || "" };
}

function verdictOf(answer: QuizAnswer | undefined): "exact" | "close" | "wrong" | null {
  if (!answer || answer.grade === "skipped") return null;
  return answer.grade === "again" ? "wrong" : answer.grade === "hard" ? "close" : "exact";
}

/**
 * A practice round saved with every answer: leaving midway resumes at the same
 * question, an answered question shows its result again instead of being
 * re-asked, and the score is rebuilt from the saved answers.
 */
export function QuizRun({
  initial,
  lang,
  onDone,
  title,
}: {
  initial: QuizSession;
  lang: Lang;
  onDone: () => void;
  title?: string;
}) {
  const copy = useCopy(lang);
  const { num } = useFormat();
  const practice = useProgress((state) => state.practice);
  const skip = useProgress((state) => state.skip);
  const saveSession = useProgress((state) => state.saveSession);
  const [session, setSession] = useState(initial);
  const questions = session.questions;
  const index = session.index;
  const question = questions[index];
  const answered = quizAnswerFor(session);
  const [draft, setDraft] = useState<{ index: number; picked: string | null; typed: string; past: string; pp: string }>({
    index,
    picked: null,
    typed: "",
    past: "",
    pp: "",
  });
  // Inputs belong to one question; a saved answer wins over an unsent draft.
  const current = draft.index === index ? draft : { index, picked: null, typed: "", past: "", pp: "" };
  const picked = answered?.picked ?? current.picked;
  const typed = answered?.typed ?? current.typed;
  const past = answered?.past ?? current.past;
  const pp = answered?.pp ?? current.pp;
  const verdict = verdictOf(answered);
  const stats = quizStats(session);
  const elapsed = useActiveTime(question ? `${session.id}:${index}` : undefined);
  const card = useRef<HTMLDivElement>(null);
  useKeepFocus(card, `${index}:${Boolean(answered)}`);
  const setPicked = (value: string) => setDraft({ ...current, picked: value });
  const setTyped = (value: string) => setDraft({ ...current, typed: value });
  const setPast = (value: string) => setDraft({ ...current, past: value });
  const setPp = (value: string) => setDraft({ ...current, pp: value });

  useEffect(() => {
    if (question?.kind === "mcq" && question.speak && !answered) speakEnglish(question.speak);
    return () => cancelSpeech();
    // Speak once per question, not again when its answer is saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);

  function finish(grade: Grade, inputs: Partial<Pick<QuizAnswer, "picked" | "typed" | "past" | "pp">>) {
    const active = question;
    if (answered || !active) return;
    const at = timestamp();
    const op = newId();
    const next = answerQuiz(session, { op, grade, at, ...inputs });
    practice(active.id, grade, active.practiceSkill, {
      id: op,
      at,
      session: session.id,
      prompt: `${session.mode}:${active.kind}`,
      responseMs: elapsed(),
      sessionState: next,
    });
    setSession(next);
  }

  function skipQuestion() {
    const active = question;
    if (answered || !active) return;
    const at = timestamp();
    const op = newId();
    const next = advanceQuiz(answerQuiz(session, { op, grade: "skipped", at }), at);
    skip(active.id, active.practiceSkill, {
      id: op,
      at,
      session: session.id,
      prompt: `${session.mode}:${active.kind}`,
      sessionState: next,
    });
    setSession(next);
  }

  function advance() {
    const next = advanceQuiz(session, Date.now());
    saveSession(next);
    setSession(next);
  }

  if (!question) {
    const misses = session.answers
      .filter((entry) => entry.grade === "again")
      .map((entry) => missOf(questions[entry.question]!));
    return (
      <section className="mx-auto max-w-xl">
        <p className="text-sm text-accent">{copy.scoreLabel}</p>
        <h1 className="mt-1 text-3xl font-medium">
          {stats.answered === 0 ? copy.noPracticeAnswers : `${num(stats.correct)} / ${num(stats.answered)}`}
        </h1>
        {stats.skipped > 0 ? <p className="mt-2 text-sm text-muted">{num(stats.skipped)} {copy.audioSkipped}</p> : null}
        {misses.length ? (
          <div className="mt-6">
            <h2 className="text-sm text-muted">{copy.missed}</h2>
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {misses.map((miss, i) => (
                <li key={`${miss.prompt}-${i}`} className="py-3">
                  <p dir="auto" className="text-pretty">
                    {miss.prompt}
                  </p>
                  <p dir="auto" className="mt-1 text-sm text-good">
                    {miss.answer}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <Button className="mt-6" onClick={onDone}>
          {copy.roundAgain}
        </Button>
      </section>
    );
  }

  const locked = verdict !== null;

  return (
    <section className="mx-auto max-w-xl">
      {title ? <h1 className="mb-4 text-xl font-medium">{title}</h1> : null}
      <ProgressMeter value={index + 1} max={questions.length} label={copy.sessionProgress} />
      <p className="mb-3 text-end text-xs text-muted tabular-nums">
        {num(stats.correct)} {copy.correct}
      </p>
      <div ref={card} tabIndex={-1} className="panel p-4 outline-none sm:p-6">
        {question.kind === "irregular" ? (
          <div>
            <h2 lang="en" dir="ltr" className="lex-word text-4xl">
              {question.base}
            </h2>
            <p lang="fa" dir="rtl" className="mt-2 text-muted">
              {question.fa}
            </p>
            <div className="mt-5 grid gap-3">
              <label className="block text-sm">
                <span className="text-muted">{copy.past}</span>
                <input
                  value={past}
                  disabled={locked}
                  onChange={(event) => setPast(event.target.value)}
                  className="mt-1 h-11 w-full rounded-md border border-line bg-paper px-3"
                  dir="ltr"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted">{copy.participle}</span>
                <input
                  value={pp}
                  disabled={locked}
                  onChange={(event) => setPp(event.target.value)}
                  className="mt-1 h-11 w-full rounded-md border border-line bg-paper px-3"
                  dir="ltr"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </label>
            </div>
            {!locked ? (
              <Button
                className="mt-4 w-full"
                disabled={!past.trim() || !pp.trim()}
                onClick={() => {
                  const pastOk = formMatches(past, question.past);
                  const ppOk = formMatches(pp, question.pp);
                  const grade: Grade = pastOk && ppOk ? "good" : pastOk || ppOk ? "hard" : "again";
                  finish(grade, { past, pp });
                }}
              >
                {copy.check}
              </Button>
            ) : null}
          </div>
        ) : (
          <div>
            <p
              lang={question.promptDir === "ltr" ? "en" : "fa"}
              dir={question.promptDir}
              className={cn(
                "text-pretty",
                question.promptDir === "ltr" ? "lex-word text-3xl" : "text-2xl font-medium",
              )}
            >
              {question.prompt}
            </p>
            {question.kind === "mcq" && question.hint ? (
              <p className="mt-2 text-sm text-muted" dir="auto">
                {question.hint}
              </p>
            ) : null}
            {question.kind === "type" && question.hint ? (
              <p lang="en" dir="ltr" className="mt-2 text-sm text-muted">
                {question.hint}
              </p>
            ) : null}
            {question.kind === "mcq" && question.speak ? (
              <div className="mt-4">
                <SpeakButton text={question.speak} label={copy.replay} />
                {!locked ? (
                  <button type="button" className="ms-2 min-h-11 px-2 text-sm text-accent" onClick={skipQuestion}>{copy.skipAudio}</button>
                ) : null}
                {!locked ? <p className="mt-1 text-xs text-muted">{copy.skipAudioHint}</p> : null}
              </div>
            ) : null}

            {question.kind === "mcq" ? (
              <div className="mt-5 grid gap-2" role="group" aria-label={copy.meaning}>
                {question.options.map((option) => {
                  const chosen = picked === option.key;
                  const right = locked && option.key === question.answerKey;
                  const wrong = locked && chosen && option.key !== question.answerKey;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      disabled={locked}
                      dir={option.dir}
                      lang={option.dir === "ltr" ? "en" : "fa"}
                      onClick={() => {
                        setPicked(option.key);
                        finish(option.key === question.answerKey ? "good" : "again", { picked: option.key });
                      }}
                      className={cn(
                        "min-h-11 rounded-md border px-3 py-2 text-start text-pretty",
                        right ? "border-good" : wrong ? "border-bad" : "border-line bg-paper",
                      )}
                    >
                      {right || wrong ? <Mark ok={right} copy={copy} /> : null}
                      {option.text}
                      {chosen && locked ? <span className="sr-only"> ({copy.yourAnswer})</span> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {question.kind === "type" ? (
              <form
                className="mt-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (locked) return;
                  const result = bestSpelling(typed, question.accept);
                  const grade: Grade = result === "exact" ? "good" : result === "close" ? "hard" : "again";
                  finish(grade, { typed });
                }}
              >
                <input
                  aria-label={copy.yourAnswer}
                  value={typed}
                  disabled={locked}
                  onChange={(event) => setTyped(event.target.value)}
                  placeholder={copy.typePlaceholder}
                  className="h-12 w-full rounded-md border border-line bg-paper px-3 text-lg"
                  dir="ltr"
                  lang="en"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                {!locked ? (
                  <Button className="mt-3 w-full" type="submit" disabled={!typed.trim()}>
                    {copy.check}
                  </Button>
                ) : null}
              </form>
            ) : null}
          </div>
        )}

        {locked ? (
          <AnswerFeedback
            ok={verdict !== "wrong"}
            title={verdict === "wrong" ? copy.incorrect : verdict === "close" && question.kind === "type" ? copy.closeTypo : copy.correct}
            nextLabel={copy.next}
            onNext={advance}
          >
            {question.kind !== "mcq" ? (
              <p dir="ltr" lang="en" className="mt-1">
                {question.kind === "irregular" ? `${question.past} · ${question.pp}` : question.answer}
              </p>
            ) : null}
            {question.kind !== "irregular" && question.explain ? (
              <p dir="auto" className="mt-2 text-sm text-pretty text-muted">
                {question.explain}
              </p>
            ) : null}
          </AnswerFeedback>
        ) : null}
      </div>
    </section>
  );
}
