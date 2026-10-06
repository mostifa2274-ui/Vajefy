import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { QuizRun } from "@/components/quiz-run";
import { PageHeader } from "@/components/ui";
import { cn } from "@/lib/cn";
import { rankSmartPractice, smartPracticeQuestions, type SmartPracticeTarget } from "@/lib/learn/adaptive";
import { useFormat } from "@/lib/learn/format";
import { useCopy, type Copy, type CopyKey } from "@/lib/learn/i18n";
import { loadLevel } from "@/lib/learn/load";
import { loadPilot, pronunciationFor, senseAudio } from "@/lib/learn/pilot";
import { lexQuestion } from "@/lib/learn/quiz";
import { resumable, startQuiz, type QuizSession } from "@/lib/learn/session";
import { useProgress } from "@/lib/learn/store";
import { shuffle } from "@/lib/learn/text";
import type { Lang, LevelId, Question } from "@/lib/learn/types";

/**
 * Practice has three modes (plan §4): Smart Practice, which chooses the skill
 * each word needs, and Listening and Spelling for a learner who wants one
 * skill. Every mode practises words the learner has already studied.
 */
type Mode = "smart" | "listen" | "spell";
type DrillSearch = { play?: Mode };

export const Route = createFileRoute("/drill")({
  validateSearch: (search: Record<string, unknown>): DrillSearch => {
    if (search.play === "smart" || search.play === "listen" || search.play === "spell") {
      return { play: search.play };
    }
    return {};
  },
  component: DrillPage,
});

const LEVELS: LevelId[] = ["A1", "A2", "B1", "B2", "B2x", "C1"];

const MODES: { id: Mode; title: CopyKey; hint: CopyKey }[] = [
  { id: "smart", title: "smartPractice", hint: "smartPracticeHint" },
  { id: "listen", title: "modeListen", hint: "hintListen" },
  { id: "spell", title: "modeSpell", hint: "hintSpell" },
];

