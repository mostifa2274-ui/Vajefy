import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MatchBoard } from "@/components/match-board";
import { QuizRun } from "@/components/quiz-run";
import { SprintRun } from "@/components/sprint-run";
import { PageHeader } from "@/components/ui";
import { cn } from "@/lib/cn";
import { smartPracticeQuestions } from "@/lib/learn/adaptive";
import { useFormat } from "@/lib/learn/format";
import { useCopy, type Copy, type CopyKey } from "@/lib/learn/i18n";
import { DECK_FILE, loadAntonyms, loadIrregular, loadLevel, loadPairs, loadPatterns } from "@/lib/learn/load";
import { playPairs, type PlayPair } from "@/lib/learn/play";
import {
  antonymQuestions,
  chunkQuestions,
  confusingQuestions,
  irregularQuestions,
  lexQuestions,
} from "@/lib/learn/quiz";
import { resumable, startQuiz, type QuizSession } from "@/lib/learn/session";
import { useProgress } from "@/lib/learn/store";
import type { Lang, LevelId, Question } from "@/lib/learn/types";

type DrillSearch = { play?: "match" | "sprint" | "studied" | "smart" };

export const Route = createFileRoute("/drill")({
  validateSearch: (search: Record<string, unknown>): DrillSearch => {
    if (search.play === "match" || search.play === "sprint" || search.play === "studied" || search.play === "smart") {
      return { play: search.play };
    }
    return {};
  },
  component: DrillPage,
});

const LEVELS: LevelId[] = ["A1", "A2", "B1", "B2", "B2x", "C1"];
const LEVEL_LABEL: Record<LevelId, string> = {
  A1: "A1",
  A2: "A2",
  B1: "B1",
  B2: "B2",
  B2x: "B2+",
  C1: "C1",
};

type Mode = "smart" | "match" | "sprint" | "to-fa" | "to-en" | "spell" | "cloze" | "listen" | "irr" | "ant" | "conf" | "chunk";
type Chunk = "pv" | "col" | "prep" | "vp" | "occ";

const MODES: { id: Mode; title: CopyKey; hint: CopyKey }[] = [
  { id: "smart", title: "smartPractice", hint: "smartPracticeHint" },
  { id: "match", title: "matchMode", hint: "matchHint" },
  { id: "sprint", title: "sprintMode", hint: "sprintHint" },
  { id: "to-fa", title: "modeToFa", hint: "hintToFa" },
  { id: "to-en", title: "modeToEn", hint: "hintToEn" },
  { id: "spell", title: "modeSpell", hint: "hintSpell" },
  { id: "cloze", title: "modeCloze", hint: "hintCloze" },
  { id: "listen", title: "modeListen", hint: "hintListen" },
  { id: "irr", title: "modeIrr", hint: "hintIrr" },
  { id: "ant", title: "modeAnt", hint: "hintAnt" },
  { id: "conf", title: "modeConf", hint: "hintConf" },
  { id: "chunk", title: "modeChunk", hint: "hintChunk" },
];

const CHUNKS: { id: Chunk; label: CopyKey }[] = [
  { id: "pv", label: "phrasal" },
  { id: "col", label: "collocations" },
  { id: "prep", label: "prepositions" },
  { id: "vp", label: "patterns" },
  { id: "occ", label: "occupations" },
];

function needsLevel(mode: Mode) {
  return mode === "match" || mode === "sprint" || mode === "to-fa" || mode === "to-en" || mode === "spell" || mode === "cloze" || mode === "listen";
}

type Arena =
  | { kind: "quiz"; session: QuizSession }
  | { kind: "match"; pairs: PlayPair[] }
  | { kind: "sprint"; pairs: PlayPair[] };

