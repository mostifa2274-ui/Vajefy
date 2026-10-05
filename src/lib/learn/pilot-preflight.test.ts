import assert from "node:assert/strict";
import test from "node:test";
import type {
  Pilot,
  PilotSelectionProvenance,
  Review,
} from "./content";
import {
  evaluatePilotPreflight,
  LEARNING_PILOT_MIN_PARTICIPANTS,
} from "./pilot-preflight";
import { createPilotRoster } from "./pilot-roster";

const IDS = ["lex:A1:a", "lex:A1:b"];
const CONTENT_VERSION = "content-v1";
const PROVENANCE: PilotSelectionProvenance = {
  version: 1,
  level: "A1",
  entries: 2,
  fingerprint: "abc123def456",
};

function review(version: string): Review {
  return {
    version,
    bilingual: "approved",
    pronunciation: "approved",
    reviewer: "Human Reviewer",
    date: "2026-10-05",
  };
}

function pilot(options: {
  approved?: boolean;
  released?: boolean;
  missingAudio?: boolean;
  checks?: number;
  provenance?: PilotSelectionProvenance;
  contentVersion?: string;
} = {}): Pilot {
  const checks = options.checks ?? 3;
  const entries = IDS.map((id, index) => {
    const version = `entry-v${index + 1}`;
    return {
      id,
      headword: id.endsWith(":a") ? "a" : "b",
      goals: ["general"],
      senses: [
        {
          id,
          pos: "noun",
          gloss: "نمونه",
          meaning: "معنی نمونه",
          grammar: [{ pattern: "Example pattern", note: "الگوی نمونه" }],
          examples: [
            { en: "Example one.", fa: "نمونهٔ یک." },
            { en: "Example two.", fa: "نمونهٔ دو." },
          ],
          collocations: ["example word"],
          usage: "کاربرد نمونه",
          mistake: {
            wrong: "Wrong example.",
            right: "Right example.",
            why: "توضیح نمونه",
          },
          pronunciation: { gb: "/a/", us: "/a/" },
          check: Array.from({ length: checks }, (_, checkIndex) => ({
            type: "produce",
            id: `check-${checkIndex + 1}`,
            prompt: "نمونه",
            frame: "___",
            answer: "answer",
            accept: [],
            why: "توضیح",
          })),
        },
      ],
      version,
      order: index,
      released: options.released ?? false,
      review: options.approved ? review(version) : null,
    };
  });

  const audio = Object.fromEntries(
    entries.map((entry, index) => [
      entry.id,
      {
        gb: {
          word: `gb-${index}.mp3`,
          examples: options.missingAudio && index === 1
            ? [`gb-${index}-1.mp3`, null]
            : [`gb-${index}-1.mp3`, `gb-${index}-2.mp3`],
        },
        us: {
          word: `us-${index}.mp3`,
          examples: [`us-${index}-1.mp3`, `us-${index}-2.mp3`],
        },
      },
    ]),
  );

  return {
    version: options.contentVersion ?? CONTENT_VERSION,
    pilotSelection: options.provenance ?? PROVENANCE,
    entries,
    contrasts: [],
    scenes: [],
    audio,
    audioPack: {
      gb: { files: [], bytes: 0 },
      us: { files: [], bytes: 0 },
    },
  } as Pilot;
}

function selection(provenance = PROVENANCE) {
  return { ids: IDS, provenance };
}

function roster(options: {
  channel?: "draft" | "released";
  contentVersion?: string;
  participants?: number;
  seed?: string;
} = {}) {
  const count = options.participants ?? LEARNING_PILOT_MIN_PARTICIPANTS;
  const participants = Array.from(
    { length: count },
    (_, index) => `P-${String(index + 1).padStart(3, "0")}`,
  );
  return createPilotRoster({
    participants,
    seed: options.seed ?? "private-preflight-seed",
    contentVersion: options.contentVersion ?? CONTENT_VERSION,
    enhancedChannel: options.channel ?? "released",
    dailyMinutes: 15,
  });
}

