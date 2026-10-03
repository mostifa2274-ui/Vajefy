# Sync between devices

Progress lives on each device ([PROGRESS_STORAGE.md](PROGRESS_STORAGE.md)).
Sync is optional: it keeps the same progress on a learner's phone and computer
without an account, and the server cannot read what it stores. It is **off**
until a deployment turns it on (see [Turning it on](#turning-it-on)). Until
then the app does not offer it, and backups remain the way to move progress.

## For the learner

Under **Progress → Sync between devices**:

- **Turn on sync** makes a sync code, such as `7KQ2M-0XW4C-9TZ1H-PB6RD-3NVYE-G`,
  and uploads this device's progress as the starting point.
- **I have a code** pairs another device. The code is forgiving to type: case,
  spaces, dashes and the look-alike letters O, I, L and U are accepted.
  - If only one side has progress, it is used.
  - If both have progress, the learner chooses which to keep, and the other is
    replaced on every device. Nothing changes until they choose.
- After that, every answer, setting, bookmark, undo, reset and import made on
  one device reaches the others, usually within seconds. The panel shows when
  the device last synced and how many changes are waiting.
- **Stop syncing on this device** keeps its progress and leaves the synced copy
  for the other devices.
- **Delete the synced copy** removes it from the server. Every paired device
  then stops syncing, keeps its own progress and says why.

The code is the only credential. Anyone who has it can read and change the
synced progress, and a lost code cannot be recovered; stopping and turning sync
on again makes a new one.

## What the server can see

Everything is encrypted on the device before it is sent (`sync-crypto.ts`):

| From the code (128 random bits), by HKDF-SHA-256 | Used for |
|---|---|
| The space id (128 bits) | Which log to read and write |
| The token (256 bits) | Proving possession; the server stores only its SHA-256 hash |
| An AES-256-GCM key | Encrypting each operation, after gzip, with a fresh random IV |
| An HMAC-SHA-256 key | The id each operation is stored under |

The key never leaves the device. The server stores, per operation, an opaque
id, an epoch number, whether it is a reset, and the ciphertext. It cannot see
words, answers, grades, settings or the language. It does see metadata: how
many operations a space has, their sizes and when they arrive, which reveals
roughly how much and when someone studies. Operation ids are hashed with the
HMAC key because some ids name what was studied (answers brought over from an
older release carry their word).

A tampered or substituted operation fails AES-GCM authentication, so sync stops
with an error rather than applying it. The server could withhold or delete
operations, as any storage service could; it cannot invent or alter them.

## How progress stays consistent

Sync uses the same operations that are saved locally:

- **Each operation is applied once.** Operations keep their unique ids end to
  end. The server stores an id once, and each device's database skips an id it
  has already applied, so an answer uploaded twice, or downloaded twice,
  counts once.
- **Nothing is lost on the way.** A committed operation goes into an outbox in
  IndexedDB (`vajefy-sync`) and leaves the crash journal only after that. If
  the page closes in between, the journal hands it to sync on the next start.
  The download position is saved after each applied operation.
- **A device does not re-apply its own uploads.** It records what it sent, so
  its starting snapshot coming back down does not roll back later answers.
- **Resets win.** Clearing progress, importing a backup, or keeping one device's
  progress when pairing starts a new *epoch*. The server drops everything
  before it, so a new device starts from it, and refuses operations from an
  older epoch. A device that answered offline before hearing of a reset drops
  those answers rather than mixing them into the cleared progress, and the
  panel counts them.
- **Concurrent answers merge.** Answers made on two devices while offline are
  all kept and counted. Each device schedules them in the order it receives
  them, so if both devices answered the same word, its next due date can
  differ slightly between them until it is next reviewed.
- **Concurrent resets.** If two devices clear or replace progress at the same
  time, the one that reaches the server first wins on every device. An import
  can be repeated from its file.
- **Versions.** Each operation carries the progress version that wrote it. A
  device that receives one from a newer version stops syncing and asks to be
  reloaded, rather than misreading it.

Not synced: the position inside an unfinished session, downloaded audio, and
speaking-practice recordings (which are never stored).

Sync runs a few seconds after a change, when the page becomes visible, when the
device comes back online and on **Sync now**; after a failure it tries again a
minute later. Tabs share one outbox and follow each other's pairing.

## The server

`/api/sync/<space>` with `Authorization: Bearer <token>` (`src/api/sync.ts`):

| Method | Does |
|---|---|
| `GET ?after=<seq>` | Up to 200 operations after a position, and the current epoch |
| `POST {ops}` | Stores up to 100 operations; a repeated id is ignored; 409 if any is from an older epoch |
| `DELETE` | Deletes every operation and marks the space deleted |

Limits: 4 MB per request and 50 MB per space. A deleted space keeps only its id
and token hash, so devices still paired with it get 410 and stop, instead of
quietly starting it again. `GET /api/sync/status` says whether sync is on.

## Turning it on

1. Create a D1 database and bind it as `SYNC_DB` in `wrangler.jsonc`:

   ```jsonc
   "d1_databases": [{ "binding": "SYNC_DB", "database_name": "vajefy-sync", "database_id": "<id>" }]
   ```

   The Worker creates its tables on first use; `migrations/0001_sync.sql` holds
   the same schema for `wrangler d1 migrations apply`.
2. Set the variable `SYNC=on`.
3. Optionally, limit requests per address with a rate-limit binding named
   `SYNC_LIMITER`, for example 120 a minute:

   ```jsonc
   "ratelimits": [{ "name": "SYNC_LIMITER", "namespace_id": "1002", "simple": { "limit": 120, "period": 60 } }]
   ```

Turning sync on changes what the app can send, so the privacy notice in the
README mentions it. Failed syncs are reported as `sync-failed` when error
reporting is on ([OPERATIONS.md](OPERATIONS.md#error-reports)).

## Tests

- `src/lib/learn/sync.test.ts` runs devices with their own databases against
  the real server code over SQLite: adopting progress, offline answers, resets,
  the choice when both sides have progress, a crash between saving and
  queueing, operations the server will never accept, deletion, and that the
  server holds only opaque ids and ciphertext.
- `src/api/sync.test.ts` covers the server: once-only storage, epochs,
  deletion, validation and the migration file.
- `tests/e2e/sync.spec.ts` pairs three browser contexts through the interface.
