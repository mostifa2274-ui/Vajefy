# Progress saving and recovery

Progress remains in the existing `roshana-v1` localStorage entry and uses schema
v4. This release changes neither vocabulary IDs nor the learning evidence shape.
FSRS cards, real review history and optional-practice evidence retain their
existing scheduling and backup rules.

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
Browser tests submit a real Smart Practice answer under quota failure, download
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
