import { useState } from "react";
import { explainWord } from "@/lib/learn/coach";
import { useCopy } from "@/lib/learn/i18n";
import { useProgress } from "@/lib/learn/store";

export function Explain({
  word,
  meaning,
  example,
  pos,
}: {
  word: string;
  meaning: string;
  example?: string;
  pos?: string;
}) {
  const lang = useProgress((state) => state.lang);
  const copy = useCopy(lang);
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function ask() {
    if (busy || text) return;
    const cacheKey = `roshana-coach:${lang}:${word}:${meaning}`;
    try {
      const saved = sessionStorage.getItem(cacheKey);
      if (saved) {
        setText(saved);
        return;
      }
    } catch {
      /* private mode */
    }
    setBusy(true);
    setFailed(false);
    try {
      const result = await explainWord({
        data: { word, meaning, example: example ?? "", pos: pos ?? "", lang },
      });
      if (!result.ok) {
        setFailed(true);
        return;
      }
      setText(result.text);
      try {
        sessionStorage.setItem(cacheKey, result.text);
      } catch {
        /* ignore quota */
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
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
      {failed ? <p className="mt-1 text-sm text-bad">{copy.explainFail}</p> : null}
    </div>
  );
}
