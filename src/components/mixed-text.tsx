import { Fragment } from "react";
import { scriptLang, scriptRuns } from "@/lib/learn/bidi";

/**
 * Persian text with each embedded English run isolated and marked as English,
 * so it keeps its own direction and punctuation and is voiced in English.
 * English phrases of three words or more are kept in one block.
 * Use it inside a `lang="fa" dir="rtl"` element.
 */
export function Fa({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  const runs = scriptRuns(text);
  if (!runs.some((run) => run.latin)) return <>{text}</>;
  return (
    <>
      {runs.map((run, index) =>
        run.latin ? (
          // A phrase stays in one block: wrapped across lines inside Persian,
          // its parts would sit at opposite ends of each line.
          <bdi key={index} lang="en" className={run.long ? "inline-block max-w-full" : undefined}>
            {run.text}
          </bdi>
        ) : (
          <Fragment key={index}>{run.text}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * A paragraph whose language varies from item to item, such as a Practice
 * prompt that is a Persian meaning or an English sentence.
 */
export function Varied({ text, className }: { text: string; className?: string }) {
  const lang = scriptLang(text);
  return (
    <p lang={lang} dir={lang === "fa" ? "rtl" : "ltr"} className={className}>
      {lang === "fa" ? <Fa text={text} /> : text}
    </p>
  );
}
