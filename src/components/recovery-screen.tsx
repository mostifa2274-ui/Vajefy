import { useEffect, useMemo, useRef, useState } from "react";
import { downloadText } from "@/lib/learn/download-backup";
import type { Copy } from "@/lib/learn/i18n";
import { recoverProgress, savedCopyFileName, type HeldSave } from "@/lib/learn/recovery";
import { progressStorage } from "@/lib/learn/storage";
import { useProgress } from "@/lib/learn/store";
import { Num } from "./ui";

const BUTTON = "min-h-11 rounded-md bg-paper-2 px-3 text-sm shadow-[var(--shadow-border)]";
const PRIMARY = "min-h-11 rounded-md bg-accent px-3 text-sm text-accent-fg";

async function reloadToUpdate() {
  try {
    await (await navigator.serviceWorker?.getRegistration())?.update();
  } catch {
    // An unavailable service worker must not prevent the reload itself.
  }
  window.location.reload();
}

/**
 * Shown instead of the app while a saved copy is held. Every way out is an
 * explicit choice; the original can be downloaded byte for byte first.
 */
export function RecoveryScreen({ held, copy }: { held: HeldSave; copy: Copy }) {
  const recovery = useMemo(() => recoverProgress(held.raw), [held]);
  const setLang = useProgress((state) => state.setLang);
  const restoreProgress = useProgress((state) => state.restoreProgress);
  const startOver = useProgress((state) => state.startOver);
  // A confirmation belongs to the copy it was opened for, never to a newer one.
  const [opened, setOpened] = useState<{ held: HeldSave; choice: "readable" | "fresh" } | null>(null);
  const confirm = opened?.held === held ? opened.choice : null;
  const setConfirm = (choice: "readable" | "fresh" | null) => setOpened(choice ? { held, choice } : null);
  const heading = useRef<HTMLHeadingElement>(null);
  const future = held.kind === "future";

  useEffect(() => {
    heading.current?.focus();
  }, [held]);

  useEffect(() => {
    // Speak the learner's own language when the save still says which. The
    // held save blocks writes, so this changes only the screen.
    if (recovery && !recovery.report.reset.includes("lang")) setLang(recovery.progress.lang);
  }, [recovery, setLang]);

  function replace(apply: () => void) {
    progressStorage.release();
    apply();
  }

  return (
    <section aria-labelledby="recovery-title" className="max-w-2xl">
      <h1 id="recovery-title" ref={heading} tabIndex={-1} className="text-3xl font-medium text-balance outline-none">
        {future ? copy.futureTitle : copy.recoveryTitle}
      </h1>
      <p className="mt-2 text-pretty text-muted">{future ? copy.futureHint : copy.recoveryHint}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {future ? (
          <button type="button" onClick={() => void reloadToUpdate()} className={PRIMARY}>
            {copy.reloadToUpdate}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => downloadText(held.raw, savedCopyFileName())}
          className={future ? BUTTON : PRIMARY}
        >
          {copy.downloadSavedCopy}
        </button>
      </div>

      <section aria-labelledby="readable-title" className="mt-6 rounded-lg border border-line p-4">
        <h2 id="readable-title" className="text-base font-medium">
          {copy.readableTitle}
        </h2>
        {recovery ? (
          <>
            <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">{copy.readableWords}</dt>
              <dd>
                <Num value={recovery.report.words.kept} /> / <Num value={recovery.report.words.total} />
              </dd>
              <dt className="text-muted">{copy.readableReviews}</dt>
              <dd>
                <Num value={recovery.report.reviews.kept} /> / <Num value={recovery.report.reviews.total} />
              </dd>
              {recovery.report.reset.length ? (
                <>
                  <dt className="text-muted">{copy.readableReset}</dt>
                  <dd>
                    <Num value={recovery.report.reset.length} />
                  </dd>
                </>
              ) : null}
            </dl>
            {confirm === "readable" ? (
              <Confirm
                text={future ? copy.useReadableFutureWarn : copy.useReadableWarn}
                yes={copy.useReadableYes}
                no={copy.resetNo}
                onYes={() => replace(() => restoreProgress(recovery.progress))}
                onNo={() => setConfirm(null)}
              />
            ) : (
              <button type="button" onClick={() => setConfirm("readable")} className={`mt-3 ${BUTTON}`}>
                {copy.useReadable}
              </button>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-pretty text-muted">{copy.nothingReadable}</p>
        )}
      </section>

      <div className="mt-6">
        {confirm === "fresh" ? (
          <Confirm
            text={copy.startOverWarn}
            yes={copy.startOverYes}
            no={copy.resetNo}
            onYes={() => replace(startOver)}
            onNo={() => setConfirm(null)}
          />
        ) : (
          <button type="button" onClick={() => setConfirm("fresh")} className="min-h-11 text-sm text-bad">
            {copy.startOver}
          </button>
        )}
      </div>
    </section>
  );
}

function Confirm({
  text,
  yes,
  no,
  onYes,
  onNo,
}: {
  text: string;
  yes: string;
  no: string;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="text-sm text-pretty">{text}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={onYes} className={PRIMARY}>
          {yes}
        </button>
        <button type="button" onClick={onNo} className="min-h-11 px-3 text-sm">
          {no}
        </button>
      </div>
    </div>
  );
}
