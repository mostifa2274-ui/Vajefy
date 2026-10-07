import assert from "node:assert/strict";
import test from "node:test";
import type { AudioUnitPack } from "./content";
import { AUDIO_PACK_CACHE_PREFIX, packCacheName } from "./audio-pack";

const pack: AudioUnitPack = {
  unitId: "01-introductions",
  accent: "gb",
  version: "v2",
  files: [
    { file: "pilot/a.mp3", bytes: 3 },
    { file: "pilot/b.mp3", bytes: 4 },
  ],
  bytes: 7,
};

test("unit pack cache names isolate unit, accent and version", () => {
  assert.equal(
    packCacheName(pack),
    `${AUDIO_PACK_CACHE_PREFIX}01-introductions:gb:v2`,
  );
});

test("changing only the pack version changes the cache namespace", () => {
  assert.notEqual(packCacheName(pack), packCacheName({ ...pack, version: "v3" }));
});

test("changing accent cannot share an installed pack", () => {
  assert.notEqual(packCacheName(pack), packCacheName({ ...pack, accent: "us" }));
});
