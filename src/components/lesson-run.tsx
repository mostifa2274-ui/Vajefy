import { useDeferredValue, useEffect, useRef, useState, type ReactNode } from "react";
import type { CoachRequest } from "@/api/coach-core";
import { useActiveTime } from "@/lib/learn/active-time";
import { useFormat } from "@/lib/learn/format";
import { posLabel, useCopy, type Copy } from "@/lib/learn/i18n";
import {
  advanceLesson,
  answerFor,
  answerLesson,
  checkupResult,
  gradeOf,
  gradeTyped,
  lessonStats,
  resolveItem,
  skillOf,
  type ItemRef,
  type LessonAnswer,
  type LessonSession,
  type LessonStep,
  type ResolvedItem,
  type Role,
} from "@/lib/learn/lesson";
import { POS_FA, pronunciationFor, senseAudio, type PilotIndex, type Scene, type TargetContent } from "@/lib/learn/pilot";
import { newId } from "@/lib/learn/session";
import { useProgress } from "@/lib/learn/store";
import { cn } from "@/lib/cn";
import { useKeepFocus } from "@/lib/focus";
import { report } from "@/lib/telemetry";
import { AnswerFeedback, Mark, ProgressMeter, WrongRight } from "./feedback";
import { CoachPanel } from "./coach-panel";
import { SayIt } from "./say-it";
import { Button, Sep, SpeakButton } from "./ui";

/** Event handlers read the clock through this, outside render. */
function timestamp() {
  return Date.now();
}

const ROLE_LABEL: Record<Role, keyof Copy> = {
  retrieve: "roleRetrieve",
  context: "roleContext",
  delayed: "roleDelayed",
  retry: "roleRetry",
  apply: "roleApply",
  "checkup-use": "roleCheckupUse",
  "checkup-meaning": "roleCheckupMeaning",
};

/** Which prompt an answer was given to, so later check-ups can choose unseen ones. */
function promptIdOf(ref: ItemRef): string {
  if (ref.from === "sense") return `${ref.target}/${ref.item}`;
  if (ref.from === "contrast") return `${ref.contrast}/${ref.item}`;
  if (ref.from === "scene") return `${ref.scene}/${ref.item}`;
  return `generated:${ref.mode}`;
}

/**
 * Runs a guided lesson saved with every step. Teaching a target adds it to the
 * schedule; checks along the way are practice evidence; the delayed retrieval
 * is the scheduled answer that sets its next review.
 */