test("usability preflight allows machine-ready draft content without human approvals", () => {
  const report = evaluatePilotPreflight({
    phase: "usability",
    pilot: pilot(),
    selection: selection(),
  });

  assert.equal(report.ready, true);
  assert.equal(report.summary.machineReadyEntries, 2);
  assert.equal(report.summary.fullyApprovedEntries, 0);
  assert.equal(report.summary.releasedEntries, 0);
  assert.deepEqual(report.blockers, []);
});

test("usability preflight fails closed on selection drift or missing machine evidence", () => {
  const drifted = evaluatePilotPreflight({
    phase: "usability",
    pilot: pilot({
      provenance: { ...PROVENANCE, fingerprint: "different1234" },
      missingAudio: true,
    }),
    selection: selection(),
  });

  assert.equal(drifted.ready, false);
  assert.ok(drifted.blockers.includes("pilot-selection-provenance-mismatch"));
  assert.ok(drifted.blockers.includes("machine-readiness:1/2"));
});

test("learning preflight refuses enrollment before real review, release and roster evidence", () => {
  const report = evaluatePilotPreflight({
    phase: "learning",
    pilot: pilot(),
    selection: selection(),
  });

  assert.equal(report.ready, false);
  assert.ok(report.blockers.includes("bilingual-review:2"));
  assert.ok(report.blockers.includes("pronunciation-review:2"));
  assert.ok(report.blockers.includes("released-pilot-content:0/2"));
  assert.ok(report.blockers.includes("pilot-roster-missing"));
});

test("learning preflight passes only with approved released content and a matching released-channel roster", () => {
  const report = evaluatePilotPreflight({
    phase: "learning",
    pilot: pilot({ approved: true, released: true }),
    selection: selection(),
    roster: roster(),
  });

  assert.equal(report.ready, true);
  assert.deepEqual(report.blockers, []);
  assert.equal(report.summary.rosterParticipants, 20);
  assert.equal(
    report.summary.enhancedRosterParticipants! +
      report.summary.comparisonRosterParticipants!,
    20,
  );
});

test("learning preflight rejects draft-arm, stale-version and undersized rosters", () => {
  const draft = evaluatePilotPreflight({
    phase: "learning",
    pilot: pilot({ approved: true, released: true }),
    selection: selection(),
    roster: roster({ channel: "draft" }),
  });
  assert.equal(draft.ready, false);
  assert.ok(draft.blockers.includes("pilot-roster-enhanced-channel:draft"));

  const stale = evaluatePilotPreflight({
    phase: "learning",
    pilot: pilot({ approved: true, released: true }),
    selection: selection(),
    roster: roster({ contentVersion: "older-content" }),
  });
  assert.equal(stale.ready, false);
  assert.ok(stale.blockers.includes("pilot-roster-content-version-mismatch"));
  assert.ok(
    stale.blockers.includes("pilot-roster-assessment-bank-version-mismatch"),
  );

  const small = evaluatePilotPreflight({
    phase: "learning",
    pilot: pilot({ approved: true, released: true }),
    selection: selection(),
    roster: roster({ participants: 19 }),
  });
  assert.equal(small.ready, false);
  assert.ok(
    small.blockers.some((blocker) => blocker.startsWith("pilot-roster-size:19")),
  );
});

test("learning preflight can verify the archived assignment seed without storing it", () => {
  const seed = "archived-private-seed";
  const good = roster({ seed });
  const ok = evaluatePilotPreflight({
    phase: "learning",
    pilot: pilot({ approved: true, released: true }),
    selection: selection(),
    roster: good,
    seed,
  });
  assert.equal(ok.ready, true);

  const wrong = evaluatePilotPreflight({
    phase: "learning",
    pilot: pilot({ approved: true, released: true }),
    selection: selection(),
    roster: good,
    seed: "wrong-seed",
  });
  assert.equal(wrong.ready, false);
  assert.ok(
    wrong.blockers.some((blocker) =>
      blocker.includes("does not match the roster fingerprint"),
    ),
  );
});
