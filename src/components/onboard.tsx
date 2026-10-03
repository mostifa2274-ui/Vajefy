import { useEffect, useState } from "react";
import { useCopy, type Copy } from "@/lib/learn/i18n";
import { loadLevel, loadMeta } from "@/lib/learn/load";
import { PLACEMENT_LEVELS, placementItems, placementLevel, type PlacementItem, type PlacementResult } from "@/lib/learn/placement";
import { STUDY_MINUTES, type LearningGoal } from "@/lib/learn/progress";
import { useProgress } from "@/lib/learn/store";
import type { LevelId, LexWord, Meta } from "@/lib/learn/types";
import { cn } from "@/lib/cn";
import { Button, Num } from "./ui";

const GOALS: { id: LearningGoal; label: keyof Copy }[] = [
  { id: "everyday", label: "goalEveryday" },
  { id: "work", label: "goalWork" },
  { id: "study", label: "goalStudy" },
  { id: "general", label: "goalGeneral" },
];

function Choice({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-lg p-3 text-start",
        active ? "bg-ink text-paper" : "bg-paper text-ink shadow-[var(--shadow-border)]",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * One screen with sensible defaults: why the learner studies, where to start
 * (with an optional quick check) and how much time a day. Enter starts at once.
 */
export function Onboard() {
  const lang = useProgress((state) => state.lang);
  const complete = useProgress((state) => state.completeOnboarding);
  const copy = useCopy(lang);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [goal, setGoal] = useState<LearningGoal>("general");
  const [level, setLevel] = useState<LevelId>("A1");
  const [minutes, setMinutes] = useState<number>(10);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    void loadMeta().then(setMeta).catch(() => undefined);
  }, []);

  return (
    <div className="panel mx-auto max-w-xl p-5 sm:p-8">
      <p className="lex-word text-3xl leading-none">Roshana</p>
      <p className="mt-2 text-sm text-muted">Oxford 3000 · 5000</p>
      <h1 className="mt-6 text-2xl font-medium text-balance">{copy.setupTitle}</h1>

      <section aria-labelledby="goal-title" className="mt-6">
        <h2 id="goal-title" className="text-base font-medium">{copy.goalTitle}</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {GOALS.map((item) => (
            <Choice key={item.id} active={goal === item.id} onClick={() => setGoal(item.id)}>
              <span className="text-sm">{copy[item.label]}</span>
            </Choice>
          ))}
        </div>
      </section>

      <section aria-labelledby="level-title" className="mt-8">
        <h2 id="level-title" className="text-base font-medium">{copy.onboardTitle}</h2>
        <p className="mt-1 text-sm text-pretty text-muted">{copy.onboardLede}</p>
        {checking ? (
          <Placement
            copy={copy}
            onDone={(suggested) => {
              setLevel(suggested);
              setChecking(false);
            }}
            onCancel={() => setChecking(false)}
          />
        ) : (
          <>
            {!meta ? <p className="mt-4 text-sm text-muted">{copy.loading}</p> : null}
            {meta ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {meta.levels.map((item) => {
                  const active = level === item.id;
                  return (
                    <Choice key={item.id} active={active} onClick={() => setLevel(item.id)} className="min-h-20">
                      <span className="lex-word block text-2xl">{item.label}</span>
                      <span className={cn("mt-1 block text-xs", active ? "text-paper/70" : "text-muted")}>
                        <Num value={item.count} />
                      </span>
                    </Choice>
                  );
                })}
              </div>
            ) : null}
            <button type="button" onClick={() => setChecking(true)} className="mt-2 min-h-11 text-sm text-accent">
              {copy.notSure}
            </button>
          </>
        )}
      </section>

      <section aria-labelledby="time-title" className="mt-8">
        <h2 id="time-title" className="text-base font-medium">{copy.timeTitle}</h2>
        <div className="mt-3 flex gap-2">
          {STUDY_MINUTES.map((item) => (
            <Choice key={item} active={minutes === item} onClick={() => setMinutes(item)} className="min-w-20 text-center">
              <span className="text-sm">
                <Num value={item} /> {copy.minutesLabel}
              </span>
            </Choice>
          ))}
        </div>
        <p className="mt-2 text-xs text-pretty text-muted">{copy.timeHint}</p>
      </section>

      <Button className="mt-8" disabled={!meta || checking} onClick={() => complete(level, goal, minutes)}>
        {copy.startPath}
      </Button>
    </div>
  );
}

function Placement({ copy, onDone, onCancel }: { copy: Copy; onDone: (level: LevelId) => void; onCancel: () => void }) {
  const lang = useProgress((state) => state.lang);
  const [items, setItems] = useState<PlacementItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [results, setResults] = useState<PlacementResult[]>([]);

  useEffect(() => {
    let alive = true;
    void Promise.all(PLACEMENT_LEVELS.map((level) => loadLevel(level)))
      .then((lists) => {
        if (!alive) return;
        const words = Object.fromEntries(PLACEMENT_LEVELS.map((level, index) => [level, lists[index] ?? []])) as Record<LevelId, LexWord[]>;
        setItems(placementItems(words, copy, lang));
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [copy, lang]);

  if (failed) return <p className="mt-3 text-sm text-bad">{copy.loadFailed}</p>;
  if (!items) return <p className="mt-3 text-sm text-muted">{copy.loading}</p>;
  const current = items[results.length];
  const answer = (correct: boolean) => setResults((list) => [...list, { level: items[list.length]!.level, correct }]);

  if (!current) {
    const suggested = placementLevel(results);
    return (
      <div className="mt-4 rounded-lg border border-line p-4" role="status">
        <p className="text-sm text-muted">{copy.placementResult}</p>
        <p className="lex-word mt-1 text-3xl">{suggested}</p>
        <Button className="mt-4" onClick={() => onDone(suggested)}>
          {copy.useThisLevel}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-line p-4">
      <h3 className="text-sm font-medium">{copy.placementTitle}</h3>
      <p className="mt-1 text-xs text-pretty text-muted">{copy.placementHint}</p>
      <p className="mt-3 text-xs text-muted tabular-nums">
        <Num value={results.length + 1} /> / <Num value={items.length} />
      </p>
      <p lang="en" dir="ltr" className="lex-word mt-2 text-3xl">
        {current.question.prompt}
      </p>
      <div className="mt-3 grid gap-2" role="group" aria-label={copy.meaning}>
        {current.question.options.map((option) => (
          <button
            key={option.key}
            type="button"
            dir={option.dir}
            lang={option.dir === "ltr" ? "en" : "fa"}
            onClick={() => answer(option.key === current.question.answerKey)}
            className="min-h-11 rounded-md border border-line bg-paper px-3 py-2 text-start text-pretty"
          >
            {option.text}
          </button>
        ))}
        <button type="button" onClick={() => answer(false)} className="min-h-11 rounded-md px-3 text-start text-sm text-muted">
          {copy.dontKnow}
        </button>
      </div>
      <button type="button" onClick={onCancel} className="mt-2 min-h-11 text-sm text-accent">
        {copy.cancelPlacement}
      </button>
    </div>
  );
}
