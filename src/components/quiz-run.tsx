import { useEffect, useState } from "react";
import { useCopy } from "@/lib/learn/i18n";
import { cancelSpeech, speakEnglish } from "@/lib/learn/speech";
import { formMatches, bestSpelling } from "@/lib/learn/text";
import { useFormat } from "@/lib/learn/format";
import type { Grade, Lang, Question } from "@/lib/learn/types";
import { cn } from "@/lib/cn";
import { Button, SpeakButton } from "./ui";

type Miss = { prompt: string; answer: string };

export function QuizRun({
  questions,
  lang,
  onGrade,
  onDone,
}: {
  questions: Question[];
  lang: Lang;
  onGrade: (id: string, grade: Grade) => void;
  onDone: () => void;
}) {
  const copy = useCopy(lang);
  const { num } = useFormat();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [past, setPast] = useState("");
  const [pp, setPp] = useState("");
  const [verdict, setVerdict] = useState<"exact" | "close" | "wrong" | null>(null);
  const [misses, setMisses] = useState<Miss[]>([]);
  const [correct, setCorrect] = useState(0);
  const question = questions[index];

  useEffect(() => {
    if (question?.kind === "mcq" && question.speak) speakEnglish(question.speak);
    return () => cancelSpeech();
  }, [question]);

  if (!question) {
    return (
      <section className="mx-auto max-w-xl">
        <p className="text-sm text-accent">{copy.scoreLabel}</p>
        <h1 className="mt-1 text-3xl font-medium">
          {num(correct)} / {num(questions.length)}
        </h1>
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

  function finish(grade: Grade, prompt: string, answer: string) {
    onGrade(question.id, grade);
    if (grade === "again") setMisses((list) => [...list, { prompt, answer }]);
    else setCorrect((count) => count + 1);
    setVerdict(grade === "again" ? "wrong" : grade === "hard" ? "close" : "exact");
  }

  function advance() {
    setIndex((value) => value + 1);
    setPicked(null);
    setTyped("");
    setPast("");
    setPp("");
    setVerdict(null);
  }

  const locked = verdict !== null;

  return (
    <section className="mx-auto max-w-xl">
      <div className="mb-3 flex items-center justify-between text-sm text-muted">
        <span className="tabular-nums">
          {num(index + 1)} / {num(questions.length)}
        </span>
        <span className="tabular-nums">
          {num(correct)} {copy.correct}
        </span>
      </div>
      <div className="panel p-4 sm:p-6">
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
                  finish(grade, question.base, `${question.past} · ${question.pp}`);
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
                        const ok = option.key === question.answerKey;
                        // A listening prompt is only "What did you hear?"; list the word instead.
                        finish(ok ? "good" : "again", question.speak ?? question.prompt, question.reveal || "");
                      }}
                      className={cn(
                        "min-h-11 rounded-md border px-3 py-2 text-start text-pretty",
                        right ? "border-good" : wrong ? "border-bad" : "border-line bg-paper",
                      )}
                    >
                      {option.text}
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
                  finish(grade, question.prompt, question.answer);
                }}
              >
                <input
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
          <div className="mt-4 border-t border-line pt-4" aria-live="polite">
            <p className={verdict === "wrong" ? "text-bad" : "text-good"}>
              {verdict === "wrong"
                ? copy.incorrect
                : verdict === "close" && question.kind === "type"
                  ? copy.closeTypo
                  : copy.correct}
            </p>
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
            <Button className="mt-4 w-full" onClick={advance}>
              {copy.next}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
