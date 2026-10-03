# Performance

## Targets

The Core Web Vitals thresholds, at the 75th percentile of real visits once
there is enough field data:

| Measure | Target |
|---|---|
| Largest Contentful Paint (LCP) | ≤ 2.5 s |
| Interaction to Next Paint (INP) | ≤ 200 ms |
| Cumulative Layout Shift (CLS) | ≤ 0.1 |

## Lab budgets

`tests/e2e/performance.spec.ts` enforces the same thresholds on every run, on a
throttled mid-range phone:

- 390 × 844 px viewport;
- Slow 4G: 1.6 Mbit/s down, 750 kbit/s up, 150 ms latency;
- a CPU four times slower than the test machine.

The local Worker preview serves files uncompressed, while Cloudflare compresses
them. The test therefore runs through a small gzip proxy
(`tests/e2e/support/compressing-proxy.ts`), so transfer times match production.
These tests form their own Playwright project, `performance`, which starts only
after every other browser test has finished, so nothing else competes for the
CPU while they measure.

| Scenario | Checks |
|---|---|
| A new learner's first visit, empty cache | LCP, CLS |
| A returning learner's Today and Review, app installed | LCP, CLS |
| Learn and Words on a first visit | LCP, CLS |
| Answering in a lesson; typing a Words search | INP, CLS |

Measured on the development container when the budgets were set (single runs,
first visit unless stated):

| Scenario | LCP | CLS | INP |
|---|---|---|---|
| New learner, Today (onboarding) | 2.24 s | 0.05 | |
| Returning learner, Today | 1.44 s | 0 | |
| Returning learner, Review | 0.82 s | 0 | |
| Learn | 0.6–0.9 s | 0 | |
| Words | 0.7–0.9 s | 0.02 | |
| Lesson answers | | 0 | 32–120 ms |
| Words search typing | | 0.02 | ≤ 104 ms |

A learner whose progress is still in the original localStorage save, on the
very first visit after updating, waits for a one-time copy into IndexedDB. Today
then reaches LCP in about 2.2–2.6 s under this profile. Later visits are served
from the installed app.

Lab numbers vary with the machine. If CI hardware turns out slower, the profile
is adjusted, not the thresholds.

## What keeps the numbers down

- **Server rendering** draws headings and page structure before any script runs.
- **No layout shift by design.** Today holds a placeholder card until progress,
  levels and the lesson order are all loaded, then draws once. The daily cards
  and everything below them appear together, in space held for them. Learn
  draws its heading at once and its lesson card in place when ready.
- **Small first data.** Today counts upcoming lesson words from
  `enhanced-order.json` (about 1 KB compressed), not the 125 KB pilot, and preloads
  it with `meta.json`.
- **No blocking requests in `<head>`.** The script that applies the saved
  language before the first paint is inline, carrying the page's CSP nonce.
- **Route code is split.** Each screen loads its own chunk; the service worker
  then caches all of them for offline use.
- **Audio is fetched on demand** and cached separately, never on page load.
- **System fonts.** No web fonts to download.

## Field measurement

Real-user measurement is not enabled. It needs a decision about collecting
data, because the app currently sends nothing about its use anywhere.
Two options for Phase 6, when operational monitoring is added:

1. **Cloudflare Web Analytics**: Core Web Vitals per page at the 75th
   percentile, with no cookies. Its beacon script and endpoint would have to be
   added to the Content Security Policy in `src/server.ts`.
2. **A first-party endpoint on the Worker** receiving `web-vitals` reports.
   It keeps all data in the project's own Cloudflare account.

Until then, the lab budgets above are the release gate.
