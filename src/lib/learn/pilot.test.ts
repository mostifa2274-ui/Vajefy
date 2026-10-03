import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import type { AudioPack, Pilot, PilotCatalogue, PilotPart } from "./content";
import { buildLesson, contentIds, resolveItem } from "./lesson";
import { hasContent, indexPilot, introductionOrder, loadAudioPack, loadPilot } from "./pilot";

const pilot = JSON.parse(readFileSync("content/compiled/enhanced.json", "utf8")) as Pilot;
const read = <T>(file: string) => JSON.parse(readFileSync(`public/data/${file}`, "utf8")) as T;
const catalogue = read<PilotCatalogue>("enhanced/index.json");
const T0 = 1_800_000_000_000;
const seeded = () => {
  let seed = 7;
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
};

/** Serve `public/` as the app would, recording each request; `fail` answers one path with an error once. */
function serve(fail?: string) {
  const fetched: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    fetched.push(url);
    if (url === fail) {
      fail = undefined;
      return new Response("", { status: 503 });
    }
    return new Response(readFileSync(`public${url}`));
  }) as typeof fetch;
  return { fetched, restore: () => (globalThis.fetch = original) };
}

test("the app's files hold the compiled content, each entry listed once and in one part", () => {
  assert.equal(catalogue.version, pilot.version);
  assert.deepEqual(catalogue.contrasts, pilot.contrasts);
  assert.deepEqual(catalogue.scenes, pilot.scenes);
  const parts = catalogue.parts.map((file) => read<PilotPart>(file));
  assert.deepEqual(
    readdirSync("public/data/enhanced").sort(),
    [...catalogue.parts.map((file) => file.replace("enhanced/", "")), "audio-pack.json", "index.json"].sort(),
    "no part of an earlier build is left",
  );
  assert.equal(catalogue.entries.length, pilot.entries.length);
  assert.equal(parts.reduce((sum, part) => sum + part.entries.length, 0), pilot.entries.length);
  catalogue.entries.forEach((listed, position) => {
    const { review: _review, ...full } = pilot.entries[position]!;
    assert.equal(listed.id, full.id);
    assert.deepEqual(parts[listed.part]!.entries.find((entry) => entry.id === listed.id), full, listed.id);
    assert.deepEqual(listed.senses, full.senses.map(({ id, pos, gloss }) => ({ id, pos, gloss })));
    assert.deepEqual([listed.headword, listed.goals, listed.version, listed.released], [full.headword, full.goals, full.version, full.released]);
  });
  // Parts follow the curriculum, so the next lesson's words are usually in one.
  assert.deepEqual(catalogue.entries.map((entry) => entry.part), [...catalogue.entries.map((entry) => entry.part)].sort((a, b) => a - b));
  assert.deepEqual(Object.assign({}, ...parts.map((part) => part.audio)), pilot.audio);
  assert.deepEqual(read<AudioPack>("enhanced/audio-pack.json"), pilot.audioPack);
});

test("every target is listed at once, and content loads only for the targets asked for", async () => {
  const server = serve();
  try {
    const listed = await loadPilot();
    assert.deepEqual(server.fetched, ["/data/enhanced/index.json"]);
    const whole = indexPilot(pilot);
    assert.deepEqual(listed.targets.map((target) => target.sense.id), whole.targets.map((target) => target.sense.id));
    assert.equal(listed.content.size, 0);

    const targets = introductionOrder(listed.targets, "general").slice(0, 3);
    const ids = targets.map((target) => target.sense.id);
    assert.ok(!hasContent(listed, ids));
    const loaded = await loadPilot(ids);
    assert.equal(server.fetched.length, 2, "the first lesson's words share a part");
    assert.notEqual(loaded, listed, "a screen holding the index sees the new content");
    assert.ok(hasContent(loaded, ids));
    assert.ok(loaded.content.size < whole.content.size);
    assert.deepEqual(loaded.audio[ids[0]!], pilot.audio[ids[0]!]);
    assert.equal(await loadPilot(ids), loaded, "nothing more to load, so the same index");
    assert.equal(server.fetched.length, 2);

    // A lesson from the loaded part is the lesson the whole content gives.
    const lesson = buildLesson(loaded, targets, new Set(), T0, seeded());
    const reference = buildLesson(whole, targets, new Set(), T0, seeded());
    assert.deepEqual(lesson.steps, reference.steps);
    assert.ok(hasContent(loaded, contentIds(lesson)));
    for (const step of lesson.steps) if (step.kind === "check") assert.ok(resolveItem(loaded, step.ref), JSON.stringify(step.ref));

    // An id without enhanced content needs nothing loaded.
    assert.ok(hasContent(listed, ["lex:B2:nonexistent"]));
    assert.equal(await loadPilot(["lex:B2:nonexistent"]), loaded);

    assert.deepEqual(await loadAudioPack(), pilot.audioPack);
  } finally {
    server.restore();
  }
});

test("a part that fails to load is fetched afresh next time", async () => {
  const last = catalogue.entries.at(-1)!;
  const server = serve(`/data/${catalogue.parts[last.part]}`);
  try {
    await assert.rejects(loadPilot([last.id]));
    const loaded = await loadPilot([last.id]);
    assert.ok(loaded.entries.has(last.id));
    assert.equal(server.fetched.filter((url) => url === `/data/${catalogue.parts[last.part]}`).length, 2);
  } finally {
    server.restore();
  }
});
