# Progress saving and recovery

Progress remains in the existing `roshana-v1` localStorage entry and uses schema
v4. This release changes neither vocabulary IDs nor the learning evidence shape.
FSRS cards, real review history and optional-practice evidence retain their
existing scheduling and backup rules.

## Checking the save before it loads

The saved copy is checked before the app uses it or writes anything. It must
parse, carry a version, match the saved-progress schema in
`src/lib/learn/schema.ts`, and still match it after migration. Older versions
migrate as before. The same checks apply to imported backups.

A save that fails, or that was written by a newer version, is **held**: the app
starts with a placeholder state, and every write to `roshana-v1` is refused.
This covers hydration, the hydrated flag, answers and settings. Before this
change, an unreadable save was replaced with empty progress during startup, an
invalid one was written back unchanged, and a newer one was downgraded to v4
with its unknown fields dropped.

While a save is held, a recovery screen replaces every page:

- **Download the saved copy** saves the stored text byte for byte as
  `roshana-saved-copy-YYYY-MM-DD.json`, even when it is not valid JSON.
- **Readable progress** lists how many words and review records are intact.
  Each card, review record, day log, bookmark and drill observation is checked
  on its own. Any other detail that is unreadable falls back to a new learner's
  default and is counted. Nothing is invented. A learner whose cards survive
  stays onboarded. Continuing replaces the saved copy only after an inline
  confirmation that names what will be lost.
- **Start over** replaces the saved copy with empty progress, keeping only the
  interface language, after its own confirmation.
- A newer save also offers **Reload to update**, which asks the service worker
  to update first. The readable-progress option stays available as an escape
  hatch after a rollback. Its warning says that details only the newer version
  understands will be lost.

Releasing the hold still uses the conflict check below, so a copy another tab
changed in the meantime is not replaced. A tab that later reads a valid copy,
for example after another tab recovered, drops the hold by itself.

Importing a backup from a newer version gives its own message, which asks the
learner to update and import again, instead of the generic damaged-file error.

## Failed saves

Quota exhaustion, denied storage reads/writes and a denied `window.localStorage`
getter are caught. The latest session state stays in memory. Rehydration cannot
prefer an older durable copy over newer failed writes. A global Persian/English
warning explains that unsaved changes can be lost on closing or reloading.

The warning offers a backup download from the live progress store and an explicit
retry. Every retry checks the durable copy before writing. The warning disappears
only after a successful write of the latest state. A failed retry leaves it
visible. A later successful ordinary save also clears the warning.

Save status is transient and separate from the progress document. It cannot
cause recursive progress writes, and it is not included in exports. Server
rendering never claims that learner progress has been saved in a browser.

## Another saved copy

Normal cross-tab updates continue to rehydrate. A tab with unsaved changes keeps
its own session. If the durable copy differs from the last one that tab read or
saved, further writes stop and a conflict notice appears. This also checks for
changes before a queued storage event arrives. If the first read was blocked,
an existing copy discovered later is protected rather than blindly replaced.

The learner can export the current session, then choose **Load saved copy**.
An inline confirmation states that unsaved session changes will be discarded.
Confirming reloads the page to load the durable copy. Cancellation keeps both
copies intact. There is no automatic merge of review counts or FSRS history,
which would risk inventing or duplicating learning evidence.

## Verification and limits

Unit tests cover stale durable reads after failed writes, retries, failed deletes,
denied access and reads, SSR, healthy cross-tab updates and conflicting copies.
They also drive the real store through hydration with unreadable, invalid and
newer saves. Those tests assert that no byte is written until release, and they
fail if the hold is removed. They also cover recovery of every record type and
the migration of older saves through the same checks. Browser tests seed each
kind of bad save. They check that it survives navigation and reload, that the
downloaded copy is identical, that confirmation is required, and that each
recovery screen passes WCAG A/AA with no horizontal overflow.

Browser tests also submit a real Smart Practice answer under quota failure, download
its unsaved evidence, retry and reload; exercise Persian mobile recovery when
the storage getter throws; and protect two conflicting tabs through export,
cancellation and explicit recovery. Both warning languages receive WCAG A/AA
and horizontal-overflow checks.

The browser remains the only progress database. Memory fallback does not survive
a closed tab. localStorage has no transactional compare-and-swap across tabs, so
this check does not promise atomic synchronization of simultaneous writes.
IndexedDB with transaction-based persistence and optional account synchronization
remain separate work. Backups are still recommended for transferring or retaining
progress outside this browser.
