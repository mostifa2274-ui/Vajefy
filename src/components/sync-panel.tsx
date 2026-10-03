import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { useFormat } from "@/lib/learn/format";
import type { Copy } from "@/lib/learn/i18n";
import type { SaveStatus } from "@/lib/learn/persistence";
import { persistence, useProgress } from "@/lib/learn/store";
import type { SyncStatus } from "@/lib/learn/sync";
import { sync, syncAvailable } from "@/lib/learn/sync-client";

const serverStatus: SyncStatus = { state: "off", pending: 0, lastSync: null, dropped: 0, code: null, ended: false };
const serverSave = (): SaveStatus => "checking";
const secondary = "min-h-11 rounded-md bg-paper-2 px-3 text-sm shadow-[var(--shadow-border)] disabled:opacity-40";
const primary = "min-h-11 rounded-md bg-accent px-3 text-sm text-accent-fg disabled:opacity-40";

type Step = "idle" | "join" | "choose" | "stop" | "delete";
type Notice = "invalid" | "offline" | "deleted" | "delete-failed";

/** Optional end-to-end encrypted sync between the learner's devices (docs/SYNC.md). */
export function SyncPanel({ copy }: { copy: Copy }) {
  const status = useSyncExternalStore(sync.subscribe, sync.status, () => serverStatus);
  const save = useSyncExternalStore(persistence.subscribe, persistence.getStatus, serverSave);
  const lang = useProgress((state) => state.lang);
  const { num } = useFormat();
  const [offered, setOffered] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [typed, setTyped] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void syncAvailable().then((enabled) => live && setOffered(enabled));
    return () => {
      live = false;
    };
  }, []);

  const paired = status.code !== null;
  if (!offered && !paired && !status.ended) return null;

  async function act(work: () => Promise<void>) {
    setBusy(true);
    setNotice(null);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  }

  const turnOn = () =>
    act(async () => {
      await sync.create();
      setShowCode(true);
    });

  const join = (event: FormEvent) => {
    event.preventDefault();
    void act(async () => {
      const result = await sync.join(typed);
      if (result === "joined") {
        setStep("idle");
        setTyped("");
      } else if (result === "needs-choice") setStep("choose");
      else setNotice(result);
    });
  };

  const choose = (keep: "synced" | "this-device") =>
    act(async () => {
      const result = await sync.choose(keep);
      // Unreachable, the choice stays on screen to be made again.
      if (result !== "offline") {
        setStep("idle");
        setTyped("");
      }
      if (result !== "done") setNotice(result);
    });

  const remove = () =>
    act(async () => {
      if (await sync.deleteSynced()) setStep("idle");
      else setNotice("delete-failed");
    });

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(status.code ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The code is selectable for copying by hand.
    }
  };

  const when = status.lastSync
    ? new Intl.DateTimeFormat(lang === "fa" ? "fa-IR" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(status.lastSync)
    : null;
  const stateLine =
    status.state === "syncing"
      ? copy.syncBusy
      : status.state === "offline"
        ? copy.syncOfflineState
        : status.state === "error"
          ? copy.syncErrorState
          : status.state === "update"
            ? copy.syncUpdateState
            : when
              ? `${copy.syncLast}: ${when}`
              : copy.syncNever;
  const noticeText = {
    invalid: copy.syncInvalid,
    offline: copy.syncUnreachable,
    deleted: copy.syncDeletedCode,
    "delete-failed": copy.syncDeleteFailed,
  };

  return (
    <section className="mt-6 rounded-lg border border-line p-3" aria-labelledby="sync-title" data-testid="sync-panel">
      <h3 id="sync-title" className="text-sm font-medium">
        {copy.syncTitle}
      </h3>
      <p className="mt-1 text-xs text-pretty text-muted">{copy.syncHint}</p>

      {status.ended && !paired ? <p className="mt-3 text-sm text-pretty">{copy.syncEnded}</p> : null}

      {!paired && step === "choose" ? (
        <div className="mt-3">
          <p className="text-sm text-pretty">{copy.syncChoiceHint}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={primary} disabled={busy} onClick={() => void choose("synced")}>
              {copy.syncUseSynced}
            </button>
            <button type="button" className={secondary} disabled={busy} onClick={() => void choose("this-device")}>
              {copy.syncKeepThis}
            </button>
            <button
              type="button"
              className="min-h-11 px-3 text-sm"
              onClick={() => {
                sync.cancelChoice();
                setStep("idle");
              }}
            >
              {copy.resetNo}
            </button>
          </div>
        </div>
      ) : !paired && save === "unavailable" ? (
        <p className="mt-3 text-sm text-pretty text-muted">{copy.syncNeedsStorage}</p>
      ) : !paired ? (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primary} disabled={busy} onClick={() => void turnOn()}>
              {copy.syncTurnOn}
            </button>
            <button type="button" className={secondary} aria-expanded={step === "join"} onClick={() => setStep(step === "join" ? "idle" : "join")}>
              {copy.syncHaveCode}
            </button>
          </div>
          {step === "join" ? (
            <form className="mt-3" onSubmit={join}>
              <label className="block text-sm">
                <span>{copy.syncCodeLabel}</span>
                <input
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  className="field mt-1 h-11 w-full max-w-xs px-3 font-mono"
                  dir="ltr"
                  autoCapitalize="characters"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </label>
              <button type="submit" className={cn(secondary, "mt-2")} disabled={busy || !typed.trim()}>
                {copy.syncConnect}
              </button>
            </form>
          ) : null}
        </div>
      ) : (
        <div className="mt-3">
          <p role="status" className={cn("text-sm", status.state === "error" || status.state === "update" ? "text-bad" : "text-muted")}>
            {stateLine}
          </p>
          {status.pending > 0 ? (
            <p className="mt-1 text-sm text-muted">
              {copy.syncPending}: {num(status.pending)}
            </p>
          ) : null}
          {status.dropped > 0 ? (
            <p className="mt-1 text-sm text-pretty text-muted">
              {copy.syncDropped}: {num(status.dropped)}
            </p>
          ) : null}
          {showCode ? (
            <div className="mt-3">
              <p className="text-xs text-muted">{copy.syncCodeLabel}</p>
              <p dir="ltr" className="mt-1 font-mono text-lg tracking-wide break-all select-all" data-testid="sync-code">
                {status.code}
              </p>
              <p className="mt-1 text-xs text-pretty text-muted">{copy.syncCodeHint}</p>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={secondary} disabled={busy || status.state === "syncing"} onClick={() => void sync.sync()}>
              {copy.syncNow}
            </button>
            <button type="button" className={secondary} aria-expanded={showCode} onClick={() => setShowCode(!showCode)}>
              {showCode ? copy.syncHideCode : copy.syncShowCode}
            </button>
            {showCode ? (
              <button type="button" className={secondary} onClick={() => void copyCode()}>
                {copied ? copy.syncCopied : copy.syncCopy}
              </button>
            ) : null}
          </div>
          {step === "stop" || step === "delete" ? (
            <div className="mt-3 rounded-lg border border-line p-3">
              <p className="text-sm text-pretty">{step === "stop" ? copy.syncStopWarn : copy.syncDeleteWarn}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={primary}
                  disabled={busy}
                  onClick={() => {
                    if (step === "delete") void remove();
                    else
                      void act(async () => {
                        await sync.stop();
                        setStep("idle");
                        setShowCode(false);
                      });
                  }}
                >
                  {step === "stop" ? copy.syncStopYes : copy.syncDeleteYes}
                </button>
                <button type="button" className="min-h-11 px-3 text-sm" onClick={() => setStep("idle")}>
                  {copy.resetNo}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-x-4">
              <button type="button" className="min-h-11 text-sm text-muted" onClick={() => setStep("stop")}>
                {copy.syncStop}
              </button>
              <button type="button" className="min-h-11 text-sm text-bad" onClick={() => setStep("delete")}>
                {copy.syncDelete}
              </button>
            </div>
          )}
        </div>
      )}
      {notice ? (
        <p role="alert" className="mt-2 text-sm text-pretty text-bad">
          {noticeText[notice]}
        </p>
      ) : null}
    </section>
  );
}
