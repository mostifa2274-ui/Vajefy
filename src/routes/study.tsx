import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { StudySession } from "@/components/study-session";
import { ButtonLink } from "@/components/ui";
import { loadStudyFaces } from "@/lib/learn/faces";
import { useCopy } from "@/lib/learn/i18n";
import { loadMeta } from "@/lib/learn/load";
import { dueIds, todayLog, useProgress } from "@/lib/learn/store";
import { shuffle } from "@/lib/learn/text";
import type { StudyFace } from "@/lib/learn/types";

export const Route = createFileRoute("/study")({ component: StudyPage });

function StudyPage() {
  const navigate = useNavigate();
  const lang = useProgress((state) => state.lang);
  const hydrated = useProgress((state) => state.hydrated);
  const focus = useProgress((state) => state.focus);
  const sessionSize = useProgress((state) => state.sessionSize);
  const newPerDay = useProgress((state) => state.newPerDay);
  const voice = useProgress((state) => state.voice);
  const cards = useProgress((state) => state.cards);
  const review = useProgress((state) => state.review);
  const copy = useCopy(lang);
  const [ready, setReady] = useState<{
    items: { id: string; isNew: boolean }[];
    faces: Map<string, StudyFace>;
  } | null>(null);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    setReady(null);
    setError(false);
    void (async () => {
      try {
        const meta = await loadMeta();
        const state = useProgress.getState();
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
        const budget = Math.max(0, state.newPerDay - todayLog(state.logs).introduced);
        const fresh = shuffle(
          [...faces.keys()].filter((id) => id.startsWith(`lex:${state.focus}:`) && !known.has(id)),
        ).slice(0, Math.min(room, budget));
        setReady({
          faces,
          items: [...dueTake.map((id) => ({ id, isNew: false })), ...fresh.map((id) => ({ id, isNew: true }))],
        });
      } catch {
        if (alive) setError(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [hydrated, focus, sessionSize, newPerDay, nonce, copy]);

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

  if (ready.items.length === 0) {
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
      key={nonce}
      items={ready.items}
      faces={ready.faces}
      cards={cards}
      lang={lang}
      voice={voice}
      onGrade={(id, grade) => {
        review(id, grade);
      }}
      onExit={() => void navigate({ to: "/" })}
    />
  );
}
