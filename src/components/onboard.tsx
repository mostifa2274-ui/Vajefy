import { useState } from "react";
import { useCopy, type Copy } from "@/lib/learn/i18n";
import { STUDY_MINUTES, type LearningGoal } from "@/lib/learn/progress";
import { useProgress } from "@/lib/learn/store";
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
 * One screen with sensible defaults: why the learner studies and how much time
 * a day. Every new learner starts the A1 course: higher levels stay out of
 * onboarding until A1 is complete and released. Learners who finished
 * onboarding earlier never see this screen, so their saved level is kept.
 * Enter starts at once.
 */
export function Onboard() {
  const lang = useProgress((state) => state.lang);
  const complete = useProgress((state) => state.completeOnboarding);
  const copy = useCopy(lang);
  const [goal, setGoal] = useState<LearningGoal>("general");
  const [minutes, setMinutes] = useState<number>(10);

  return (
    <div className="panel mx-auto max-w-xl p-5 sm:p-8">
      <p className="lex-word text-3xl leading-none">Vajefy</p>
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
        <div className="mt-3 rounded-lg bg-paper-2 p-3 shadow-[var(--shadow-border)]">
          <span lang="en" dir="ltr" className="lex-word block text-2xl">A1</span>
        </div>
      </section>

      <section aria-labelledby="time-title" className="mt-8">
        <h2 id="time-title" className="text-base font-medium">{copy.timeTitle}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
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

      <Button className="mt-8" onClick={() => complete("A1", goal, minutes)}>
        {copy.startPath}
      </Button>
    </div>
  );
}
