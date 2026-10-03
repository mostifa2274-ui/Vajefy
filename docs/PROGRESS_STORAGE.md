# Progress storage

Progress lives in the browser's IndexedDB database `vajefy`. Every change is an
**operation** with a unique id, and each operation is committed in **one
transaction** together with everything it changes. Backups and the database use
progress version 5.

## The database

| Store | Contents |
|---|---|
| `profile` | Settings, daily logs, lifetime counts, streak, XP and bookmarks |
| `cards` | One FSRS/legacy scheduling record per learning target |
| `skills` | Optional-practice skill evidence per word |
| `events` | One record per operation: answers with their evidence, plus every other change, so ids can be checked |
| `sessions` | Unfinished and finished review, practice and lesson sessions |
| `meta` | Migration record and progress version |

The review history shown in the app and exported in backups contains the
latest 12,000 review events that have not been undone. Practice answers and
skipped questions stay in `events` as evidence.

## One answer, one transaction

`src/lib/learn/ops.ts` defines each operation as a pure reducer. The reducers
cover:

- a review;
- a practice answer;
- a skipped question;
- adding a word;
- a settings change;
- a bookmark;
- removing orphaned entries;
- undo, reset and replace.

The same reducer runs twice:

1. **In memory**, at once, so the screen never waits.
2. **Inside an IndexedDB transaction** (`db.ts`). The transaction:
   - checks the operation id;
   - reads the stored profile and the records it needs;
   - applies the reducer;
   - writes the result, the event and the session state together.

   If any write fails, nothing is written.

The stored result is authoritative. When it differs from memory, because
another tab changed the same records first, memory is corrected and any
operations still waiting are applied again on top. Increments are computed
inside the transaction from the stored values, so two tabs answering at the
same time never lose each other's counts.

## Counted once

- An operation whose id is already in `events` is reported as a duplicate and
  not applied again. This covers retries, journal replays and repeated
  submissions.
- A tab ignores a second dispatch of an id it has already applied.

## The journal

Before its transaction, each operation is written to its own localStorage key,
`vajefy-op:<id>`. The key is removed after the commit.

- If the page closes, or the transaction fails, the next start replays every
  journaled operation. An operation that did commit is skipped by its id.
- Imports are not journaled. They are atomic, and repeating one is up to the
  learner.
- Session-only changes are not journaled either. Each answer carries its
  session state with it.

## Sessions survive leaving

A review or practice session is saved with every answer and every step:

- the current card or question;
- whether the answer is shown;
- the remaining queue;
- the answers so far;
- the cards already taught.

Reopening Review, or choosing **Continue** on Today or Quiz, resumes the
session where it stopped:

- A question that was answered but not yet followed by **Next** shows its result
  again. It is never asked twice.
- A queued card answered in another session in the meantime is dropped.
- Sessions older than 24 hours are not offered, nor are practice rounds whose
  questions are all answered.

Missed and still-learning cards return within the session at their **real
relearning time**. FSRS steps are 1 and 10 minutes. When only such cards
remain, a countdown offers **Finish for now** or **Show it now**.

**Undo last grade** reverts the most recent review in the session. It restores
the card and removes its counts, XP and history entry. Undo is refused when
anything has changed that card since, for example an answer in another tab.

A guided lesson (`/learn`) is saved the same way: its step list, the current
step, every answer with its retry, and the words it has already taught.

## Progress versions

| Version | Adds |
|---|---|
| 3 | FSRS memory state, target retention, review evidence |
| 4 | Per-word practice skills |
| 5 | Learning goal (everyday, work, study, general) and daily minutes (5, 10 or 15) |

A save from an older version is migrated in memory with `migrateProgress`. Defaults
fill only the new fields; nothing already saved changes. The result must pass the
current schema (`currentProgress` in `schema.ts`) before `db.upgrade()` writes it
in one transaction together with the new version number. If the upgrade cannot be
written, the learner sees the normal save warning and the start is retried. Older
backups import the same way.

## Moving from localStorage

The first start copies the original `roshana-v1` localStorage save into
IndexedDB:

1. The save is checked by `inspectStoredProgress` (below).
2. It is copied in one transaction.
3. The copy is read back and compared with the original by content.
4. Only a verified copy becomes authoritative. A copy that differs is wiped.
   The app then keeps working from the original in memory, reports that
   progress is not saved, and tries again on the next start.

The original entry is never modified or deleted. If an older release, in a tab
still open, keeps writing to it after the migration, its later reviews are
replayed into IndexedDB on the next start, once each.

## Saves that cannot be read

Before anything is loaded, a save must:

- parse;
- match the schema in `schema.ts`;
- still match it after migration.

The same rules apply to the original localStorage save, to the IndexedDB
contents and to imported backups.

A save that fails, or that a newer release wrote, is **held**. A newer release
is detected by its progress version or by its database version. While a save is
held, no operation is journaled or committed. The recovery screen offers:

- the untouched original as a download;
- the readable parts, with counts of what was kept;
- a fresh start.

Each option needs a confirmation. The learner's choice is written to
IndexedDB, and the original stays where it was.

## Failures

| Situation | What the learner sees | What happens |
|---|---|---|
| A write fails, for example quota | "Progress could not be saved", with **Export** and **Retry** | Answers stay in memory and in the journal. Retry commits them in order, once each |
| A write fails while loading or migrating | The same notice | The app works from the journal, and Retry starts again |
| No database, for example a blocked private window | "This browser is not saving progress", with **Export** | Answers are kept in the journal and are still applied after a reload; a later start with a database commits them |
| localStorage blocked, database fine | Nothing | Progress is saved. Only crash replay and the first-paint language are unavailable |

## Tests

`src/lib/learn/persistence.test.ts` runs the real controller on an in-memory
IndexedDB. It covers:

- verified migration;
- a migration whose copy differs;
- held damaged and newer saves;
- answers committed atomically;
- duplicate submissions;
- an aborted transaction replayed after a "reload";
- a journal entry left behind after a commit;
- two tabs answering concurrently;
- an interrupted import;
- undo, and an undo refused as stale;
- catch-up from an older release;
- invalid stored records;
- a newer database;
- sessions saved with answers;
- the no-database mode;
- a retry after a failed start.

`session.test.ts` covers:

- requeueing at the real relearning time;
- the waiting state;
- undo;
- quiz scoring;
- which sessions can be resumed.

Browser tests (`tests/e2e/durable-sessions.spec.ts`, `storage-recovery.spec.ts`
and `save-recovery.spec.ts`) cover:

- a reload mid-review, resuming from Today, and closing the tab right after an
  answer;
- a failed write replayed after a reload;
- undo;
- resuming a practice round;
- simulated quota failures with export and retry;
- a blocked database, in Persian;
- blocked localStorage;
- two tabs changing progress together;
- every kind of unreadable save.

## Limits

- The browser is still the only copy of progress. Clearing site data removes
  it. Backups remain the way to keep or move progress, until optional sync
  exists.
- An undo is refused rather than merged when the card changed elsewhere.
