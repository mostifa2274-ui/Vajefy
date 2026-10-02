import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { loadJson } from "./load";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("a failed load is retried on the next call instead of replayed", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("network down");
    return new Response(JSON.stringify([1, 2, 3]));
  }) as typeof fetch;

  await assert.rejects(loadJson("retry.json"));
  assert.deepEqual(await loadJson("retry.json"), [1, 2, 3]);
  assert.equal(calls, 2);
});

test("a successful load is cached", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response("{}");
  }) as typeof fetch;

  await loadJson("cached.json");
  await loadJson("cached.json");
  assert.equal(calls, 1);
});
