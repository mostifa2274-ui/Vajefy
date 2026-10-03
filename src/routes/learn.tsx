import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { LessonRun } from "@/components/lesson-run";
import { Button, Num, PageHeader } from "@/components/ui";
import { CONTENT_CHANNEL } from "@/lib/learn/channel";
import { useFormat } from "@/lib/learn/format";
import { useCopy } from "@/lib/learn/i18n";
import {
  buildApplication,
  buildCheckup,
  buildLesson,
  CHECKUP_SIZE,
  checkupCandidates,
  lessonSize,
  nextTargets,
  seenPrompts,
  type LessonSession,
} from "@/lib/learn/lesson";
import { focusFirst, introducible, introductionOrder, loadPilot, type PilotIndex } from "@/lib/learn/pilot";
import { resumable } from "@/lib/learn/session";
import { dueIds, useProgress } from "@/lib/learn/store";

export const Route = createFileRoute("/learn")({ component: LearnPage });

/** A check-up is offered once this many words are ready: fewer say little. */
const MIN_CHECKUP = 3;

function LearnPage() {
  const navigate = useNavigate();
  const lang = useProgress((state) => state.lang);
  const hydrated = useProgress((state) => state.hydrated);
  const cards = useProgress((state) => state.cards);
  const goal = useProgress((state) => state.goal);
  const focus = useProgress((state) => state.focus);
  const minutes = useProgress((state) => state.minutes);
  const sessionSize = useProgress((state) => state.sessionSize);
  const sessions = useProgress((state) => state.sessions);
  const saveSession = useProgress((state) => state.saveSession);
  const reviewHistory = useProgress((state) => state.reviewHistory);
  const copy = useCopy(lang);
  const { sep } = useFormat();
  // The whole pilot resolves every lesson and check-up item; what this
  // build's channel may introduce is the `index` view of it.
  const [full, setFull] = useState<PilotIndex | null>(null);
  const index = useMemo(() => (full ? introducible(full) : null), [full]);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState<LessonSession | null>(null);
  const [opened] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    void loadPilot()
      .then((loaded) => alive && setFull(loaded))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  if (failed) {
    return (
      <div>
        <PageHeader title={copy.learnTitle} lede={copy.learnLede} />
        <p className="text-sm text-bad">
          {copy.loadFailed}{" "}
          <button
            type="button"
            className="min-h-11 text-accent"
            onClick={() => window.location.reload()}
          >
            {copy.retry}
          </button>
        </p>
      </div>
    );
  }
  // The heading is drawn at once; the lesson card takes its place when ready.
  if (!index || !full || !hydrated) {
    return (
      <div>
        <PageHeader title={copy.learnTitle} lede={copy.learnLede} />
        <section className="panel min-h-48 p-4 sm:p-6" aria-busy="true">
          <p role="status" className="text-sm text-muted">
            {copy.loading}
          </p>
        </section>
      </div>
    );
  }
  if (active)
    return (
      <LessonRun
        key={active.id}
        initial={active}
        index={full}
        onExit={() => void navigate({ to: "/" })}
      />
    );

  const unfinished = resumable(sessions, "lesson", opened);
  const due = dueIds(cards, opened).length;
  // Lessons at the learner's level first, then the other levels' lessons.
  const ordered = focusFirst(introductionOrder(index.targets, goal), focus);
  const size = lessonSize(minutes, due, sessionSize);
  const upcoming = nextTargets(ordered, cards, size);
  const met = index.targets.filter((target) => cards[target.sense.id]).length;
  const remaining = nextTargets(ordered, cards, 1).length;
  const checkup = unfinished
    ? []
    : checkupCandidates(
        full.targets.map((target) => target.sense.id),
        reviewHistory,
        Object.values(sessions),
        opened,
      );

  function start(session: LessonSession) {
    if (unfinished) saveSession({ ...unfinished, status: "done", updatedAt: Date.now() });
    saveSession(session);
    setActive(session);
  }

  return (
    <div>
      <PageHeader title={copy.learnTitle} lede={copy.learnLede} />
      {CONTENT_CHANNEL === "none" ? (
        <p className="panel p-4 text-sm text-pretty sm:p-6">
          {copy.classicNote}{" "}
          <Link to="/study" className="text-accent">
            {copy.startSession}
          </Link>
        </p>
      ) : (
        <section className="panel p-4 sm:p-6">
          {unfinished ? (
            <Button onClick={() => setActive(unfinished)}>
              {copy.resumeLesson}
              {sep}
              <Num value={unfinished.steps.length - unfinished.index} /> {copy.leftLabel}
            </Button>
          ) : upcoming.length ? (
            <>
              <ul className="flex flex-wrap gap-2" lang="en" dir="ltr">
                {upcoming.map((target) => (
                  <li
                    key={target.sense.id}
                    className="inline-flex items-baseline gap-2 rounded-md bg-paper-2 px-3 py-1 text-sm shadow-[var(--shadow-border)]"
                  >
                    <span className="lex-word">{target.entry.headword}</span>
                    <span lang="fa" dir="rtl" className="text-muted">
                      {target.sense.gloss}
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-4"
                onClick={() =>
                  start(buildLesson(index, upcoming, new Set(Object.keys(cards)), Date.now()))
                }
              >
                {copy.startLesson}
                {sep}
                <Num value={upcoming.length} /> {copy.lessonNewWords}
              </Button>
            </>
          ) : remaining ? (
            <p className="text-sm text-pretty">
              {copy.reviewFirst}{" "}
              <Link to="/study" className="text-accent">
                {copy.startSession}
              </Link>
            </p>
          ) : (
            <p className="text-sm text-pretty">{copy.pilotDone}</p>
          )}
          <p className="mt-4 text-xs text-muted">
            {copy.pilotProgress}: <Num value={met} /> / <Num value={index.targets.length} />
          </p>
        </section>
      )}

      {checkup.length >= MIN_CHECKUP ? (
        <section className="panel mt-4 p-4 sm:p-6">
          <h2 className="text-lg font-medium">{copy.checkupTitle}</h2>
          <p className="mt-1 text-sm text-pretty text-muted">{copy.checkupHint}</p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() =>
              start(buildCheckup(full, checkup, seenPrompts(Object.values(sessions)), Date.now()))
            }
          >
            {copy.startCheckup}
            {sep}
            <Num value={Math.min(checkup.length, CHECKUP_SIZE)} /> {copy.checkupWords}
          </Button>
        </section>
      ) : null}

      {CONTENT_CHANNEL === "none" ? null : (
        <>
          <section className="mt-8">
            <h2 className="text-lg font-medium">{copy.contrastsTitle}</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {index.pilot.contrasts.map((contrast) => (
                <li key={contrast.id} className="panel flex items-center justify-between gap-3 p-3">
                  <span lang="en" dir="ltr" className="lex-word text-lg">
                    {contrast.title}
                  </span>
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
                    <span lang="en" dir="ltr" className="block">
                      {scene.title}
                    </span>
                    <span lang="fa" dir="rtl" className="block text-sm text-muted">
                      {scene.titleFa}
                    </span>
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
        </>
      )}
    </div>
  );
}
