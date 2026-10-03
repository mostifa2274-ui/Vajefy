import { z } from "zod";

/**
 * Optional sync between a learner's devices (docs/SYNC.md). The server keeps
 * an append-only log of encrypted operations per sync space and cannot read
 * any of it: the key never leaves the learner's devices. It enforces only:
 *
 * - an operation id is stored once, so an answer uploaded twice counts once;
 * - after a reset or replacement (a new "epoch"), operations from an older
 *   epoch are refused, so a device that missed a reset cannot undo it;
 * - size limits, and deletion of the whole space on request. A deleted space
 *   keeps only its id and token hash, so devices still paired with it learn
 *   that it is gone (410) instead of quietly starting it again.
 */

export const SYNC_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS sync_spaces (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, epoch INTEGER NOT NULL DEFAULT 0, bytes INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sync_ops (seq INTEGER PRIMARY KEY AUTOINCREMENT, space_id TEXT NOT NULL, op_id TEXT NOT NULL, epoch INTEGER NOT NULL, reset INTEGER NOT NULL DEFAULT 0, iv TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(space_id, op_id))`,
  `CREATE INDEX IF NOT EXISTS sync_ops_space_seq ON sync_ops(space_id, seq)`,
];

/** Largest stored data per space, and per request. */
export const SPACE_LIMIT_BYTES = 50 * 1024 * 1024;
const BODY_LIMIT = 4 * 1024 * 1024;
const PAGE = 200;

const upload = z.object({
  ops: z
    .array(
      z.object({
        id: z.string().min(1).max(80).regex(/^[\w:.-]+$/),
        epoch: z.number().int().min(0),
        reset: z.boolean().optional(),
        iv: z.string().regex(/^[A-Za-z0-9+/=]{16}$/),
        data: z.string().min(1).max(3_000_000).regex(/^[A-Za-z0-9+/=]+$/),
      }),
    )
    .min(1)
    .max(100),
});

type Space = { id: string; token_hash: string; epoch: number; bytes: number; deleted: number };

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Tables are created once per database binding, on first use. */
const schemaReady = new WeakMap<D1DatabaseLike, Promise<unknown>>();

export async function handleSync(request: Request, db: D1DatabaseLike, now = Date.now()): Promise<Response> {
  const url = new URL(request.url);
  const space = url.pathname.match(/^\/api\/sync\/([0-9a-f]{32})$/)?.[1];
  const token = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if (!space) return json({ error: "not found" }, 404);
  if (!token) return json({ error: "unauthorised" }, 401);
  let ready = schemaReady.get(db);
  if (!ready) {
    ready = db.batch(SYNC_SCHEMA.map((statement) => db.prepare(statement))).catch((error: unknown) => {
      schemaReady.delete(db);
      throw error;
    });
    schemaReady.set(db, ready);
  }
  await ready;

  const tokenHash = await sha256(token);
  const existing = await db.prepare("SELECT id, token_hash, epoch, bytes, deleted FROM sync_spaces WHERE id = ?").bind(space).first<Space>();
  if (existing && !same(existing.token_hash, tokenHash)) return json({ error: "unauthorised" }, 401);
  if (existing?.deleted) return request.method === "DELETE" ? new Response(null, { status: 204 }) : json({ error: "deleted" }, 410);

  if (request.method === "GET") {
    if (!existing) return json({ epoch: 0, ops: [], more: false });
    const after = Math.max(0, Number(url.searchParams.get("after") ?? 0) || 0);
    const { results } = await db
      .prepare("SELECT seq, op_id AS id, epoch, reset, iv, data FROM sync_ops WHERE space_id = ? AND seq > ? ORDER BY seq LIMIT ?")
      .bind(space, after, PAGE + 1)
      .all<{ seq: number; id: string; epoch: number; reset: number; iv: string; data: string }>();
    return json({
      epoch: existing.epoch,
      ops: results.slice(0, PAGE).map((row) => ({ ...row, reset: Boolean(row.reset) })),
      more: results.length > PAGE,
    });
  }

  if (request.method === "DELETE") {
    if (existing) {
      await db.batch([
        db.prepare("DELETE FROM sync_ops WHERE space_id = ?").bind(space),
        db.prepare("UPDATE sync_spaces SET deleted = 1, epoch = 0, bytes = 0, updated_at = ? WHERE id = ?").bind(now, space),
      ]);
    }
    return new Response(null, { status: 204 });
  }

  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "GET, POST, DELETE" } });
  const text = await request.text();
  if (text.length > BODY_LIMIT) return json({ error: "too large" }, 413);
  let body: z.infer<typeof upload>;
  try {
    body = upload.parse(JSON.parse(text));
  } catch {
    return json({ error: "invalid" }, 400);
  }

  let epoch = existing?.epoch ?? 0;
  let bytes = existing?.bytes ?? 0;
  if (!existing) {
    await db.prepare("INSERT INTO sync_spaces (id, token_hash, epoch, bytes, created_at, updated_at) VALUES (?, ?, 0, 0, ?, ?)").bind(space, tokenHash, now, now).run();
  }
  // Operations made before a reset this device has not seen are refused whole;
  // the device fetches the reset first and drops them.
  if (body.ops.some((op) => op.epoch < epoch)) return json({ error: "stale", epoch }, 409);

  let accepted = 0;
  for (const op of body.ops) {
    const size = op.data.length + op.iv.length;
    if (bytes + size > SPACE_LIMIT_BYTES) return json({ error: "full", epoch, accepted }, 413);
    const inserted = await db
      .prepare("INSERT OR IGNORE INTO sync_ops (space_id, op_id, epoch, reset, iv, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING seq")
      .bind(space, op.id, op.epoch, op.reset ? 1 : 0, op.iv, op.data, now)
      .first<{ seq: number }>();
    if (!inserted) continue;
    accepted++;
    bytes += size;
    if (op.reset) {
      // A reset supersedes everything before it: later devices start from it.
      epoch = Math.max(epoch, op.epoch + 1);
      await db.prepare("DELETE FROM sync_ops WHERE space_id = ? AND seq < ?").bind(space, inserted.seq).run();
      const remaining = await db.prepare("SELECT COALESCE(SUM(LENGTH(data) + LENGTH(iv)), 0) AS bytes FROM sync_ops WHERE space_id = ?").bind(space).first<{ bytes: number }>();
      bytes = remaining?.bytes ?? size;
    }
  }
  await db.prepare("UPDATE sync_spaces SET epoch = ?, bytes = ?, updated_at = ? WHERE id = ?").bind(epoch, bytes, now, space).run();
  return json({ epoch, accepted });
}
