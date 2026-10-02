import { useEffect, useState } from "react";
import { useCopy } from "@/lib/learn/i18n";
import { loadMeta } from "@/lib/learn/load";
import { useProgress } from "@/lib/learn/store";
import type { LevelId, Meta } from "@/lib/learn/types";
import { cn } from "@/lib/cn";
import { Button, Num } from "./ui";

const GOALS = [10, 20, 40];

export function Onboard() {
  const lang = useProgress((state) => state.lang);
  const complete = useProgress((state) => state.completeOnboarding);
  const copy = useCopy(lang);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [level, setLevel] = useState<LevelId>("A1");
  const [goal, setGoal] = useState(20);

  useEffect(() => {
    void loadMeta().then(setMeta).catch(() => undefined);
  }, []);

  return (
    <div className="panel mx-auto max-w-xl p-5 sm:p-8">
      <p className="lex-word text-3xl leading-none">Roshana</p>
      <p className="mt-2 text-sm text-muted">Oxford 3000 · 5000</p>
      <h1 className="mt-6 text-3xl font-medium text-balance">{copy.onboardTitle}</h1>
      <p className="mt-3 max-w-lg text-pretty text-muted">{copy.onboardLede}</p>
      {!meta ? <p className="mt-8 text-sm text-muted">{copy.loading}</p> : null}
      {meta ? (
        <div className="mt-8 grid grid-cols-3 gap-2">
          {meta.levels.map((item) => {
            const active = level === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setLevel(item.id)}
                className={cn(
                  "min-h-20 rounded-lg p-3 text-start",
                  active ? "bg-ink text-paper" : "bg-paper text-ink shadow-[var(--shadow-border)]",
                )}
              >
                <span className="lex-word block text-2xl">{item.label}</span>
                <span className={cn("mt-1 block text-xs", active ? "text-paper/70" : "text-muted")}>
                  <Num value={item.count} />
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      <p className="mt-8 text-sm text-muted">{copy.dailyGoal}</p>
      <div className="mt-2 flex gap-2">
        {GOALS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setGoal(item)}
            className={cn(
              "min-h-11 min-w-16 rounded-md px-3 text-sm",
              goal === item ? "bg-ink text-paper" : "bg-paper text-ink shadow-[var(--shadow-border)]",
            )}
          >
            <Num value={item} />
          </button>
        ))}
      </div>
      <Button className="mt-8" disabled={!meta} onClick={() => complete(level, goal)}>
        {copy.startPath}
      </Button>
    </div>
  );
}
