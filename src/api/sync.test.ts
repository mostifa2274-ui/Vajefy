import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { sqliteD1 } from "./d1-sqlite";
import { handleSync, SYNC_SCHEMA } from "./sync";

const d1 = sqliteD1;

const SPACE = "0123456789abcdef0123456789abcdef";
const TOKEN = "A".repeat(43);
const IV = "AAAAAAAAAAAAAAAA";

function call(db: D1DatabaseLike, method: string, body?: unknown, options: { token?: string; path?: string; after?: number } = {}) {
  const url = new URL(`https://vajefy.test/api/sync/${options.path ?? SPACE}`);
  if (options.after !== undefined) url.searchParams.set("after", String(options.after));
  return handleSync(
    new Request(url, { method, headers: options.token === "" ? {} : { authorization: `Bearer ${options.token ?? TOKEN}` }, body: body === undefined ? undefined : JSON.stringify(body) }),
    db,
  );
}
const op = (id: string, epoch = 0, reset = false) => ({ id, epoch, reset, iv: IV, data: Buffer.from(id).toString("base64") });

test("operations are stored once, in order, and only for the space's token", async () => {
  const db = d1();
  assert.deepEqual(await (await call(db, "POST", { ops: [op("op-00001"), op("op-00002")] })).json(), { epoch: 0, accepted: 2 });
  assert.deepEqual(await (await call(db, "POST", { ops: [op("op-00002"), op("op-00003")] })).json(), { epoch: 0, accepted: 1 }, "a repeated upload counts once");
  const listed = await (await call(db, "GET")).json();
  assert.deepEqual(listed.ops.map((item: { id: string }) => item.id), ["op-00001", "op-00002", "op-00003"]);
  const after = await (await call(db, "GET", undefined, { after: listed.ops[1].seq })).json();
  assert.deepEqual(after.ops.map((item: { id: string }) => item.id), ["op-00003"]);
  assert.equal((await call(db, "GET", undefined, { token: "B".repeat(43) })).status, 401);
  assert.equal((await call(db, "GET", undefined, { token: "" })).status, 401);
});

test("a reset starts a new epoch: older operations are pruned and late ones refused", async () => {
  const db = d1();
  await call(db, "POST", { ops: [op("op-00001"), op("op-00002")] });
  assert.deepEqual(await (await call(db, "POST", { ops: [op("reset-001", 0, true), op("op-00003", 1)] })).json(), { epoch: 1, accepted: 2 });
  const listed = await (await call(db, "GET")).json();
  assert.equal(listed.epoch, 1);
  assert.deepEqual(listed.ops.map((item: { id: string }) => item.id), ["reset-001", "op-00003"], "a new device starts from the reset");
  // A device that answered before learning of the reset cannot add that answer.
  const stale = await call(db, "POST", { ops: [op("op-late01", 0)] });
  assert.equal(stale.status, 409);
  assert.deepEqual(await stale.json(), { error: "stale", epoch: 1 });
});

test("deleting the synced copy removes everything; malformed requests are refused", async () => {
  const db = d1();
  await call(db, "POST", { ops: [op("op-00001")] });
  assert.equal((await call(db, "DELETE")).status, 204);
  // Devices still paired learn it is gone, and cannot start it again.
  assert.equal((await call(db, "GET")).status, 410);
  assert.equal((await call(db, "POST", { ops: [op("op-00002")] })).status, 410);
  assert.equal((await call(db, "DELETE")).status, 204);
  const { results } = await db.prepare("SELECT COUNT(*) AS n FROM sync_ops").all<{ n: number }>();
  assert.equal(results[0]!.n, 0, "nothing of the progress is kept");
  const fresh = d1();
  assert.equal((await call(fresh, "POST", { ops: [] })).status, 400);
  assert.equal((await call(fresh, "POST", { ops: [{ ...op("op-00001"), data: "<script>" }] })).status, 400);
  assert.equal((await call(fresh, "GET", undefined, { path: "not-a-space" })).status, 404);
  assert.equal((await call(fresh, "PUT", { ops: [op("op-00001")] })).status, 405);
});

test("the migration file creates the same tables as the Worker", () => {
  const file = fs
    .readFileSync(new URL("../../migrations/0001_sync.sql", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("--"))
    .map((line) => line.replace(/;$/, ""));
  assert.deepEqual(file, SYNC_SCHEMA);
});
