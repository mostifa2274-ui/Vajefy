import { useRef, useState } from "react";
import { useActiveTime } from "@/lib/learn/active-time";
import { useFormat } from "@/lib/learn/format";
import { posLabel, useCopy, type Copy } from "@/lib/learn/i18n";
import {
  advanceLesson,
  answerFor,
  answerLesson,
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
import { POS_FA, pronunciationFor, senseAudio, type PilotIndex, type PilotTarget } from "@/lib/learn/pilot";
import { newId } from "@/lib/learn/session";
import { useProgress } from "@/lib/learn/store";
import { cn } from "@/lib/cn";
import { useKeepFocus } from "@/lib/focus";
import { AnswerFeedback, Mark, ProgressMeter, WrongRight } from "./feedback";
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
};

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
  const [session, setSession] = useState(initial);
  const step = session.steps[session.index];
  const answered = answerFor(session);
  const elapsed = useActiveTime(step ? `${session.id}:${session.index}` : undefined);
  const stepTop = useRef<HTMLDivElement>(null);
  useKeepFocus(stepTop, `${session.index}:${Boolean(answered)}`);

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
      responseMs: elapsed(),
      contentVersion: index.bySense.get(ref.target)?.entry.version,
      sessionState: next,
    };
    // The delayed retrieval is the scheduled answer; everything else is practice.
    if (role === "delayed") review(ref.target, gradeOf(result), extras);
    else practice(ref.target, gradeOf(result), skillOf(ref, item), extras);
    setSession(next);
  }

  if (!step) {
    const stats = lessonStats(session);
    return (
      <section className="mx-auto max-w-xl">
        <h1 className="text-3xl font-medium text-balance">{copy.lessonDone}</h1>
        <p className="mt-3 text-muted">
          {num(stats.correct)} / {num(stats.answered)} {copy.correct}
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
    const target = index.bySense.get(step.target);
    if (!target) return <Skip copy={copy} onNext={onNext} />;
    return <Teach target={target} index={index} copy={copy} accent={accent} lang={lang} onDone={() => onTeachDone(step.target)} />;
  }
  if (step.kind === "contrast") {
    const contrast = index.pilot.contrasts.find((item) => item.id === step.contrast);
    if (!contrast) return <Skip copy={copy} onNext={onNext} />;
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
        <Button className="mt-6 w-full" onClick={onNext}>{copy.continueLabel}</Button>
      </div>
    );
  }
  if (step.kind === "scene") {
    const scene = index.pilot.scenes.find((item) => item.id === step.scene);
    if (!scene) return <Skip copy={copy} onNext={onNext} />;
    return <SceneRead scene={scene} copy={copy} lang={lang} onNext={onNext} />;
  }
  if (step.kind === "write") {
    const scene = index.pilot.scenes.find((item) => item.id === step.scene);
    if (!scene) return <Skip copy={copy} onNext={onNext} />;
    return <WriteTask scene={scene} copy={copy} answered={answered} onAnswer={onAnswer} onNext={onNext} />;
  }
  const item = resolveItem(index, step.ref);
  if (!item) return <Skip copy={copy} onNext={onNext} />;
  return (
    <Check
      item={item}
      role={step.role}
      copy={copy}
      answered={answered}
      onAnswer={(result, given) => onAnswer(step.ref, item, step.role, result, given)}
      onNext={onNext}
    />
  );
}

function Skip({ copy, onNext }: { copy: Copy; onNext: () => void }) {
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
  target: PilotTarget;
  index: PilotIndex;
  copy: Copy;
  accent: "en-GB" | "en-US";
  lang: "fa" | "en";
  onDone: () => void;
}) {
  const { sense, entry } = target;
  const clips = senseAudio(index.pilot.audio, sense.id, accent);
  return (
    <article className="panel p-4 sm:p-6">
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
          <SpeakButton text={entry.headword} label={copy.listen} clip={clips.word} slow />
        </div>
      </div>
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
              <SpeakButton text={example.en} label={copy.listenExample} clip={clips.examples[position]} />
            </div>
          </li>
        ))}
      </ul>
      <h3 className="mt-5 text-sm font-medium">{copy.collocationsLabel}</h3>
      <p lang="en" dir="ltr" className="mt-1 text-sm text-pretty">{sense.collocations.join(" · ")}</p>
      {sense.usage ? (
        <>
          <h3 className="mt-5 text-sm font-medium">{copy.usageLabel}</h3>
          <p lang="fa" dir="rtl" className="mt-1 text-sm text-pretty">{sense.usage}</p>
        </>
      ) : null}
      <h3 className="mt-5 text-sm font-medium">{copy.mistakeLabel}</h3>
      <div className="mt-1">
        <WrongRight wrong={sense.mistake.wrong} right={sense.mistake.right} why={sense.mistake.why} copy={copy} />
      </div>
      {!entry.released ? <p className="mt-4 text-xs text-muted">{copy.draftContent}</p> : null}
      <Button className="mt-6 w-full" onClick={onDone}>{copy.tryRecall}</Button>
    </article>
  );
}

function Check({
  item,
  role,
  copy,
  answered,
  onAnswer,
  onNext,
}: {
  item: ResolvedItem;
  role: Role;
  copy: Copy;
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
      {answered ? <Feedback item={item} answered={answered} copy={copy} onNext={onNext} /> : null}
    </div>
  );
}

function Feedback({ item, answered, copy, onNext }: { item: ResolvedItem; answered: LessonAnswer; copy: Copy; onNext: () => void }) {
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
    </AnswerFeedback>
  );
}

function SceneRead({ scene, copy, lang, onNext }: { scene: PilotIndex["pilot"]["scenes"][number]; copy: Copy; lang: "fa" | "en"; onNext: () => void }) {
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
  answered,
  onAnswer,
  onNext,
}: {
  scene: PilotIndex["pilot"]["scenes"][number];
  copy: Copy;
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
