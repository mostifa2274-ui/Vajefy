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
- the coach and sync status endpoints answer.

`.github/workflows/smoke.yml` runs it every six hours and on demand once the
repository variable `SITE_URL` is set. A failure there after a deployment is a
regression to roll back in Cloudflare's **Deployments** tab.

## Pronunciation audio in R2

Clips ship as static assets (8.5 MB today). If the library grows past what
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
