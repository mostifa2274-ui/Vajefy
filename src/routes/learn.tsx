import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LessonRun } from "@/components/lesson-run";
import { Button, Num, PageHeader } from "@/components/ui";
import { useCopy } from "@/lib/learn/i18n";
import { buildApplication, buildLesson, lessonSize, nextTargets, type LessonSession } from "@/lib/learn/lesson";
import { introductionOrder, loadPilot, type PilotIndex } from "@/lib/learn/pilot";
import { resumable } from "@/lib/learn/session";
import { dueIds, useProgress } from "@/lib/learn/store";

export const Route = createFileRoute("/learn")({ component: LearnPage });

function LearnPage() {
  const navigate = useNavigate();
  const lang = useProgress((state) => state.lang);
  const hydrated = useProgress((state) => state.hydrated);
  const cards = useProgress((state) => state.cards);
  const goal = useProgress((state) => state.goal);
  const minutes = useProgress((state) => state.minutes);
  const sessionSize = useProgress((state) => state.sessionSize);
  const sessions = useProgress((state) => state.sessions);
  const saveSession = useProgress((state) => state.saveSession);
  const copy = useCopy(lang);
  const [index, setIndex] = useState<PilotIndex | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState<LessonSession | null>(null);
  const [opened] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    void loadPilot()
      .then((loaded) => alive && setIndex(loaded))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  if (failed) {
    return (
      <p className="text-sm text-bad">
        {copy.loadFailed}{" "}
        <button type="button" className="text-accent" onClick={() => window.location.reload()}>
          {copy.retry}
        </button>
      </p>
    );
  }
  if (!index || !hydrated) return <p className="text-sm text-muted">{copy.loading}</p>;
  if (active) return <LessonRun key={active.id} initial={active} index={index} onExit={() => void navigate({ to: "/" })} />;

  const unfinished = resumable(sessions, "lesson", opened);
  const due = dueIds(cards, opened).length;
  const ordered = introductionOrder(index.targets, goal);
  const size = lessonSize(minutes, due, sessionSize);
  const upcoming = nextTargets(ordered, cards, size);
  const met = index.targets.filter((target) => cards[target.sense.id]).length;
  const remaining = nextTargets(ordered, cards, 1).length;

  function start(session: LessonSession) {
    if (unfinished) saveSession({ ...unfinished, status: "done", updatedAt: Date.now() });
    saveSession(session);
    setActive(session);
  }

  return (
    <div>
      <PageHeader title={copy.learnTitle} lede={copy.learnLede} />
      <section className="panel p-4 sm:p-6">
        {unfinished ? (
          <Button onClick={() => setActive(unfinished)}>
            {copy.resumeLesson} · <Num value={unfinished.steps.length - unfinished.index} /> {copy.leftLabel}
          </Button>
        ) : upcoming.length ? (
          <>
            <ul className="flex flex-wrap gap-2" lang="en" dir="ltr">
              {upcoming.map((target) => (
                <li key={target.sense.id} className="rounded-md bg-paper-2 px-3 py-1 text-sm shadow-[var(--shadow-border)]">
                  <span className="lex-word">{target.entry.headword}</span>
                  <span lang="fa" dir="rtl" className="ms-2 text-muted">{target.sense.gloss}</span>
                </li>
              ))}
            </ul>
            <Button className="mt-4" onClick={() => start(buildLesson(index, upcoming, new Set(Object.keys(cards)), Date.now()))}>
              {copy.startLesson} · <Num value={upcoming.length} /> {copy.lessonNewWords}
            </Button>
          </>
        ) : remaining ? (
          <p className="text-sm text-pretty">
            {copy.reviewFirst}{" "}
            <Link to="/study" className="text-accent">{copy.startSession}</Link>
          </p>
        ) : (
          <p className="text-sm text-pretty">{copy.pilotDone}</p>
        )}
        <p className="mt-4 text-xs text-muted">
          {copy.pilotProgress}: <Num value={met} /> / <Num value={index.targets.length} />
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">{copy.contrastsTitle}</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {index.pilot.contrasts.map((contrast) => (
            <li key={contrast.id} className="panel flex items-center justify-between gap-3 p-3">
              <span lang="en" dir="ltr" className="lex-word text-lg">{contrast.title}</span>
              <button
                type="button"
                className="min-h-11 shrink-0 text-sm text-accent"
                onClick={() => {
                  const session = buildApplication(index, "contrast", contrast.id, Date.now());
                  if (session) start(session);
                }}
              >
                {copy.practiseThis}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">{copy.scenesTitle}</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {index.pilot.scenes.map((scene) => (
            <li key={scene.id} className="panel flex items-center justify-between gap-3 p-3">
              <span>
                <span lang="en" dir="ltr" className="block">{scene.title}</span>
                <span lang="fa" dir="rtl" className="block text-sm text-muted">{scene.titleFa}</span>
              </span>
              <button
                type="button"
                className="min-h-11 shrink-0 text-sm text-accent"
                onClick={() => {
                  const session = buildApplication(index, "scene", scene.id, Date.now());
                  if (session) start(session);
                }}
              >
                {copy.practiseThis}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-8 text-xs text-muted">{copy.draftContent}</p>
    </div>
  );
}
