import { useEffect, useState } from "react";
import { explainStatus, explainWord } from "@/lib/learn/coach";
import { useCopy } from "@/lib/learn/i18n";
import { useProgress } from "@/lib/learn/store";

let availability: Promise<boolean> | null = null;

/** Asked once per page load; a failed check is retried next time. */
function notesAvailable(): Promise<boolean> {
  availability ??= explainStatus()
    .then((status) => status.available)
    .catch(() => {
      availability = null;
      return false;
    });
  return availability;
}

export function Explain({ id }: { id: string }) {
  const lang = useProgress((state) => state.lang);
  const copy = useCopy(lang);
  const [available, setAvailable] = useState(false);
  // Keyed by entry, so a note never lingers when the entry beside it changes.
  const [note, setNote] = useState<{ key: string; text: string } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ key: string; busy: boolean } | null>(null);
  const key = `${lang}:${id}`;

  useEffect(() => {
    let alive = true;
    void notesAvailable().then((value) => {
      if (alive) setAvailable(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!available) return null;

  const text = note?.key === key ? note.text : null;
  const busy = busyKey === key;
  const failed = failure?.key === key ? failure : null;

  async function ask() {
    if (busy || text) return;
    const cacheKey = `roshana-coach:${key}`;
    try {
      const saved = sessionStorage.getItem(cacheKey);
      if (saved) {
        setNote({ key, text: saved });
        return;
      }
    } catch {
      /* private mode */
    }
    setBusyKey(key);
    setFailure(null);
    try {
      const result = await explainWord({ data: { id, lang } });
      if (!result.ok) {
        if (result.error === "unavailable") setAvailable(false);
        else setFailure({ key, busy: result.error === "busy" });
        return;
      }
      setNote({ key, text: result.text });
      try {
        sessionStorage.setItem(cacheKey, result.text);
      } catch {
        /* ignore quota */
      }
    } catch {
      setFailure({ key, busy: false });
    } finally {
      setBusyKey((current) => (current === key ? null : current));
    }
  }

  return (
    <div className="mt-4">
      {text ? (
        <p lang={lang === "fa" ? "fa" : "en"} dir={lang === "fa" ? "rtl" : "ltr"} className="text-sm text-pretty text-muted">
          {text}
        </p>
      ) : (
        <button type="button" disabled={busy} onClick={() => void ask()} className="min-h-11 text-sm text-accent disabled:opacity-40">
          {busy ? copy.explaining : copy.explain}
        </button>
      )}
      {failed ? <p className="mt-1 text-sm text-bad">{failed.busy ? copy.explainBusy : copy.explainFail}</p> : null}
    </div>
  );
}
