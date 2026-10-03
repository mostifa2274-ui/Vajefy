import { posLabel, type Copy } from "@/lib/learn/i18n";
import { POS_FA, pronunciationFor, senseAudio, type PilotEntry, type PilotIndex } from "@/lib/learn/pilot";
import { WrongRight } from "./feedback";
import { Sep, SpeakButton } from "./ui";

/** Every sense of an enhanced pilot entry, as reference in the Words page. */
export function PilotEntryDetail({
  entry,
  index,
  copy,
  lang,
  accent,
}: {
  entry: PilotEntry;
  index: PilotIndex;
  copy: Copy;
  lang: "fa" | "en";
  accent: "en-GB" | "en-US";
}) {
  return (
    <div className="mt-4 grid gap-5">
      {entry.senses.map((sense, position) => {
        const clips = senseAudio(index.pilot.audio, sense.id, accent);
        return (
          <section key={sense.id} className="border-t border-line pt-4" aria-label={`${entry.headword} ${position + 1}`}>
            <p className="text-xs text-muted">
              {position + 1}. {posLabel(POS_FA[sense.pos], lang)}
              <Sep />
              <span lang="en" dir="ltr">{pronunciationFor(sense, accent)}</span>
            </p>
            <p lang="fa" dir="rtl" className="mt-1 text-lg font-medium">{sense.gloss}</p>
            <p lang="fa" dir="rtl" className="mt-1 text-sm text-pretty">{sense.meaning}</p>
            <div className="mt-2">
              <SpeakButton text={entry.headword} label={copy.listen} clip={clips.word} slow />
            </div>
            <ul className="mt-3 grid gap-1 text-sm">
              {sense.grammar.map((item) => (
                <li key={item.pattern}>
                  <span lang="en" dir="ltr" className="font-medium">{item.pattern}</span>
                  <span lang="fa" dir="rtl" className="block text-muted text-pretty">{item.note}</span>
                </li>
              ))}
            </ul>
            <ul className="mt-3 grid gap-2">
              {sense.examples.map((example, at) => (
                <li key={example.en} className="border-s-2 border-accent ps-3 text-sm">
                  <span lang="en" dir="ltr" className="block text-pretty">{example.en}</span>
                  <span lang="fa" dir="rtl" className="block text-muted text-pretty">{example.fa}</span>
                  <SpeakButton text={example.en} label={copy.listenExample} clip={clips.examples[at]} />
                </li>
              ))}
            </ul>
            <p lang="en" dir="ltr" className="mt-3 text-sm text-pretty">
              <span className="text-muted">{copy.collocationsLabel}: </span>
              {sense.collocations.join(" · ")}
            </p>
            {sense.usage ? <p lang="fa" dir="rtl" className="mt-2 text-sm text-pretty">{sense.usage}</p> : null}
            <div className="mt-3 rounded-md bg-paper-2 p-3 text-sm">
              <p className="text-xs text-muted">{copy.mistakeLabel}</p>
              <WrongRight wrong={sense.mistake.wrong} right={sense.mistake.right} why={sense.mistake.why} copy={copy} />
            </div>
          </section>
        );
      })}
      {!entry.released ? <p className="text-xs text-muted">{copy.draftContent}</p> : null}
    </div>
  );
}
