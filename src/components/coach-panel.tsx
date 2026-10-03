import { useEffect, useState } from "react";
import type { CoachReply, CoachRequest } from "@/api/coach-core";
import { askCoach, coachAvailable, type CoachResult } from "@/lib/coach";
import type { Copy } from "@/lib/learn/i18n";
import { cn } from "@/lib/cn";

/**
 * Ask the AI coach about this word (docs/COACH.md). Shown only when the
 * service is configured; otherwise the page's own notes are the help. A
 * learner's sentence is sent only after they confirm, once per page. The
 * answer is advice: it changes nothing in their progress.
 */
export function CoachPanel({
  request,
  label,
  copy,
  lang,
}: {
  request: Omit<CoachRequest, "lang">;
  label: string;
  copy: Copy;
  lang: "fa" | "en";
}) {
  const [available, setAvailable] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CoachResult | null>(null);

  useEffect(() => {
    let alive = true;
    void coachAvailable().then((value) => alive && setAvailable(value));
    return () => {
      alive = false;
    };
  }, []);

  if (!available) return null;

  async function ask() {
    setConfirming(false);
    setBusy(true);
    setResult(await askCoach({ ...request, lang }));
    setBusy(false);
  }

  const sendsWriting = request.task === "sentence";
  const button = "inline-flex min-h-11 items-center rounded-md bg-paper-2 px-3 text-sm shadow-[var(--shadow-border)] disabled:opacity-40";
  return (
    <div className="mt-4 rounded-md border border-line p-3">
      {confirming ? (
        <div>
          <p className="text-sm text-pretty">{copy.coachPrivacy}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={button} onClick={() => void ask()}>
              {copy.coachSend}
            </button>
            <button type="button" className="min-h-11 px-3 text-sm" onClick={() => setConfirming(false)}>
              {copy.resetNo}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={button} disabled={busy} onClick={() => (sendsWriting && !result ? setConfirming(true) : void ask())}>
          {label}
        </button>
      )}
      <p role="status" className="mt-2 text-sm text-muted">
        {busy ? copy.coachThinking : ""}
      </p>
      {result ? result.ok ? <Answer reply={result.reply} copy={copy} lang={lang} /> : <p className="text-sm text-bad">{copy[result.reason === "offline" ? "coachOffline" : result.reason === "limit" ? "coachLimit" : "coachFailed"]}</p> : null}
    </div>
  );
}

function Answer({ reply, copy, lang }: { reply: CoachReply; copy: Copy; lang: "fa" | "en" }) {
  const verdict = reply.verdict === "natural" ? copy.coachNatural : reply.verdict === "needs-change" ? copy.coachNeedsChange : copy.coachUnsure;
  return (
    <div className="text-sm">
      <p className={cn("font-medium", reply.verdict === "natural" ? "text-good" : reply.verdict === "needs-change" ? "text-bad" : "text-muted")}>
        <span aria-hidden>{reply.verdict === "natural" ? "✓ " : reply.verdict === "needs-change" ? "✗ " : "? "}</span>
        {verdict}
        {reply.issue ? <span className="font-normal text-muted"> — {reply.issue}</span> : null}
      </p>
      <p lang={lang} dir={lang === "fa" ? "rtl" : "ltr"} className="mt-1 text-pretty">
        {reply.explanation}
      </p>
      {reply.corrected ? (
        <p className="mt-2">
          <span className="text-muted">{copy.coachCorrected}: </span>
          <span lang="en" dir="ltr">
            {reply.corrected}
          </span>
        </p>
      ) : null}
      {reply.verdict === "unsure" ? <p className="mt-2 text-muted text-pretty">{copy.coachUnsureNote}</p> : null}
      {reply.next ? (
        <p lang={lang} dir={lang === "fa" ? "rtl" : "ltr"} className="mt-2 text-pretty">
          {reply.next}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-muted">{copy.coachAi}</p>
    </div>
  );
}