export function LessonRun({ initial, index, onExit }: { initial: LessonSession; index: PilotIndex; onExit: () => void }) {
  const lang = useProgress((state) => state.lang);
  const accent = useProgress((state) => state.accent);
  const copy = useCopy(lang);
  const { num } = useFormat();
  const addToReview = useProgress((state) => state.addToReview);
  const practice = useProgress((state) => state.practice);
  const review = useProgress((state) => state.review);
  const saveSession = useProgress((state) => state.saveSession);
  const assess = useProgress((state) => state.assess);
  const assessMissing = useProgress((state) => state.assessMissing);
  const [session, setSession] = useState(initial);
  const step = session.steps[session.index];
  const answered = answerFor(session);
  const elapsed = useActiveTime(step ? `${session.id}:${session.index}` : undefined);
  const stepTop = useRef<HTMLDivElement>(null);
  useKeepFocus(stepTop, `${session.index}:${Boolean(answered)}`);

  useEffect(() => {
    if (session.mode !== "checkup" || !session.missing) return;
    for (const [target, parts] of Object.entries(session.missing)) {
      for (const part of parts) {
        assessMissing(target, part, session.delays?.[target] ?? 0, {
          id: `${session.id}:missing:${target}:${part}`,
          at: session.createdAt,
          session: session.id,
          prompt: `checkup:${part}:missing`,
          contentVersion: index.bySense.get(target)?.entry.version,
        });
      }
    }
  }, [assessMissing, index, session.createdAt, session.delays, session.id, session.missing, session.mode]);

  function advance() {
    const next = advanceLesson(session, timestamp());
    saveSession(next);
    setSession(next);
    window.scrollTo?.({ top: 0 });
  }

  function teachDone(target: string) {
    addToReview(target);
    advance();
  }

  function record(ref: ItemRef, item: ResolvedItem, role: Role, result: LessonAnswer["result"], given: string) {
    const at = timestamp();
    const op = newId();
    const next = answerLesson(session, { op, result, given, at }, index);
    const extras = {
      id: op,
      at,
      session: session.id,
      prompt: `lesson:${role}:${item.type}`,
      promptId: promptIdOf(ref),
      responseMs: elapsed(),
      contentVersion: index.bySense.get(ref.target)?.entry.version,
      // A retry comes after feedback that showed the answer.
      ...(role === "retry" ? { hint: true } : {}),
      sessionState: next,
    };
    // A check-up only measures. The delayed retrieval is the scheduled answer;
    // everything else is practice.
    if (role === "checkup-use" || role === "checkup-meaning") {
      assess(ref.target, role === "checkup-use" ? "use" : "meaning", result !== "wrong", session.delays?.[ref.target] ?? 0, extras);
    } else if (role === "delayed") review(ref.target, gradeOf(result), extras);
    else practice(ref.target, gradeOf(result), skillOf(ref, item), extras);
    setSession(next);
  }

  if (!step) {
    const stats = lessonStats(session);
    const checkup = session.mode === "checkup" ? checkupResult(session) : null;
    return (
      <section className="mx-auto max-w-xl">
        <h1 className="text-3xl font-medium text-balance">{checkup ? copy.checkupDone : copy.lessonDone}</h1>
        <p className="mt-3 text-muted">
          {checkup ? (
            <>
              {copy.checkupUsable}: {num(checkup.usable)} / {num(checkup.checked)}
              {checkup.missing > 0 ? (
                <span className="mt-1 block text-xs text-muted">
                  {copy.checkupMissing}: {num(checkup.missing)}
                </span>
              ) : null}
            </>
          ) : (
            <>
              {num(stats.correct)} / {num(stats.answered)} {copy.correct}
            </>
          )}
        </p>
        {session.mode === "lesson" ? <p className="mt-2 text-sm text-pretty text-muted">{copy.lessonNext}</p> : null}
        {stats.missed.length ? (
          <div className="mt-6">
            <h2 className="text-sm text-muted">{copy.lessonMissed}</h2>
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {stats.missed.map((id) => {
                const target = index.bySense.get(id);
                return target ? (
                  <li key={id} className="flex items-baseline justify-between gap-3 py-2">
                    <span lang="en" dir="ltr" className="lex-word text-lg">{target.entry.headword}</span>
                    <span lang="fa" dir="rtl" className="text-sm text-muted">{target.sense.gloss}</span>
                  </li>
                ) : null;
              })}
            </ul>
          </div>
        ) : null}
        <Button className="mt-6" onClick={onExit}>
          {copy.backHome}
        </Button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-xl">
      <ProgressMeter value={session.index + 1} max={session.steps.length} label={copy.sessionProgress} />
      <div ref={stepTop} tabIndex={-1} className="outline-none">
      <StepView
        key={`${session.id}:${session.index}`}
        step={step}
        index={index}
        copy={copy}
        accent={accent}
        lang={lang}
        answered={answered}
        onTeachDone={teachDone}
        onAnswer={record}
        onNext={advance}
      />
      </div>
    </section>
  );
}

function StepView({
  step,
  index,
  copy,
  accent,
  lang,
  answered,
  onTeachDone,
  onAnswer,
  onNext,
}: {
  step: LessonStep;
  index: PilotIndex;
  copy: Copy;
  accent: "en-GB" | "en-US";
  lang: "fa" | "en";
  answered: LessonAnswer | undefined;
  onTeachDone: (target: string) => void;
  onAnswer: (ref: ItemRef, item: ResolvedItem, role: Role, result: LessonAnswer["result"], given: string) => void;
  onNext: () => void;
}) {
  if (step.kind === "teach") {
    const target = index.content.get(step.target);
    if (!target) return <Skip copy={copy} onNext={onNext} code={stepCode(step)} />;
    return <Teach target={target} index={index} copy={copy} accent={accent} lang={lang} onDone={() => onTeachDone(step.target)} />;
  }
  if (step.kind === "contrast") {
    const contrast = index.contrasts.find((item) => item.id === step.contrast);
    if (!contrast) return <Skip copy={copy} onNext={onNext} code={stepCode(step)} />;
    return (
      <div className="panel p-4 sm:p-6">
        <p className="text-sm text-accent">{copy.compareLabel}</p>
        <h2 lang="en" dir="ltr" className="lex-word mt-1 text-3xl">{contrast.title}</h2>
        <h3 className="mt-4 text-sm font-medium">{copy.sharedLabel}</h3>
        <p lang="fa" dir="rtl" className="mt-1 text-pretty">{contrast.shared}</p>
        <h3 className="mt-4 text-sm font-medium">{copy.differenceLabel}</h3>
        <p lang="fa" dir="rtl" className="mt-1 text-pretty">{contrast.difference}</p>
        <ul className="mt-4 grid gap-3">
          {contrast.patterns.map((pattern) => (
            <li key={pattern.en} className="border-s-2 border-accent ps-3">
              <p lang="en" dir="ltr" className="text-pretty">{pattern.en}</p>
              <p lang="fa" dir="rtl" className="mt-1 text-sm text-muted text-pretty">{pattern.fa}</p>
            </li>
          ))}
        </ul>
        <h3 className="mt-4 text-sm font-medium">{copy.unnaturalLabel}</h3>
        <ul className="mt-2 grid gap-3">
          {contrast.unnatural.map((item) => (
            <li key={item.wrong}>
              <WrongRight wrong={item.wrong} right={item.right} why={item.why} copy={copy} />
            </li>
          ))}
        </ul>
        <CoachPanel
          request={{ task: "difference", senses: contrast.entries.slice(0, 3), contrast: contrast.id }}
          label={copy.coachAskDifference}
          copy={copy}
          lang={lang}
        />
        <Button className="mt-6 w-full" onClick={onNext}>{copy.continueLabel}</Button>
      </div>
    );
  }
  if (step.kind === "scene") {
    const scene = index.scenes.find((item) => item.id === step.scene);
    if (!scene) return <Skip copy={copy} onNext={onNext} code={stepCode(step)} />;
    return <SceneRead scene={scene} copy={copy} lang={lang} onNext={onNext} />;
  }
  if (step.kind === "write") {
    const scene = index.scenes.find((item) => item.id === step.scene);
    if (!scene) return <Skip copy={copy} onNext={onNext} code={stepCode(step)} />;
    return <WriteTask scene={scene} copy={copy} lang={lang} answered={answered} onAnswer={onAnswer} onNext={onNext} />;
  }
  const item = resolveItem(index, step.ref);
  if (!item) return <Skip copy={copy} onNext={onNext} code={stepCode(step)} />;
  return (
    <Check
      item={item}
      role={step.role}
      copy={copy}
      lang={lang}
      // The coach explains taught items, never check-up items.
      coach={step.ref.from === "sense" && !step.role.startsWith("checkup") ? { task: "fit", senses: [step.ref.target], text: filled(item) } : undefined}
      answered={answered}
      onAnswer={(result, given) => onAnswer(step.ref, item, step.role, result, given)}
      onNext={onNext}
    />
  );
}

/** The sentence an item is about, with its answer in place, for the coach. */
function filled(item: ResolvedItem): string {
  if (item.type === "cloze") return item.text.replace("___", item.answer).slice(0, 300);
  if (item.type === "produce") return item.frame.replace("___", item.answer).slice(0, 300);
  const right = item.options.find((option) => option.ok)?.text ?? "";
  return `${item.prompt} — ${right}`.slice(0, 300);
}

/** What a step points at, for reporting content that could not be shown. */
function stepCode(step: LessonStep): string {
  if (step.kind === "teach") return step.target;
  if (step.kind === "contrast") return step.contrast;
  if (step.kind === "scene" || step.kind === "write") return step.scene;
  return step.ref.from === "generated" ? step.ref.target : `${step.ref.target}/${step.ref.item}`;
}

/** A step whose content is missing: say so, report it, and let the learner go on. */
function Skip({ copy, onNext, code }: { copy: Copy; onNext: () => void; code: string }) {
  useEffect(() => report("exercise-broken", code), [code]);
  return (
    <div className="panel p-4">
      <p className="text-sm text-muted">{copy.loadFailed}</p>
      <Button className="mt-4" onClick={onNext}>{copy.continueLabel}</Button>
    </div>
  );
}

function Teach({
  target,
  index,
  copy,
  accent,
  lang,
  onDone,
}: {
  target: TargetContent;
  index: PilotIndex;
  copy: Copy;
  accent: "en-GB" | "en-US";
  lang: "fa" | "en";
  onDone: () => void;
}) {
  const { sense, entry } = target;
  const clips = senseAudio(index.audio, sense.id, accent);
  // The word and its sound are drawn at once; the rest of the card follows in
  // a background render, so the press that starts a lesson answers quickly
  // instead of waiting for the whole card's text to be laid out.
  const full = useDeferredValue(target, null) === target;
  return (
    <article className="panel p-4 sm:p-6" aria-busy={!full}>
      <p className="text-sm text-muted">
        {copy.teachNew}
        <Sep />
        A1
        <Sep />
        {posLabel(POS_FA[sense.pos], lang)}
      </p>
      <div className="mt-4 text-center">
        <h2 lang="en" dir="ltr" className="lex-word text-5xl text-balance">{entry.headword}</h2>
        <p lang="en" dir="ltr" className="mt-2 text-muted">{pronunciationFor(sense, accent)}</p>
        {sense.pronunciation.note ? <p lang="fa" dir="rtl" className="mt-1 text-xs text-pretty text-muted">{sense.pronunciation.note}</p> : null}
        <div className="mt-3 flex justify-center">
          <SpeakButton text={entry.headword} label={copy.listen} clip={clips.word} slow item={sense.id} />
        </div>
      </div>
      {full ? (
        <>
          <SayIt text={entry.headword} clip={clips.word} copy={copy} />
          <div className="mt-5 border-t border-line pt-4">
            <p lang="fa" dir="rtl" className="text-xl font-medium">{sense.gloss}</p>
            <p lang="fa" dir="rtl" className="mt-2 text-pretty">{sense.meaning}</p>
          </div>
          <h3 className="mt-5 text-sm font-medium">{copy.grammarLabel}</h3>
          <ul className="mt-2 grid gap-2">
            {sense.grammar.map((item) => (
              <li key={item.pattern} className="text-sm">
                <p lang="en" dir="ltr" className="font-medium">{item.pattern}</p>
                <p lang="fa" dir="rtl" className="text-muted text-pretty">{item.note}</p>
              </li>
            ))}
          </ul>
          <h3 className="mt-5 text-sm font-medium">{copy.examplesLabel}</h3>
          <ul className="mt-2 grid gap-3">
            {sense.examples.map((example, position) => (
              <li key={example.en} className="border-s-2 border-accent ps-3">
                <p lang="en" dir="ltr" className="text-pretty">{example.en}</p>
                <p lang="fa" dir="rtl" className="mt-1 text-sm text-muted text-pretty">{example.fa}</p>
                <div className="mt-1">
                  <SpeakButton text={example.en} label={copy.listenExample} clip={clips.examples[position]} item={sense.id} exposure="example" />
                </div>
              </li>
            ))}
          </ul>
          <h3 className="mt-5 text-sm font-medium">{copy.collocationsLabel}</h3>
          {sense.collocationFa ? (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {sense.collocations.map((item) => (
                <li key={item} className="rounded-md bg-paper-2 px-3 py-2 text-sm shadow-[var(--shadow-border)]">
                  <p lang="en" dir="ltr" className="font-medium text-pretty">{item}</p>
                  <p lang="fa" dir="rtl" className="mt-0.5 text-xs text-muted text-pretty">
                    {sense.collocationFa?.[item]}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p lang="en" dir="ltr" className="mt-1 text-sm text-pretty">{sense.collocations.join(" · ")}</p>
          )}
          {sense.usage ? (
            <>
              <h3 className="mt-5 text-sm font-medium">{copy.usageLabel}</h3>
              <p lang="fa" dir="rtl" className="mt-1 text-sm text-pretty">{sense.usage}</p>
            </>
          ) : null}
          <h3 className="mt-5 text-sm font-medium">{copy.mistakeLabel}</h3>
          <div className="mt-1">
            <WrongRight
              wrong={sense.mistake.wrong}
              wrongFa={sense.mistake.wrongFa}
              right={sense.mistake.right}
              rightFa={sense.mistake.rightFa}
              why={sense.mistake.why}
              copy={copy}
            />
          </div>
          {!entry.released ? <p className="mt-4 text-xs text-muted">{copy.draftContent}</p> : null}
          <Button className="mt-6 w-full" onClick={onDone}>{copy.tryRecall}</Button>
        </>
      ) : null}
    </article>
  );
}

function Check({
  item,
  role,
  copy,
  lang,
  coach,
  answered,
  onAnswer,
  onNext,
}: {
  item: ResolvedItem;
  role: Role;
  copy: Copy;
  lang: "fa" | "en";
  coach?: Omit<CoachRequest, "lang">;
  answered: LessonAnswer | undefined;
  onAnswer: (result: LessonAnswer["result"], given: string) => void;
  onNext: () => void;
}) {
  const [typed, setTyped] = useState("");
  const given = answered?.given ?? "";
  const locked = Boolean(answered);

  return (
    <div className="panel p-4 sm:p-6">
      <p className="text-sm text-accent">{copy[ROLE_LABEL[role]]}</p>
      {item.type === "choice" ? (
        <>
          <p lang={item.promptLang} dir={item.promptLang === "fa" ? "rtl" : "ltr"} className={cn("mt-2 text-pretty", item.promptLang === "en" ? "lex-word text-3xl" : "text-xl font-medium")}>
            {item.prompt}
          </p>
          <TaskSupport support={item.support} copy={copy} />
          <div className="mt-4 grid gap-2" role="group" aria-label={copy.meaning}>
            {item.options.map((option) => {
              const chosen = locked && given === option.text;
              return (
                <button
                  key={option.text}
                  type="button"
                  disabled={locked}
                  lang={option.lang}
                  dir={option.lang === "fa" ? "rtl" : "ltr"}
                  onClick={() => onAnswer(option.ok ? "correct" : "wrong", option.text)}
                  className={cn(
                    "min-h-11 rounded-md border px-3 py-2 text-start text-pretty",
                    locked && option.ok ? "border-good" : chosen ? "border-bad" : "border-line bg-paper",
                  )}
                >
                  {locked && (option.ok || chosen) ? <Mark ok={option.ok} copy={copy} /> : null}
                  {option.text}
                  {chosen ? <span className="sr-only"> ({copy.yourAnswer})</span> : null}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <form
          className="mt-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (locked || !typed.trim()) return;
            onAnswer(gradeTyped(typed, item.answer, item.accept), typed.trim());
          }}
        >
          {item.type === "produce" ? (
            <p lang="fa" dir="rtl" className="text-xl font-medium text-pretty">{item.prompt}</p>
          ) : null}
          <p lang="en" dir="ltr" className="mt-3 text-xl text-pretty">
            {(item.type === "cloze" ? item.text : item.frame).split("___").map((part, position, parts) => (
              <span key={position}>
                {part}
                {position < parts.length - 1 ? <span className="mx-1 inline-block min-w-16 border-b-2 border-accent text-center">{locked ? given : " "}</span> : null}
              </span>
            ))}
          </p>
          <TaskSupport support={item.support} copy={copy} />
          <input
            aria-label={copy.yourAnswer}
            value={locked ? given : typed}
            disabled={locked}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={copy.typePlaceholder}
            className="mt-4 h-12 w-full rounded-md border border-line bg-paper px-3 text-lg"
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
      )}
      {answered ? (
        <Feedback item={item} answered={answered} copy={copy} onNext={onNext}>
          {coach ? <CoachPanel request={coach} label={copy.coachAskFit} copy={copy} lang={lang} /> : null}
        </Feedback>
      ) : null}
    </div>
  );
}

function TaskSupport({
  support,
  copy,
}: {
  support: ResolvedItem["support"];
  copy: Copy;
}) {
  if (!support?.length) return null;
  return (
    <div
      className="mt-3 rounded-md border border-line px-3 py-2"
      role="note"
      aria-label={copy.taskSupport}
    >
      <p className="text-xs font-semibold text-muted">{copy.taskSupport}</p>
      <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {support.map((item) => (
          <div
            key={`${item.en}:${item.fa}`}
            className="grid grid-cols-[auto_1fr] items-baseline gap-x-2"
          >
            <dt lang="en" dir="ltr" className="lex-word text-sm">
              {item.en}
            </dt>
            <dd lang="fa" dir="rtl" className="text-sm text-muted">
              {item.fa}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Feedback({
  item,
  answered,
  copy,
  onNext,
  children,
}: {
  item: ResolvedItem;
  answered: LessonAnswer;
  copy: Copy;
  onNext: () => void;
  children?: ReactNode;
}) {
  return (
    <AnswerFeedback
      ok={answered.result !== "wrong"}
      title={answered.result === "correct" ? copy.correct : answered.result === "close" ? copy.closeTypo : copy.incorrect}
      nextLabel={copy.next}
      onNext={onNext}
    >
      {item.type === "choice" ? (
        <ul className="mt-2 grid gap-2 text-sm">
          {item.options
            .filter((option) => option.ok || option.text === answered.given)
            .map((option) => (
              <li key={option.text}>
                <span lang={option.lang} dir={option.lang === "fa" ? "rtl" : "ltr"} className={option.ok ? "text-good" : "text-bad"}>
                  <Mark ok={option.ok} copy={copy} />
                  {option.text}
                </span>
                <p dir="auto" className="text-muted text-pretty">{option.why}</p>
              </li>
            ))}
        </ul>
      ) : (
        <>
          <p lang="en" dir="ltr" className="mt-1">
            {copy.answerLabel}: {item.answer}
          </p>
          {item.type === "cloze" ? <p lang="fa" dir="rtl" className="mt-1 text-sm text-muted text-pretty">{item.fa}</p> : null}
          <p lang="fa" dir="rtl" className="mt-2 text-sm text-pretty">{item.why}</p>
        </>
      )}
      {children}
    </AnswerFeedback>
  );
}

function SceneRead({ scene, copy, lang, onNext }: { scene: Scene; copy: Copy; lang: "fa" | "en"; onNext: () => void }) {
  const [translate, setTranslate] = useState(lang === "fa");
  return (
    <div className="panel p-4 sm:p-6">
      <p className="text-sm text-accent">{scene.kind === "dialogue" ? copy.dialogueLabel : copy.passageLabel}</p>
      <h2 lang="en" dir="ltr" className="lex-word mt-1 text-3xl">{scene.title}</h2>
      <p lang="fa" dir="rtl" className="text-sm text-muted">{scene.titleFa}</p>
      <button type="button" className="mt-2 min-h-11 text-sm text-accent" onClick={() => setTranslate((value) => !value)}>
        {translate ? copy.hideTranslation : copy.showTranslation}
      </button>
      <ol className="mt-3 grid gap-3">
        {scene.lines.map((line, position) => (
          <li key={position} className="rounded-md bg-paper-2 p-3">
            <p lang="en" dir="ltr" className="text-pretty">
              {line.speaker ? <span className="font-medium">{line.speaker}: </span> : null}
              {line.en}
            </p>
            {translate ? <p lang="fa" dir="rtl" className="mt-1 text-sm text-muted text-pretty">{line.fa}</p> : null}
            <div className="mt-1">
              <SpeakButton text={line.en} label={copy.listen} />
            </div>
          </li>
        ))}
      </ol>
      <Button className="mt-6 w-full" onClick={onNext}>{copy.continueLabel}</Button>
    </div>
  );
}

function WriteTask({
  scene,
  copy,
  lang,
  answered,
  onAnswer,
  onNext,
}: {
  scene: Scene;
  copy: Copy;
  lang: "fa" | "en";
  answered: LessonAnswer | undefined;
  onAnswer: (ref: ItemRef, item: ResolvedItem, role: Role, result: LessonAnswer["result"], given: string) => void;
  onNext: () => void;
}) {
  const [text, setText] = useState("");
  const [shown, setShown] = useState(false);
  const written = answered?.given ?? text;
  const words = written.toLowerCase().match(/[a-z']+/g) ?? [];
  const used = scene.write.use.map((word) => ({ word, ok: word.toLowerCase().split(" ").every((part) => words.some((token) => token.startsWith(part))) }));
  const target = scene.targets[0]!;
  const ref: ItemRef = { from: "scene", scene: scene.id, item: "write", target };
  const item: ResolvedItem = { type: "produce", prompt: scene.write.prompt, frame: "___", answer: scene.write.model, accept: [], why: "" };
  const assess = (works: boolean) => {
    const allUsed = used.every((entry) => entry.ok);
    onAnswer(ref, item, "apply", allUsed ? (works ? "correct" : "close") : "wrong", text.trim());
  };

  return (
    <div className="panel p-4 sm:p-6">
      <p className="text-sm text-accent">{copy.writeTitle}</p>
      <p lang="fa" dir="rtl" className="mt-2 text-pretty">{scene.write.prompt}</p>
      <textarea
        aria-label={copy.writeTitle}
        value={written}
        disabled={Boolean(answered)}
        onChange={(event) => setText(event.target.value)}
        placeholder={copy.writePlaceholder}
        rows={4}
        lang="en"
        dir="ltr"
        className="mt-3 w-full rounded-md border border-line bg-paper p-3"
      />
      <p className="mt-2 text-xs text-muted">{copy.usedWords}:</p>
      <ul className="mt-1 flex flex-wrap gap-2" lang="en" dir="ltr">
        {used.map((entry) => (
          <li key={entry.word} className={cn("rounded-md px-2 py-1 text-sm", entry.ok ? "bg-accent-soft text-ink" : "bg-paper-2 text-muted")}>
            {entry.ok ? "✓ " : ""}
            {entry.word}
          </li>
        ))}
      </ul>
      {!shown && !answered ? (
        <Button className="mt-4 w-full" disabled={!text.trim()} onClick={() => setShown(true)}>
          {copy.compareModel}
        </Button>
      ) : null}
      {shown || answered ? (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-sm text-muted">{copy.modelAnswer}</p>
          <p lang="en" dir="ltr" className="mt-1 text-pretty">{scene.write.model}</p>
          {written.trim() ? (
            <CoachPanel request={{ task: "sentence", senses: scene.targets.slice(0, 3), text: written.slice(0, 300) }} label={copy.coachAskSentence} copy={copy} lang={lang} />
          ) : null}
          {!answered ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => assess(true)}>{copy.selfWorks}</Button>
              <Button variant="secondary" onClick={() => assess(false)}>{copy.selfNeedsWork}</Button>
            </div>
          ) : (
            <Button className="mt-4 w-full" onClick={onNext}>{copy.next}</Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
