import assert from "node:assert/strict";
import test from "node:test";
import { audioSourceScopeProjection } from "./audio-source-scope";

function fixtures() {
  const curriculum = {
    units: [
      { id: "01-introductions", entries: [{ id: "e1" }] },
      { id: "02-family-home", entries: [{ id: "e2" }] },
      { id: "03-daily-routine", entries: [{ id: "e3" }] },
      { id: "04-food-drink", entries: [{ id: "e4" }] },
    ],
  };
  const enhanced = {
    entries: ["e1", "e2", "e3", "e4"].map((id) => ({
      id,
      headword: id,
      senses: [
        {
          id,
          pronunciation: { gb: "/" + id + "-gb/", us: "/" + id + "-us/" },
        },
      ],
    })),
  };
  const clips: Record<string, {
    duration: number;
    peak: number;
    rms: number;
    bytes: number;
    text: string;
    accent: "gb" | "us";
  }> = {};
  const senses: Record<string, Record<"gb" | "us", { word: { text: string; file: string } }>> = {};
  for (const id of ["e1", "e2", "e3", "e4"]) {
    senses[id] = {
      gb: { word: { text: id, file: id + "-gb.mp3" } },
      us: { word: { text: id, file: id + "-us.mp3" } },
    };
    for (const accent of ["gb", "us"] as const) {
      clips[id + "-" + accent + ".mp3"] = {
        duration: 0.8,
        peak: 0.6,
        rms: 0.1,
        bytes: 100,
        text: id,
        accent,
      };
    }
  }
  const manifest = { clips, senses };
  const report = {
    flagged: [
      { sense: "e1", accent: "gb" as const, kind: "word", text: "e1", file: "e1-gb.mp3", issues: ["x"] },
      { sense: "e4", accent: "gb" as const, kind: "word", text: "e4", file: "e4-gb.mp3", issues: ["outside"] },
    ],
  };
  return { curriculum, enhanced, manifest, report };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test("audio source scope ignores changes confined to Units 4-12", () => {
  const base = fixtures();
  const expected = audioSourceScopeProjection(
    base.curriculum,
    base.enhanced,
    base.manifest,
    base.report,
  );

  const changed = clone(base);
  changed.curriculum.units[3]!.entries = [];
  changed.enhanced.entries.find((entry) => entry.id === "e4")!.headword = "changed";
  changed.manifest.clips["e4-gb.mp3"]!.bytes = 999;
  changed.report.flagged[1]!.issues = ["changed"];

  assert.deepEqual(
    audioSourceScopeProjection(
      changed.curriculum,
      changed.enhanced,
      changed.manifest,
      changed.report,
    ),
    expected,
  );
});

test("audio source scope changes for scoped membership, lexical input, clip metadata or flags", () => {
  const base = fixtures();
  const expected = JSON.stringify(
    audioSourceScopeProjection(base.curriculum, base.enhanced, base.manifest, base.report),
  );

  const lexical = clone(base);
  lexical.enhanced.entries.find((entry) => entry.id === "e1")!.headword = "changed";
  assert.notEqual(
    JSON.stringify(audioSourceScopeProjection(lexical.curriculum, lexical.enhanced, lexical.manifest, lexical.report)),
    expected,
  );

  const clip = clone(base);
  clip.manifest.clips["e2-us.mp3"]!.bytes = 101;
  assert.notEqual(
    JSON.stringify(audioSourceScopeProjection(clip.curriculum, clip.enhanced, clip.manifest, clip.report)),
    expected,
  );

  const flags = clone(base);
  flags.report.flagged[0]!.issues = ["different"];
  assert.notEqual(
    JSON.stringify(audioSourceScopeProjection(flags.curriculum, flags.enhanced, flags.manifest, flags.report)),
    expected,
  );

  const membership = clone(base);
  membership.curriculum.units[2]!.entries = [{ id: "e4" }];
  assert.notEqual(
    JSON.stringify(
      audioSourceScopeProjection(
        membership.curriculum,
        membership.enhanced,
        membership.manifest,
        membership.report,
      ),
    ),
    expected,
  );
});
