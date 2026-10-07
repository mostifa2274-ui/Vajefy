import { useEffect, useRef, useState } from "react";
import { downloadPack, packStatus, removePack, type PackStatus } from "@/lib/learn/audio-pack";
import type { AudioPack, AudioUnitPack } from "@/lib/learn/content";
import { useFormat } from "@/lib/learn/format";
import type { Copy } from "@/lib/learn/i18n";
import { checkupResult, type LessonSession } from "@/lib/learn/lesson";
import { measures } from "@/lib/learn/measures";
import { CONTENT_CHANNEL } from "@/lib/learn/channel";
import { downloadText } from "@/lib/learn/download-backup";
import { loadAudioPack, loadPilotOrder } from "@/lib/learn/pilot";
import { persistence, useProgress } from "@/lib/learn/store";
import { buildStudyExport, studyFileName, validParticipant } from "@/lib/learn/study";
import type { PracticeSkill } from "@/lib/learn/types";

const APP_BUILD =
  ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
    ?.VITE_APP_VERSION ?? "local");
import { Num, Sep } from "./ui";
import { Fa } from "./mixed-text";

const SKILL_LABEL: Record<PracticeSkill, keyof Copy> = {
  meaning: "skillMeaning",
  spelling: "skillSpelling",
  listening: "skillListening",
  context: "skillContext",
};