function DrillPage() {
  const initial = Route.useSearch();
  const lang = useProgress((state) => state.lang);
  const focus = useProgress((state) => state.focus);
  const hydrated = useProgress((state) => state.hydrated);
  const practice = useProgress((state) => state.practice);
  const saveSession = useProgress((state) => state.saveSession);
  const sessions = useProgress((state) => state.sessions);
  const copy = useCopy(lang);
  const { num } = useFormat();
  const [mode, setMode] = useState<Mode>(initial.play === "match" ? "match" : initial.play === "sprint" ? "sprint" : initial.play === "studied" ? "to-fa" : "smart");
  const [level, setLevel] = useState<LevelId>(focus);
  const [count, setCount] = useState(10);
  const [chunk, setChunk] = useState<Chunk>("col");
  const [direction, setDirection] = useState<"to-fa" | "to-en">("to-fa");
  const [studiedOnly, setStudiedOnly] = useState(initial.play === "studied");
  const [arena, setArena] = useState<Arena | null>(null);
  const [error, setError] = useState<"load" | "empty" | null>(null);
  const [busy, setBusy] = useState(false);

  // The saved level is only known after hydration; adopt it once, unless the
  // learner already picked a level on this page.
  const levelTouched = useRef(false);
  useEffect(() => {
    if (hydrated && !levelTouched.current) setLevel(focus);
  }, [hydrated, focus]);

  // Opened once per page view; a round finished elsewhere drops out by itself.
  const [now] = useState(() => Date.now());
  const unfinished = hydrated ? resumable(sessions, "quiz", now) : undefined;

  function begin(questions: Question[], smart: boolean) {
    const at = Date.now();
    if (unfinished) saveSession({ ...unfinished, status: "done", updatedAt: at });
    const session = startQuiz(questions, mode, smart, at);
    saveSession(session);
    setArena({ kind: "quiz", session });
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const cards = useProgress.getState().cards;
      if (mode === "smart") {
        const ids = Object.keys(cards);
        const levels = LEVELS.filter((id) => ids.some((key) => key.startsWith(`lex:${id}:`)));
        const words = (await Promise.all(levels.map(loadLevel))).flat();
        // Read after loading so a review/reset in another tab cannot start a
        // stale session from the earlier snapshot.
        const current = useProgress.getState();
        const built = smartPracticeQuestions(words, current.cards, count, copy, lang, Date.now(), current.requestRetention, {
          evidence: current.practiceSkills,
          allowListening: Boolean(window.speechSynthesis),
        });
        if (!built.length) {
          setError("empty");
          setArena(null);
        } else {
          begin(built, true);
        }
      } else if (mode === "match" || mode === "sprint") {
        const words = await loadLevel(level);
        const pool = studiedOnly ? words.filter((word) => cards[word.id]) : words;
        const pairs = playPairs(pool, mode === "match" ? 6 : 40);
        const minimum = mode === "match" ? 4 : 8;
        if (pairs.length < minimum) {
          setError("empty");
          setArena(null);
        } else {
          setArena({ kind: mode, pairs });
        }
      } else {
        const built = await build(mode, level, count, chunk, direction, copy, lang, studiedOnly, cards);
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

  if (arena?.kind === "quiz") {
    return (
      <QuizRun
        key={arena.session.id}
        initial={arena.session}
        lang={lang}
        onDone={() => setArena(null)}
        title={arena.session.smart ? copy.smartPractice : undefined}
      />
    );
  }

  if (arena?.kind === "match") {
    return (
      <MatchBoard
        pairs={arena.pairs}
        lang={lang}
        onPair={(id) => practice(id, "good", "meaning")}
        onExit={() => setArena(null)}
      />
    );
  }

  if (arena?.kind === "sprint") {
    return (
      <SprintRun
        pairs={arena.pairs}
        lang={lang}
        onResult={(id, ok) => practice(id, ok ? "good" : "again", "spelling")}
        onExit={() => setArena(null)}
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
              {" · "}
              {unfinished.smart ? copy.smartPractice : copy.drill} · {num(unfinishedLeft)} {copy.leftLabel}
            </span>
          </p>
          <button
            type="button"
            onClick={() => setArena({ kind: "quiz", session: unfinished })}
            className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg"
          >
            {copy.resumeQuiz}
          </button>
        </div>
      ) : null}
      <button
        type="button"
        aria-pressed={mode === "smart"}
        disabled={busy}
        onClick={() => {
          setMode("smart");
          setError(null);
        }}
        className={cn("w-full min-h-11 rounded-lg p-3 text-start", mode === "smart" ? "bg-ink text-paper" : "bg-paper-2 shadow-[var(--shadow-border)]")}
      >
        <span className="block text-sm font-medium">{copy.smartPractice}</span>
        <span className={cn("mt-1 block text-xs text-pretty", mode === "smart" ? "text-paper/70" : "text-muted")}>{copy.smartPracticeHint}</span>
      </button>
      <details className="mt-3" open={mode !== "smart"}>
        <summary className="min-h-11 py-3 text-sm font-medium text-accent">{copy.otherPracticeFormats}</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.filter((item) => item.id !== "smart").map((item) => (
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
      </details>

      {mode === "smart" ? (
        <p className="mt-4 max-w-2xl text-sm text-pretty text-muted">{copy.smartPracticeLead}</p>
      ) : null}

      {(mode === "smart" || needsLevel(mode)) && mode !== "match" && mode !== "sprint" ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {[10, 20].map((n) => (
            <Choice key={n} active={count === n} disabled={busy} onClick={() => setCount(n)}>
              {num(n)}
            </Choice>
          ))}
        </div>
      ) : null}

      {needsLevel(mode) ? (
        <>
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {LEVELS.map((id) => (
              <Choice
                key={id}
                active={level === id}
                disabled={busy}
                onClick={() => {
                  levelTouched.current = true;
                  setLevel(id);
                }}
              >
                {LEVEL_LABEL[id]}
              </Choice>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Choice active={studiedOnly} disabled={busy} onClick={() => setStudiedOnly(true)}>
              {copy.studiedOnly}
            </Choice>
            <Choice active={!studiedOnly} disabled={busy} onClick={() => setStudiedOnly(false)}>
              {copy.wholeLevel}
            </Choice>
          </div>
        </>
      ) : null}

      {mode === "chunk" ? (
        <>
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {CHUNKS.map((item) => (
              <Choice key={item.id} active={chunk === item.id} disabled={busy} onClick={() => setChunk(item.id)}>
                {copy[item.label]}
              </Choice>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Choice active={direction === "to-fa"} disabled={busy} onClick={() => setDirection("to-fa")}>
              {copy.toFa}
            </Choice>
            <Choice active={direction === "to-en"} disabled={busy} onClick={() => setDirection("to-en")}>
              {copy.toEn}
            </Choice>
          </div>
        </>
      ) : null}

      {error ? (
        <div className="mt-4" role="status">
          <p className={error === "load" ? "text-sm text-bad" : "text-sm text-muted"}>
            {error === "load" ? copy.loadFailed : mode === "smart" ? copy.smartPracticeEmpty : needsLevel(mode) ? copy.thinPool : copy.noResults}
          </p>
          {mode === "smart" && error === "empty" ? (
            <Link to="/study" className="mt-2 inline-flex min-h-11 items-center text-sm text-accent">{copy.startSession}</Link>
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

async function build(
  mode: Exclude<Mode, "smart">,
  level: LevelId,
  count: number,
  chunk: Chunk,
  direction: "to-fa" | "to-en",
  copy: Copy,
  lang: Lang,
  studiedOnly: boolean,
  cards: Record<string, unknown>,
): Promise<Question[]> {
  if (mode === "irr") return irregularQuestions(await loadIrregular(), count);
  if (mode === "ant") return antonymQuestions(await loadAntonyms(), count);
  if (mode === "conf") return confusingQuestions(await loadPairs("confusing.json"), count);
  if (mode === "chunk") return chunkQuestions(await loadPatterns(DECK_FILE[chunk]), direction, count);
  if (mode === "match" || mode === "sprint") return [];
  const words = await loadLevel(level);
  const pool = studiedOnly ? words.filter((word) => cards[word.id]) : words;
  return lexQuestions(pool, mode, count, copy, lang);
}
