# Operations

Vajefy runs on Cloudflare Workers. The core app needs no configuration. Each
optional service below is off until it is configured, and the app works fully
offline without any of them.

## Configuration

| Setting | Kind | Effect |
|---|---|---|
| `VITE_SITE_URL` | build variable | Absolute URLs for share cards |
| `VITE_CONTENT_CHANNEL` | build variable | `draft` (default), `released` or `none` ([PILOT_CONTENT.md](PILOT_CONTENT.md#releasing-at-the-pace-of-review)) |
| `VITE_TELEMETRY` | build variable | `on` to send operational error reports |
| `TELEMETRY` | Worker variable | `on` to log received reports |
| `AUDIO` | R2 binding | Serve pronunciation clips from R2 |
| `ANTHROPIC_API_KEY`, `COACH`, `COACH_MODEL`, `COACH_LIMITER` | secret, variables, rate-limit binding | The AI coach ([COACH.md](COACH.md#turning-it-on)) |
| `SYNC_DB`, `SYNC`, `SYNC_LIMITER` | D1 binding, variable, optional rate-limit binding | Optional sync ([SYNC.md](SYNC.md#turning-it-on)) |

Build variables are read when the app is built, under **Workers Builds →
Variables**. Worker variables, secrets and bindings are set under **Workers →
Settings** or in `wrangler.jsonc`.

## Monitoring

### Error reports

With `VITE_TELEMETRY=on` at build time and `TELEMETRY=on` on the Worker,
learners' devices report operational failures:

| Kind | When |
|---|---|
| `save-failed` | Progress could not be written; answers are kept in the session |
| `storage-unavailable` | The browser offers no database |
| `import-failed` | A backup file was refused (`bad` or `future`) |
| `audio-failed` | A clip or speech could not play (`clip` or `speech`) |
| `exercise-broken` | A lesson step whose content is missing (its id) |
| `sync-failed` | Sync failed (`error`), or another device runs a newer version (`update`) |
| `crash` | An uncaught error or a page error (the error's type only) |

A report holds the kind, a short code, the screen (`/learn`, never ids or query
strings) and the deployment's commit. It never holds what the learner did or
wrote, an address, or any identifier. Each kind and code is sent once per page
load, at most twenty in all. The Worker validates reports and writes them to
**Workers Logs** as `{"telemetry": {...}}` lines (observability is on in
`wrangler.jsonc`), where they can be counted by kind, code and commit.

Turning reports on changes what the app sends, so update the privacy notice in
the README when you do.

### Deployment checks

`node scripts/smoke.mjs <site URL>` checks the live site:

- every screen renders with its security headers;
- the learning data and a pronunciation clip load;
- the service worker and manifest are served;
- the coach and sync status endpoints answer;
- `/api/version` reports the deployed revision (the first 12 characters of the
  commit Cloudflare built) and the content channel. With `--expect-channel` or
  `--expect-revision` (or `SMOKE_EXPECT_CHANNEL` / `SMOKE_EXPECT_REVISION`),
  the check fails when the live site differs.

`.github/workflows/smoke.yml` runs it every six hours and on demand once the
repository variable `SITE_URL` is set. Set the repository variable
`CONTENT_CHANNEL` to the channel production must serve (`released` for a public
A1 release) and the workflow also fails when the live build uses another one. A failure there after a deployment is a
regression to roll back ([Rolling back](#rolling-back)).

### Rolling back

Rollback is rehearsed on every pull request and every push to `main`, by
`.github/workflows/rollback-rehearsal.yml` (plan §22). It runs
`npm run rollback:rehearse -- --previous <ref>`, which works like this:

1. It builds the previous release (by default the first parent: `main` before
   the change) in a git worktree under `.rollback/`, and builds the current
   checkout next to it. Each build reports its own commit, as Workers Builds
   does.
2. It serves both with the Workers preview, behind one origin.
3. A browser test (`tests/rollback/rollback.spec.ts`) studies on the current
   release, then switches the origin to the previous release and back again.
   At each step it checks:
   - `/api/version` reports that release's revision and content channel;
   - an open tab keeps its complete offline release while the other one
     installs;
   - once the tabs close, the newly deployed release serves the app offline
     too;
   - the learner's answers are all there, each recorded once, and studying
     continues on either release;
   - if a rollback ever crosses a progress-format change, the older release
     holds the newer save unchanged and offers it as a download. The learner
     is never stranded and the save is never overwritten.

To roll production back:

1. In Cloudflare, open **Workers → vajefy → Deployments** and roll back to the
   last good version.
2. Run **Production smoke checks** by hand with `expect_revision` set to that
   version's commit (its first 12 characters). The check fails unless
   `/api/version` reports it, every screen renders and the content channel is
   the expected one.
3. Learners' open tabs keep the release they have. Each device moves to the
   rolled-back release once its tabs close, and its progress stays (see the
   rehearsal above).

The production half (steps 1 and 2) needs `SITE_URL` and a live deployment.
It has not been exercised yet.

### Offline release updates

The service worker treats the application shell, every primary route, their
referenced bundles, the generated client assets and the listed learning-data
files as one required offline release. If any required response is missing or
non-successful, installation fails, the incomplete cache is removed and the
last complete release stays active. A completion marker is written only after
the graph is cached successfully. The release identity includes both deployed
client/public files and the service-worker template, so a worker-only safety
fix cannot accidentally reuse and delete the active cache.

The worker never calls `skipWaiting()`. Its first complete release claims
already-open uncontrolled pages so they can use the offline cache without a
manual reload. A completed update waits until tabs controlled by the previous
release have closed or navigated away, then activates through the normal
lifecycle without claiming over them. Activation ignores and removes
interrupted caches, retains the most recent earlier cache carrying a valid
completion marker, and never deletes the long-lived pronunciation cache or
unrelated origin caches. Old hashed assets can fall back to that retained
complete release when the network no longer has them. Runtime navigation never
overwrites the validated offline documents.

The listed learning data is the A1 course only: `meta.json`, `lex-a1.json`,
the enhanced-content index, order and audio-pack manifest, and
`usefulness.json`. Higher-level lexicons and the reference decks are not
installed. Each is cached in the current release the first time it is fetched,
and offline it falls back to the retained earlier release.

Pronunciation audio is separate from the required application release. A clip
is available offline only when it has already played successfully or when the
audio-pack downloader reports every clip cached. Merely loading the audio-pack
manifest does not mean its clips are offline.

## Pronunciation audio in R2

Clips ship as static assets (50.2 MB today). If the library grows past what
static assets should hold, move it to R2:

1. Create a bucket, upload `public/audio/pilot/` to the key prefix `pilot/`,
   and bind the bucket as `AUDIO`.
2. Remove the clips from `public/audio/`.

Requests for clips that are no longer static assets then reach the Worker,
which serves them from R2 with the same names and year-long immutable caching
(`src/api/audio.ts`). The app, the service worker's offline packs and the
content build need no change, because clip URLs stay the same. R2's Standard
tier has free egress; costs come from stored bytes and operations.

## Costs

The core app's costs are those of a Workers deployment with static assets.
Audio is generated once, offline. The coach is bounded by its rate limit,
caching and output cap ([COACH.md](COACH.md#learner-text-and-costs)), and sync
stores only small encrypted records ([SYNC.md](SYNC.md)).