/** Introduced, remembered after a delay, correct in context, and the weakest skill. */
export function LearningSummary({ copy }: { copy: Copy }) {
  const cards = useProgress((state) => state.cards);
  const reviewHistory = useProgress((state) => state.reviewHistory);
  const practiceSkills = useProgress((state) => state.practiceSkills);
  const sessions = useProgress((state) => state.sessions);
  const { pct, sep } = useFormat();
  const result = measures({ cards, reviewHistory, practiceSkills });
  const latestCheckup = Object.values(sessions)
    .filter((session): session is LessonSession => session.kind === "lesson" && session.mode === "checkup" && session.status === "done")
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const checkup = latestCheckup ? checkupResult(latestCheckup) : null;
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
      {checkup ? (
        <p className="mt-3 text-sm">
          {copy.checkupLatest}: {copy.checkupUsable} <Num value={checkup.usable} /> / <Num value={checkup.checked} />
        </p>
      ) : null}
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

/** Download recorded pronunciation one curriculum unit at a time. */
export function OfflineAudio({ copy }: { copy: Copy }) {
  const accent = useProgress((state) => state.accent);
  const lang = useProgress((state) => state.lang);
  const { num, sep } = useFormat();
  const [units, setUnits] = useState<AudioPack["units"]>([]);
  const [statuses, setStatuses] = useState<Record<string, PackStatus>>({});
  const [statusAccent, setStatusAccent] = useState<"gb" | "us" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const accentKey = accent === "en-US" ? "us" : "gb";

  useEffect(() => {
    let alive = true;
    void loadAudioPack()
      .then(async (audioPack) => {
        const rows = await Promise.all(
          audioPack.units.map(async (unit) => [unit.id, await packStatus(unit[accentKey])] as const),
        );
        if (!alive) return;
        setUnits(audioPack.units);
        setStatuses(Object.fromEntries(rows));
        setStatusAccent(accentKey);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      abort.current?.abort();
    };
  }, [accentKey]);

  if (!units.length || statusAccent !== accentKey || typeof caches === "undefined") return null;

  async function download(pack: AudioUnitPack) {
    setBusy(pack.unitId);
    setFailed(null);
    abort.current?.abort();
    abort.current = new AbortController();
    try {
      const status = await downloadPack(
        pack,
        (progress) => setStatuses((current) => ({ ...current, [pack.unitId]: progress })),
        abort.current.signal,
      );
      setStatuses((current) => ({ ...current, [pack.unitId]: status }));
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setFailed(pack.unitId);
      }
    } finally {
      setBusy((current) => (current === pack.unitId ? null : current));
    }
  }

  async function remove(pack: AudioUnitPack) {
    await removePack(pack);
    setStatuses((current) => ({
      ...current,
      [pack.unitId]: {
        cached: 0,
        total: pack.files.length,
        current: false,
        activeVersion: null,
        previous: false,
      },
    }));
  }

  return (
    <div className="mt-6 rounded-lg border border-line p-3">
      <h3 className="text-sm font-medium">{copy.offlineTitle}</h3>
      <p className="mt-1 text-xs text-pretty text-muted">{copy.offlineHint}</p>
      <div className="mt-3 divide-y divide-line">
        {units.map((unit) => {
          const pack = unit[accentKey];
          const status = statuses[unit.id];
          const busyHere = busy === unit.id;
          const megabytes = (pack.bytes / 1e6).toFixed(1);
          return (
            <div key={unit.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 text-sm">
                  <span className="text-muted"><Num value={unit.number} />.</span>{" "}
                  <span>{lang === "fa" ? unit.titleFa : unit.titleEn}</span>
                </span>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {status?.current ? (
                    <>
                      <span className="text-xs text-good">
                        ✓ {copy.downloaded}
                        {sep}
                        {num(Number(megabytes))} <bdi lang="en">MB</bdi>
                      </span>
                      <button
                        type="button"
                        className="min-h-11 px-2 text-sm text-muted"
                        onClick={() => void remove(pack)}
                      >
                        {copy.removeAudio}
                      </button>
                    </>
                  ) : (
                    <>
                      {status?.previous ? (
                        <span className="text-xs text-good">✓ {copy.downloaded}</span>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy !== null && !busyHere}
                        onClick={() => void download(pack)}
                        className="min-h-11 rounded-md bg-paper-2 px-3 text-sm shadow-[var(--shadow-border)] disabled:opacity-60"
                      >
                        {busyHere ? (
                          copy.downloading
                        ) : (
                          <>
                            {copy.downloadAudio}
                            {sep}
                            {num(Number(megabytes))} <bdi lang="en">MB</bdi>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
              {status && (busyHere || (!status.current && status.cached > 0)) ? (
                <>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted tabular-nums">
                    <span role="status"><Num value={status.cached} /> / <Num value={status.total} /></span>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-line" aria-hidden>
                    <div
                      className="h-1 rounded-full bg-accent"
                      style={{ width: Math.round((100 * status.cached) / Math.max(1, status.total)) + "%" }}
                    />
                  </div>
                </>
              ) : null}
              {failed === unit.id ? (
                <p className="mt-2 text-sm text-bad" role="alert">{copy.downloadFailed}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The study export: a participant code, an opt-in for written answers, and a file. */
export function StudyPanel({ copy }: { copy: Copy }) {
  const [code, setCode] = useState("");
  const [writing, setWriting] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const ready = validParticipant(code);

  async function download() {
    const evidence = await persistence.evidence();
    if (!evidence) {
      setUnavailable(true);
      return;
    }
    const state = useProgress.getState();
    const contentVersion = await loadPilotOrder()
      .then((order) => order.version)
      .catch(() => null);
    if (!contentVersion) {
      setUnavailable(true);
      return;
    }
    const now = new Date();
    const data = buildStudyExport({
      participant: code,
      includeWriting: writing,
      events: evidence.events,
      sessions: evidence.sessions,
      profile: {
        lang: state.lang,
        focus: state.focus,
        goal: state.goal,
        minutes: state.minutes,
        requestRetention: state.requestRetention,
        accent: state.accent,
        sessionSize: state.sessionSize,
        newPerDay: state.newPerDay,
      },
      contentVersion,
      channel: CONTENT_CHANNEL,
      build: APP_BUILD,
      now,
    });
    downloadText(JSON.stringify(data), studyFileName(code, now));
  }

  return (
    <section className="mt-6" aria-labelledby="study-title">
      <h3 id="study-title" className="text-sm font-medium">
        {copy.studyTitle}
      </h3>
      <p className="mt-1 text-sm text-pretty text-muted"><Fa text={copy.studyHint} /></p>
      <label className="mt-3 block text-sm">
        <span>{copy.studyCode}</span>
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="field mt-1 h-11 w-full max-w-xs px-3"
          dir="ltr"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
      <label className="mt-3 flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={writing} onChange={(event) => setWriting(event.target.checked)} className="size-5" />
        {copy.studyWriting}
      </label>
      <button
        type="button"
        disabled={!ready}
        onClick={() => void download()}
        className="mt-2 min-h-11 rounded-md bg-paper-2 px-3 text-sm shadow-[var(--shadow-border)] disabled:opacity-40"
      >
        {copy.studyDownload}
      </button>
      {unavailable ? (
        <p role="status" className="mt-2 text-sm text-bad">
          {copy.studyUnavailable}
        </p>
      ) : null}
    </section>
  );
}