function DrillPage() {
  const initial = Route.useSearch();
  const lang = useProgress((state) => state.lang);
  const hydrated = useProgress((state) => state.hydrated);
  const saveSession = useProgress((state) => state.saveSession);
  const sessions = useProgress((state) => state.sessions);
  const copy = useCopy(lang);
  const { num, sep } = useFormat();
  const [mode, setMode] = useState<Mode>(initial.play ?? "smart");
  const [count, setCount] = useState(10);
  const [arena, setArena] = useState<QuizSession | null>(null);
  const [error, setError] = useState<"load" | "empty" | null>(null);
  const [busy, setBusy] = useState(false);

  // Opened once per page view; a round finished elsewhere drops out by itself.
  const [now] = useState(() => Date.now());
  const unfinished = hydrated ? resumable(sessions, "quiz", now) : undefined;

  function begin(questions: Question[], smart: boolean) {
    const at = Date.now();
    if (unfinished) saveSession({ ...unfinished, status: "done", updatedAt: at });
    const session = startQuiz(questions, mode, smart, at);
    saveSession(session);
    setArena(session);
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "smart") {
        // Rank first so enhanced content is loaded only for plausible questions,
        // not for every word the learner has ever studied.
        const current = useProgress.getState();
        const now = Date.now();
        const ranked = rankSmartPractice(current.cards, now, current.requestRetention, current.practiceSkills);
        const candidateIds = ranked.slice(0, Math.max(20, count * 4)).map((candidate) => candidate.id);
        const levels = LEVELS.filter((id) => candidateIds.some((key) => key.startsWith(`lex:${id}:`)));
        const words = (await Promise.all(levels.map(loadLevel))).flat();

        const targets: Record<string, SmartPracticeTarget> = {};
        try {
          const pilot = await loadPilot(candidateIds);
          for (const id of candidateIds) {
            const target = pilot.content.get(id);
            if (!target) continue;
            const example = target.sense.examples[0];
            const clips = senseAudio(pilot.audio, id, current.accent);
            targets[id] = {
              word: {
                id,
                w: target.entry.headword,
                pr: "",
                ipa: pronunciationFor(target.sense, current.accent),
                pos: target.sense.pos,
                fa: target.sense.gloss,
                ex: example?.en ?? target.entry.headword,
                tr: example?.fa ?? target.sense.meaning,
              },
              ...(clips.word ? { clip: clips.word } : {}),
            };
          }
        } catch {
          // Smart Practice remains usable with the classic dataset if enhanced
          // content is temporarily unavailable.
        }

        // Read after loading so a review/reset in another tab cannot start a
        // stale session from the earlier snapshot.
        const latest = useProgress.getState();
        const built = smartPracticeQuestions(words, latest.cards, count, copy, lang, now, latest.requestRetention, {
          evidence: latest.practiceSkills,
          allowListening: Boolean(window.speechSynthesis),
          targets,
        });
        if (!built.length) {
          setError("empty");
          setArena(null);
        } else {
          begin(built, true);
        }
      } else {
        const built = await studiedQuestions(mode, count, copy, lang);
        if (!built.length) {
          setError("empty");
          setArena(null);
        } else {
          begin(built, false);
        }
      }
    } catch {
      setError("load");
    } finally {
      setBusy(false);
    }
  }

  if (arena) {
    return (
      <QuizRun
        key={arena.id}
        initial={arena}
        lang={lang}
        onDone={() => setArena(null)}
        title={arena.smart ? copy.smartPractice : undefined}
      />
    );
  }

  const unfinishedLeft = unfinished ? unfinished.questions.length - unfinished.index : 0;

  return (
    <div>
      <PageHeader title={copy.drill} lede={copy.drillLead} />
      {unfinished ? (
        <div className="panel mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">
            <span className="font-medium">{copy.resumeQuiz}</span>
            <span className="text-muted">
              {sep}
              {unfinished.smart ? copy.smartPractice : copy.drill}
              {sep}
              {num(unfinishedLeft)} {copy.leftLabel}
            </span>
          </p>
          <button
            type="button"
            onClick={() => setArena(unfinished)}
            className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg"
          >
            {copy.resumeQuiz}
          </button>
        </div>
      ) : null}
      <div role="group" aria-label={copy.drill} className="grid gap-2 sm:grid-cols-3">
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={mode === item.id}
            disabled={busy}
            onClick={() => {
              setMode(item.id);
              setError(null);
            }}
            className={cn(
              "min-h-11 rounded-lg p-3 text-start",
              mode === item.id ? "bg-ink text-paper" : "bg-paper-2 shadow-[var(--shadow-border)]",
            )}
          >
            <span className="block text-sm font-medium">{copy[item.title]}</span>
            <span className={cn("mt-1 block text-xs text-pretty", mode === item.id ? "text-paper/70" : "text-muted")}>{copy[item.hint]}</span>
          </button>
        ))}
      </div>

      {mode === "smart" ? (
        <p className="mt-4 max-w-2xl text-sm text-pretty text-muted">{copy.smartPracticeLead}</p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {[10, 20].map((n) => (
          <Choice key={n} active={count === n} disabled={busy} onClick={() => setCount(n)}>
            {num(n)}
          </Choice>
        ))}
      </div>

      {error ? (
        <div className="mt-4" role="status">
          <p className={error === "load" ? "text-sm text-bad" : "text-sm text-muted"}>
            {error === "load" ? copy.loadFailed : mode === "smart" ? copy.smartPracticeEmpty : copy.thinPool}
          </p>
          {error === "empty" ? (
            mode === "smart" ? (
              <Link to="/study" className="mt-2 inline-flex min-h-11 items-center text-sm text-accent">{copy.startSession}</Link>
            ) : (
              <Link to="/learn" className="mt-2 inline-flex min-h-11 items-center text-sm text-accent">{copy.learn}</Link>
            )
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        disabled={busy || !hydrated}
        onClick={() => void start()}
        className="mt-5 inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-ink disabled:opacity-40"
      >
        {busy ? copy.loading : copy.startDrill}
      </button>
    </div>
  );
}

function Choice({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-h-11 shrink-0 rounded-md px-3 text-sm",
        active ? "bg-ink text-paper" : "bg-paper-2 shadow-[var(--shadow-border)]",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Listening or spelling questions for words the learner has studied, with
 * wrong options drawn from the rest of their level.
 */
async function studiedQuestions(mode: "listen" | "spell", count: number, copy: Copy, lang: Lang): Promise<Question[]> {
  const cards = useProgress.getState().cards;
  const studied = Object.keys(cards);
  const levels = LEVELS.filter((id) => studied.some((key) => key.startsWith(`lex:${id}:`)));
  const pool = (await Promise.all(levels.map(loadLevel))).flat();
  const questions: Question[] = [];
  for (const word of shuffle(pool.filter((item) => cards[item.id]))) {
    if (questions.length >= count) break;
    const question = lexQuestion(word, pool, mode, copy, lang);
    if (question) questions.push(question);
  }
  if (mode === "spell") return questions;

  // Listening uses the recorded clip where one exists, else the device voice.
  try {
    const { accent } = useProgress.getState();
    const pilot = await loadPilot(questions.map((question) => question.id));
    for (const question of questions) {
      const clip = senseAudio(pilot.audio, question.id, accent).word;
      if (clip && question.kind === "mcq") question.clip = clip;
    }
  } catch {
    // Without enhanced audio, the device voice still reads each word.
  }
  const voice = typeof window !== "undefined" && Boolean(window.speechSynthesis);
  return questions.filter((question) => voice || (question.kind === "mcq" && question.clip));
}
