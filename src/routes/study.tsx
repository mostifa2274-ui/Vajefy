import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { StudySession } from "@/components/study-session";
import { ButtonLink } from "@/components/ui";
import { loadStudyFaces } from "@/lib/learn/faces";
import { useCopy } from "@/lib/learn/i18n";
import { loadMeta } from "@/lib/learn/load";
import { resumable, startReview, type ReviewSession } from "@/lib/learn/session";
import { dueIds, todayLog, useProgress } from "@/lib/learn/store";
import { loadJson } from "@/lib/learn/load";
import { introductionOrder, loadPilot } from "@/lib/learn/pilot";
import { shuffle } from "@/lib/learn/text";
import type { CardProg, LevelId, StudyFace } from "@/lib/learn/types";

export const Route = createFileRoute("/study")({ component: StudyPage });

type Ready = { session: ReviewSession; faces: Map<string, StudyFace>; resumed: boolean };

/**
 * New words for Review, in a purposeful order: the most useful entries of the
 * level first. While the A1 pilot still has words to teach, those come through
 * guided lessons instead. Fewer new words are added when reviews are piling up.
 */
async function newWords(
  focus: LevelId,
  faces: Map<string, StudyFace>,
  known: Set<string>,
  dueCount: number,
  state: { newPerDay: number; sessionSize: number; logs: Parameters<typeof todayLog>[0]; goal: Parameters<typeof introductionOrder>[1] },
): Promise<string[]> {
  let budget = Math.max(0, state.newPerDay - todayLog(state.logs).introduced);
  if (dueCount >= state.sessionSize) budget = 0;
  else if (dueCount >= state.sessionSize / 2) budget = Math.floor(budget / 2);
  if (!budget) return [];
  const order = await loadJson<Partial<Record<LevelId, string[]>>>("usefulness.json")
    .then((lists) => lists[focus])
    .catch(() => undefined);
  const levelIds = order ?? shuffle([...faces.keys()].filter((id) => id.startsWith(`lex:${focus}:`) && !id.includes("#")));
  let excluded = new Set<string>();
  if (focus === "A1") {
    const pilot = await loadPilot();
    if (introductionOrder(pilot.targets, state.goal).some((target) => !known.has(target.sense.id))) {
      excluded = new Set(pilot.byEntry.keys());
    }
  }
  return levelIds.filter((id) => faces.has(id) && !known.has(id) && !excluded.has(id)).slice(0, budget);
}

/** A card graded after the session was last saved was answered elsewhere. */
function answeredElsewhere(card: CardProg | undefined, session: ReviewSession): boolean {
  return Boolean(card?.last && card.last > session.updatedAt);
}

function StudyPage() {
  const navigate = useNavigate();
  const lang = useProgress((state) => state.lang);
  const hydrated = useProgress((state) => state.hydrated);
  const focus = useProgress((state) => state.focus);
  const sessionSize = useProgress((state) => state.sessionSize);
  const newPerDay = useProgress((state) => state.newPerDay);
  const voice = useProgress((state) => state.voice);
  const requestRetention = useProgress((state) => state.requestRetention);
  const cards = useProgress((state) => state.cards);
  const saveSession = useProgress((state) => state.saveSession);
  const copy = useCopy(lang);
  const [loaded, setLoaded] = useState<{ key: string; ready: Ready } | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  // A ref, not state: clearing it must not rebuild the session it just made.
  const startNew = useRef(false);
  const sessionKey = `${focus}\u0000${sessionSize}\u0000${newPerDay}\u0000${nonce}\u0000${lang}`;
  const ready = loaded?.key === sessionKey ? loaded.ready : null;
  const error = errorKey === sessionKey;

  useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    void (async () => {
      try {
        const meta = await loadMeta();
        const state = useProgress.getState();
        const now = Date.now();
        const existing = resumable(state.sessions, "review", now);
        if (existing && !startNew.current) {
          const faces = await loadStudyFaces(existing.focus, existing.queue.map((item) => item.id), meta, copy);
          if (!alive) return;
          const queue = existing.queue.filter(
            (item) => faces.has(item.id) && !answeredElsewhere(useProgress.getState().cards[item.id], existing),
          );
          let session = existing;
          if (queue.length !== existing.queue.length) {
            session = { ...existing, queue, status: queue.length ? "active" : "done", updatedAt: now };
            saveSession(session);
          }
          setLoaded({ key: sessionKey, ready: { session, faces, resumed: true } });
          setErrorKey((failed) => (failed === sessionKey ? null : failed));
          return;
        }
        if (existing) saveSession({ ...existing, status: "done", updatedAt: now });

        const due = dueIds(state.cards);
        const faces = await loadStudyFaces(state.focus, due, meta, copy);
        if (!alive) return;
        // Every file these ids point to loaded, so a due id still missing has
        // no entry any more (renamed in the data). It could never be shown and
        // would keep Home's due count wrong, so let it go.
        state.forget(due.filter((id) => !faces.has(id)));
        const known = new Set(Object.keys(state.cards));
        const dueTake = due.filter((id) => faces.has(id)).slice(0, state.sessionSize);
        const room = state.sessionSize - dueTake.length;
        const fresh = (await newWords(state.focus, faces, known, due.length, state)).slice(0, room);
        if (!alive) return;
        const session = startReview(
          [...dueTake.map((id) => ({ id, isNew: false })), ...fresh.map((id) => ({ id, isNew: true }))],
          state.focus,
          now,
        );
        if (session.total) saveSession(session);
        startNew.current = false;
        setLoaded({ key: sessionKey, ready: { session, faces, resumed: false } });
        setErrorKey((failed) => (failed === sessionKey ? null : failed));
      } catch {
        if (alive) setErrorKey(sessionKey);
      }
    })();
    return () => {
      alive = false;
    };
  }, [hydrated, sessionKey, copy, saveSession]);

  if (error) {
    return (
      <p className="text-sm text-bad">
        {copy.loadFailed}{" "}
        <button type="button" className="text-accent" onClick={() => setNonce((n) => n + 1)}>
          {copy.retry}
        </button>
      </p>
    );
  }

  if (!ready) return <p className="text-sm text-muted">{copy.loading}</p>;

  if (ready.session.total === 0) {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-medium">{copy.emptySession}</h1>
        <p className="mt-2 text-pretty text-muted">{copy.clearDetail}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink to="/drill" variant="secondary">
            {copy.practiceFree}
          </ButtonLink>
          <ButtonLink to="/progress" variant="quiet">
            {copy.settings}
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <StudySession
      key={ready.session.id}
      initial={ready.session}
      faces={ready.faces}
      cards={cards}
      lang={lang}
      voice={voice}
      requestRetention={requestRetention}
      resumed={ready.resumed}
      onExit={() => void navigate({ to: "/" })}
      onNewSession={() => {
        startNew.current = true;
        setNonce((n) => n + 1);
      }}
    />
  );
}
