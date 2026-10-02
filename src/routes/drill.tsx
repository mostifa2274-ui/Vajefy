import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MatchBoard } from "@/components/match-board";
import { QuizRun } from "@/components/quiz-run";
import { SprintRun } from "@/components/sprint-run";
import { PageHeader } from "@/components/ui";
import { cn } from "@/lib/cn";
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
import { useProgress } from "@/lib/learn/store";
import type { LevelId, Question } from "@/lib/learn/types";

type DrillSearch = { play?: "match" | "sprint" | "studied" };

export const Route = createFileRoute("/drill")({
  validateSearch: (search: Record<string, unknown>): DrillSearch => {
    if (search.play === "match" || search.play === "sprint" || search.play === "studied") {
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

type Mode = "match" | "sprint" | "to-fa" | "to-en" | "spell" | "cloze" | "listen" | "irr" | "ant" | "conf" | "chunk";
type Chunk = "pv" | "col" | "prep" | "vp" | "occ";

const MODES: { id: Mode; title: CopyKey; hint: CopyKey }[] = [
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
  | { kind: "quiz"; questions: Question[] }
  | { kind: "match"; pairs: PlayPair[] }
  | { kind: "sprint"; pairs: PlayPair[] };

function DrillPage() {
  const initial = Route.useSearch();
  const lang = useProgress((state) => state.lang);
  const focus = useProgress((state) => state.focus);
  const practice = useProgress((state) => state.practice);
  const copy = useCopy(lang);
  const [mode, setMode] = useState<Mode>(initial.play === "match" ? "match" : initial.play === "sprint" ? "sprint" : "to-fa");
  const [level, setLevel] = useState<LevelId>(focus);
  const [count, setCount] = useState(10);
  const [chunk, setChunk] = useState<Chunk>("col");
  const [direction, setDirection] = useState<"to-fa" | "to-en">("to-fa");
  const [studiedOnly, setStudiedOnly] = useState(initial.play === "studied");
  const [arena, setArena] = useState<Arena | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setError(false);
    try {
      const cards = useProgress.getState().cards;
      if (mode === "match" || mode === "sprint") {
        const words = await loadLevel(level);
        const pool = studiedOnly ? words.filter((word) => cards[word.id]) : words;
        const pairs = playPairs(pool, mode === "match" ? 6 : 40);
        const minimum = mode === "match" ? 4 : 8;
        if (pairs.length < minimum) {
          setError(true);
          setArena(null);
        } else {
          setArena({ kind: mode, pairs });
        }
      } else {
        const built = await build(mode, level, count, chunk, direction, copy, studiedOnly, cards);
        if (!built.length) {
          setError(true);
          setArena(null);
        } else {
          setArena({ kind: "quiz", questions: built });
        }
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (arena?.kind === "quiz") {
    return (
      <QuizRun
        questions={arena.questions}
        lang={lang}
        onGrade={practice}
        onDone={() => setArena(null)}
      />
    );
  }

  if (arena?.kind === "match") {
    return (
      <MatchBoard
        pairs={arena.pairs}
        lang={lang}
        onPair={(id) => practice(id, "good")}
        onExit={() => setArena(null)}
      />
    );
  }

  if (arena?.kind === "sprint") {
    return (
      <SprintRun
        pairs={arena.pairs}
        lang={lang}
        onResult={(id, ok) => practice(id, ok ? "good" : "again")}
        onExit={() => setArena(null)}
      />
    );
  }

  return (
    <div>
      <PageHeader title={copy.drill} lede={copy.drillLead} />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setMode(item.id)}
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

      {needsLevel(mode) && mode !== "match" && mode !== "sprint" ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {[10, 20].map((n) => (
            <Choice key={n} active={count === n} onClick={() => setCount(n)}>
              {String(n)}
            </Choice>
          ))}
        </div>
      ) : null}

      {needsLevel(mode) ? (
        <>
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {LEVELS.map((id) => (
              <Choice key={id} active={level === id} onClick={() => setLevel(id)}>
                {LEVEL_LABEL[id]}
              </Choice>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Choice active={studiedOnly} onClick={() => setStudiedOnly(true)}>
              {copy.studiedOnly}
            </Choice>
            <Choice active={!studiedOnly} onClick={() => setStudiedOnly(false)}>
              {copy.wholeLevel}
            </Choice>
          </div>
        </>
      ) : null}

      {mode === "chunk" ? (
        <>
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {CHUNKS.map((item) => (
              <Choice key={item.id} active={chunk === item.id} onClick={() => setChunk(item.id)}>
                {copy[item.label]}
              </Choice>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Choice active={direction === "to-fa"} onClick={() => setDirection("to-fa")}>
              {copy.toFa}
            </Choice>
            <Choice active={direction === "to-en"} onClick={() => setDirection("to-en")}>
              {copy.toEn}
            </Choice>
          </div>
        </>
      ) : null}

      {error ? <p className="mt-4 text-sm text-bad">{needsLevel(mode) ? copy.thinPool : copy.noResults}</p> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void start()}
        className="mt-5 inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-ink disabled:opacity-40"
      >
        {busy ? copy.loading : copy.startDrill}
      </button>
    </div>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
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
  mode: Mode,
  level: LevelId,
  count: number,
  chunk: Chunk,
  direction: "to-fa" | "to-en",
  copy: Copy,
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
  return lexQuestions(pool, mode, count, copy);
}
