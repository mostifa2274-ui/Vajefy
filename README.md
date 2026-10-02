# Vajefy — Roshana (روشنا)

An English-vocabulary trainer for Persian speakers, built on the Oxford 3000
and 5000 lists, with spaced repetition.

- **5,322 headwords** from A1 to C1, each with a Persian gloss, Persian-script
  pronunciation, IPA, part of speech, and an example with its translation.
- **2,950 reference notes**: phrasal verbs, collocations, prepositions, verb
  patterns, occupations, antonyms, common mix-ups, synonyms, word families,
  word formation and irregular verbs.
- **Learn + Review** (`/study`): unseen words get a deliberate encoding pass,
  then active recall; scheduled cards use recall first and grade Again / Hard /
  Good / Easy.
- **Quiz** (`/drill`): eleven practice modes, including Pairs and a 45-second
  spelling sprint. Practice is measured separately from retention evidence.
- **Offline-first PWA**: the app shell and all learning datasets are cached for
  offline study after the first successful load.
- Persian or English interface, right-to-left aware throughout, with selectable
  British or American system pronunciation.

[docs/ANALYSIS.md](docs/ANALYSIS.md) records an in-depth review of the original
code and how each finding was fixed.

## Running it

Requires Node 22.

```sh
npm ci
npm run dev        # http://localhost:8080
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server on port 8080 |
| `npm run build` | Production build for Cloudflare Workers (`dist/`) |
| `npm run preview` | Runs the built Worker locally on port 8081 |
| `npm run deploy` | Builds, then deploys with Wrangler (needs `npx wrangler login` first) |
| `npm run cf-typegen` | Generate Cloudflare binding types from Wrangler config |
| `npm run verify:workers-build` | Emulate Cloudflare's deploy-only pipeline from a clean build and run Wrangler dry-run |
| `npm run validate:data` | Validate schema, counts, Unicode, duplicates and stable ids for all learning data |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit tests in `src/lib/learn/**/*.test.ts` |
| `npx playwright test` | Critical browser, RTL/mobile and offline regression tests (CI installs the pinned runner) |

CI (`.github/workflows/ci.yml`) runs install, the 8,272-record data contract,
typecheck, lint, unit tests and the production build, then drives critical paths
in Chromium. It runs on pull requests and pushes to `main`.

## How it works

The app is fully client-side: no accounts, no database, no AI service.

| Path | Contents |
|---|---|
| `src/routes/` | One file per screen: Today, Words, Review, Quiz, Notebook, Progress |
| `src/components/` | Shell, review session, quiz runner, Pairs, sprint |
| `src/lib/learn/srs.ts` | The scheduler (SM-2 style, with learning steps) |
| `src/lib/learn/store.ts` | Progress state (zustand, persisted to `localStorage` as `roshana-v1`) |
| `src/lib/learn/quiz.ts` | Question generation for every quiz mode |
| `src/lib/learn/backup.ts` | Export and import of progress files |
| `public/data/*.json` | The dataset, fetched by the browser on demand |
| `attachments/*.xlsx` | The spreadsheet the dataset was converted from |

### Scheduling rules

- Only **Review** moves a card's schedule. Intervals grow from the time that
  actually passed since the card was last graded, so answering early never
  inflates them.
- **Quiz, Pairs and the sprint are practice.** They never add a word to the
  schedule or push a review later. A miss on a scheduled word makes it due now,
  so the next Review asks it properly.
- Scheduled Review and practice keep **separate counters and accuracy**. Practice
  cannot satisfy the daily review target or inflate measured retention.
- Scheduled recall also writes a bounded, timestamped **review-evidence log**
  (grade, elapsed/scheduled interval, before/after state). History starts
  prospectively: cards reviewed before this feature are explicitly marked
  partial instead of receiving invented past events. This creates a safe data
  foundation for future memory-model/FSRS evaluation.
- A completely unseen word gets a short **teach → hide → recall → grade** flow
  before it joins normal spaced review.

### Progress and backups

Progress is local-first. The app asks supporting browsers for persistent
storage, and **Progress → Backup** exports a dated JSON file that can be restored
on another device. The saved shape is versioned (`PROGRESS_VERSION` in
`store.ts`) and migrations preserve older saves. There is intentionally no
account or remote learner database yet.

### Data notes

- Card ids are persistent learner-data keys. `npm run validate:data` hashes
  each dataset's id set, so accidental renames or deletions fail CI. If an id
  must change intentionally, plan a progress migration and update the contract.
- Headwords follow the Oxford lists' British spelling. Spelling modes also
  accept the American form for the words listed in `AMERICAN` in `text.ts`.

## Deploying to Cloudflare

The app runs on Cloudflare Workers: the Worker renders pages, and everything in
`public/` plus the built scripts is served as static assets. `wrangler.jsonc`
configures the Worker, and `@cloudflare/vite-plugin` builds it.

With the repository connected to Cloudflare Workers Builds, the recommended
dashboard settings are:

- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`
- **Preview command:** `npx wrangler preview`

The Cloudflare Vite plugin writes the deployment-ready Wrangler configuration
during `vite build`; `wrangler deploy` then discovers that generated output.
The checked-in `wrangler.jsonc` remains the source configuration and points at
`src/server.ts`, where response hardening is applied.

For existing Workers Builds connections whose Build command is still blank,
`postinstall` runs `scripts/cloudflare-ci-bootstrap.mjs` only when Cloudflare's
documented `WORKERS_CI=1` environment variable is present. That generates the
same Vite output before the dashboard's existing deploy-only
`npx wrangler deploy` command. Normal local and GitHub installs skip the
bootstrap. CI also runs `npm run verify:workers-build`, which starts from a
clean build directory and proves the deploy-only Wrangler command can consume
the generated configuration without Cloudflare credentials.

`.node-version` pins Node 22 for Cloudflare's build image. For manual
deployment, `npm run deploy` performs the build before invoking Wrangler.

- The Worker's name in the dashboard must match `name` in `wrangler.jsonc`
  (`vajefy`); otherwise Cloudflare refuses to deploy. Change one of them if
  they differ.
- Under **Build → Variables and secrets**, set `VITE_SITE_URL` to the site's
  address (for example `https://vajefy.<account>.workers.dev` or a custom
  domain) so share cards get an absolute image URL. It is read at build time.


## Privacy and offline behavior

The production app makes no application API or AI-service request. Fonts use
system stacks, so the core UI, vocabulary data and pronunciation do not depend
on Google Fonts or another web-font host. Browser speech synthesis is local to
the user's device; available voice quality depends on the operating system.

The service worker is deliberately limited to same-origin GET requests. Learning
data and hashed assets are cached; navigations prefer the network and fall back
to the cached app when offline. The production build fingerprints every deployed
client/data file into the service-worker cache version, so a data-only release
also activates a fresh cache instead of leaving installed learners on stale
vocabulary.

## Content provenance

See [docs/CONTENT_PROVENANCE.md](docs/CONTENT_PROVENANCE.md). Code/data integrity
checks establish what ships; they do not establish third-party redistribution
rights.
