import { useEffect, useRef, useState } from "react";
import { downloadPack, packStatus, removePack, type PackStatus } from "@/lib/learn/audio-pack";
import { useFormat } from "@/lib/learn/format";
import type { Copy } from "@/lib/learn/i18n";
import { measures } from "@/lib/learn/measures";
import { loadPilot } from "@/lib/learn/pilot";
import { useProgress } from "@/lib/learn/store";
import type { PracticeSkill } from "@/lib/learn/types";
import { Num, Sep } from "./ui";

const SKILL_LABEL: Record<PracticeSkill, keyof Copy> = {
  meaning: "skillMeaning",
  spelling: "skillSpelling",
  listening: "skillListening",
  context: "skillContext",
};

/** Introduced, remembered after a delay, used in context, and the weakest skill. */
export function LearningSummary({ copy }: { copy: Copy }) {
  const cards = useProgress((state) => state.cards);
  const reviewHistory = useProgress((state) => state.reviewHistory);
  const practiceSkills = useProgress((state) => state.practiceSkills);
  const { pct, sep } = useFormat();
  const result = measures({ cards, reviewHistory, practiceSkills });
  return (
    <section className="mt-8" aria-labelledby="measures-title">
      <h2 id="measures-title" className="text-lg font-medium">{copy.measuresTitle}</h2>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {([
          [copy.measureIntroduced, result.introduced],
          [copy.measureRemembered, result.remembered],
          [copy.measureUsed, result.used],
        ] as const).map(([label, value]) => (
          <div key={label} className="panel p-3">
            <dt className="text-xs text-pretty text-muted">{label}</dt>
            <dd className="mt-1 text-2xl font-medium"><Num value={value} /></dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-5 text-sm font-medium">{copy.skillsTitle}</h3>
      <ul className="mt-2 grid gap-1 text-sm">
        {result.skills.map((item) => (
          <li key={item.skill} className="flex items-center justify-between gap-3">
            <span>
              {copy[SKILL_LABEL[item.skill]]}
              {result.weakest === item.skill ? <span className="text-bad">
                  <Sep />
                  {copy.skillNeedsWork}
                </span> : null}
            </span>
            <span className="tabular-nums text-muted">
              {item.accuracy === null ? copy.notEnoughEvidence : `${pct(item.accuracy)}${sep}`}
              {item.accuracy === null ? null : <Num value={item.attempts} />}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Download the pilot's recorded pronunciation for the learner's accent. */
export function OfflineAudio({ copy }: { copy: Copy }) {
  const accent = useProgress((state) => state.accent);
  const { num, sep } = useFormat();
  const [pack, setPack] = useState<{ files: string[]; bytes: number } | null>(null);
  const [status, setStatus] = useState<PackStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    void loadPilot()
      .then(async (index) => {
        const chosen = index.pilot.audioPack[accent === "en-US" ? "us" : "gb"];
        if (!alive) return;
        setPack(chosen);
        setStatus(await packStatus(chosen.files));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      abort.current?.abort();
    };
  }, [accent]);

  if (!pack || !status || typeof caches === "undefined") return null;
  const megabytes = (pack.bytes / 1e6).toFixed(1);
  const complete = status.cached >= status.total;

  async function download() {
    if (!pack) return;
    setBusy(true);
    setFailed(false);
    abort.current = new AbortController();
    try {
      setStatus(await downloadPack(pack.files, setStatus, abort.current.signal));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-lg border border-line p-3">
      <h3 className="text-sm font-medium">{copy.offlineTitle}</h3>
      <p className="mt-1 text-xs text-pretty text-muted">{copy.offlineHint}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {complete ? (
          <>
            <span className="text-sm text-good">✓ {copy.downloaded}
              {sep}
              {num(Number(megabytes))} MB</span>
            <button
              type="button"
              className="min-h-11 text-sm text-muted"
              onClick={() => void removePack(pack.files).then(async () => setStatus(await packStatus(pack.files)))}
            >
              {copy.removeAudio}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void download()}
            className="min-h-11 rounded-md bg-paper-2 px-3 text-sm shadow-[var(--shadow-border)] disabled:opacity-60"
          >
            {busy ? copy.downloading : `${copy.downloadAudio}${sep}${num(Number(megabytes))} MB`}
          </button>
        )}
        {busy || (!complete && status.cached > 0) ? (
          <span role="status" className="text-xs text-muted tabular-nums">
            <Num value={status.cached} /> / <Num value={status.total} />
          </span>
        ) : null}
      </div>
      {busy ? (
        <div className="mt-2 h-1 rounded-full bg-line" aria-hidden>
          <div className="h-1 rounded-full bg-accent" style={{ width: `${Math.round((100 * status.cached) / Math.max(1, status.total))}%` }} />
        </div>
      ) : null}
      {failed ? <p className="mt-2 text-sm text-bad" role="alert">{copy.downloadFailed}</p> : null}
    </div>
  );
}
