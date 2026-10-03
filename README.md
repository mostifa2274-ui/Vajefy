# Vajefy

An English-vocabulary trainer for Persian speakers, built on the Oxford 3000
and 5000 lists, with spaced repetition. It is organised around four
destinations: **Today** (the next step), **Learn** (lessons, review and
practice), **Words** (search, saved entries and reference) and **Progress**
(retention, skills, workload and settings). See
[docs/INTERFACE.md](docs/INTERFACE.md).

- **5,322 headwords** from A1 to C1, each with a Persian gloss, Persian-script
  pronunciation, IPA, part of speech, and an example with its translation.
- **2,950 reference notes**: phrasal verbs, collocations, prepositions, verb
  patterns, occupations, antonyms, common mix-ups, synonyms, word families,
  word formation and irregular verbs.
- **Guided lessons** (`/learn`) for a 150-entry A1 pilot taught sense by sense:
  teach → hear → recall the meaning → feedback → use it in a new sentence →
  delayed recall, which becomes the word's first scheduled review. Comparison
  lessons (say/tell, bring/take …) and short scenes reuse what was learned.
- **Recorded pronunciation** in British and American English for every pilot
  word and example, downloadable for offline use, with browser speech only as a
  fallback.
- **Review** (`/study`): scheduled cards use recall first and grade Again / Hard /
  Good / Easy; sessions resume where they stopped, and a grade can be undone.
- **One-screen setup**: a learning goal, a starting level (with an optional
  two-minute placement check) and 5, 10 or 15 minutes a day, which set the daily
  plan.
- **Practice** (`/drill`): eleven practice modes, including Pairs and a 45-second
  spelling sprint, plus **Smart Practice**. Smart Practice selects studied words
  using FSRS memory estimates and real skill mistakes, then mixes spelling,
  listening, meaning and context. Practice is measured separately from retention.
- **Offline-first PWA**: the app shell and all learning datasets are cached for
  offline study after the first successful load.
- Persian or English interface, right-to-left aware throughout, with selectable
  British or American pronunciation.
- **Built to be evaluated**: answers record their evidence, a 30-day check-up
  measures what was retained, learners can export their data for the pilot
  study, and an analysis compares the active scheduler with personalised FSRS-6
  and FSRS-7 ([docs/EVALUATION.md](docs/EVALUATION.md)).
- **Speaking practice**: record yourself and compare with the model, on the
  device only.
- **An AI coach, behind its gate**: grounded answers about sentences, fit and
  differences, off until configured and evaluated ([docs/COACH.md](docs/COACH.md)).
- **Optional sync between devices**, end-to-end encrypted with a code only the
  learner has, and no account ([docs/SYNC.md](docs/SYNC.md)). Operational
  monitoring and the optional services are in
  [docs/OPERATIONS.md](docs/OPERATIONS.md).
- **Accessible and fast on phones**: tested against WCAG 2.2 AA
  ([docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md)) and Core Web Vitals budgets on
  a throttled phone ([docs/PERFORMANCE.md](docs/PERFORMANCE.md)).

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
| `npm run validate:data` | Validate schema, counts, Unicode, duplicates and stable ids for all learning data; that the plans, compiled content and reviewed notes are current; and the catalogue audit |
| `npm run content:build` | Compile the enhanced content in `content/pilot/` into `public/data/enhanced.json` |
| `npm run content:approve` | Record a bilingual or pronunciation review of an entry ([docs/PILOT_CONTENT.md](docs/PILOT_CONTENT.md)) |
| `npm run content:status` | Editorial progress across the levels, or one level's batches, and what to draft next |
| `npm run content:lint` | Authoring checks: level of vocabulary, reused examples, ambiguous items |
| `npm run content:scaffold` / `content:drafts` / `content:promote` | Start, check and finish drafts for a level's next batch ([docs/CATALOGUE.md](docs/CATALOGUE.md)) |
| `npm run content:notes` | Review status of the reference notes; record a review |
| `npm run content:audit` | The catalogue audit over every entry and reference note |
| `npm run coach:cases` / `coach:eval` | Build the coach's evaluation set; run its release gate against a model |
| `node scripts/smoke.mjs <url>` | Check a deployed site ([docs/OPERATIONS.md](docs/OPERATIONS.md)) |
| `npm run evaluate` | Analyse pilot-study exports: scheduler comparison and the 30-day measure ([docs/EVALUATION.md](docs/EVALUATION.md)) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit tests in `src/lib/learn/**` and `src/api/**` |
| `npx playwright test` | Critical browser, RTL/mobile, offline, accessibility and performance-budget tests (CI installs the pinned runner) |

CI (`.github/workflows/ci.yml`) runs install, the 8,272-record data contract,
typecheck, lint, unit tests and the production build, then drives critical paths
in Chromium. It runs on pull requests and pushes to `main`.

## How it works

The app is fully client-side: no accounts, no server database, no AI service.

| Path | Contents |
|---|---|
| `src/routes/` | One file per screen: Today, Lessons, Review, Practice, Lexicon, Reference, Progress |
| `src/components/` | Shell, section tabs, setup, guided lesson, review session, practice runner, Pairs, sprint |
| `src/components/feedback.tsx` | Shared answer feedback, progress meter and right/wrong markers |
| `src/lib/sections.ts`, `src/lib/focus.ts` | Which destination a screen belongs to; keeping focus in the task |
| `src/lib/learn/srs.ts` | FSRS-6 scheduler, legacy SM-2 bridge, retrievability |
| `src/lib/learn/store.ts` | Progress state (zustand) whose actions dispatch operations |
| `src/lib/learn/ops.ts` | Every progress change as a pure, deduplicated operation |
| `src/lib/learn/db.ts` | IndexedDB stores and one transaction per operation |
| `src/lib/learn/persistence.ts` | Migration, journal replay, cross-tab updates, failures and recovery |
| `src/lib/learn/journal.ts` | Write-ahead journal that replays interrupted answers once |
| `src/lib/learn/session.ts` | Resumable review and practice sessions |
| `src/lib/learn/progress.ts` | Saved-progress shape, defaults and version migrations |
| `src/lib/learn/schema.ts` | Validation shared by browser saves and backup files |
| `src/lib/learn/recovery.ts` | Startup checks of saved progress and recovery of readable parts |
| `src/lib/learn/quiz.ts` | Question generation for every quiz mode |
| `src/lib/learn/adaptive.ts` | FSRS-aware Smart Practice selection and skill targeting |
| `src/lib/learn/practice.ts` | Bounded prospective vocabulary skill evidence |
| `src/lib/learn/backup.ts` | Export and import of progress files |
| `src/lib/learn/content.ts` | Schema of the sense-level pilot content |
| `src/lib/learn/pilot.ts` | Loading the compiled pilot, introduction order by goal, study cards |
| `src/lib/learn/lesson.ts` | Guided lesson steps, grading, retries and resume |
| `src/lib/learn/speech.ts` | The single playback controller: recorded clips first, browser speech as fallback |
| `src/lib/learn/audio-pack.ts` | Downloading and removing offline pronunciation |
| `src/lib/learn/placement.ts` | The optional placement check at setup |
| `src/lib/learn/measures.ts` | Learning measures from recorded evidence |
| `content/pilot/` | Pilot source content, review ledger and audio manifest |
| `scripts/audio/` | Pronunciation generation ([docs/AUDIO.md](docs/AUDIO.md)) |
| `public/data/*.json` | The dataset, fetched by the browser on demand |
| `attachments/*.xlsx` | The spreadsheet the dataset was converted from |

### Scheduling rules

- New cards use **FSRS-6** with the official default 21-parameter model and
  short learning/relearning steps. The learner can choose an 85%, 90% or 95%
  target retention; 90% is the default.
- Existing pre-FSRS review cards keep their saved due date. On the next real
  review, their existing SM-2 ease/interval pair is converted to an FSRS memory
  state with the official FSRS-6 SM-2 bridge formula. No historical reviews are
  invented. Legacy cards already inside a short learning step finish that step
  unchanged before they can migrate.
- Every scheduled answer from this version forward appends a compact real review
  event (rating, actual elapsed time, next interval, and FSRS memory state where
  available). The history is capped to protect browser storage and can later be
  used for evidence-based parameter tuning.
- Only **Review** moves a card's schedule. **Practice, Pairs and the sprint are
  practice**: they never push a review later. A miss on a scheduled word makes
  it due now, so the next Review asks it properly.
- Scheduled Review and practice keep **separate counters and accuracy**. Practice
  cannot satisfy the daily review target or inflate measured retention.
- A completely unseen word gets a short **teach → hide → recall → grade** flow
  before it joins normal spaced review. Pilot words are introduced through
  guided lessons instead, and Review does not offer them as new cards while the
  pilot still has words to teach.
- New words come in order of usefulness: how often the headword appears across
  the dataset's example sentences (`public/data/usefulness.json`), and for the
  pilot, the learner's goal. Fewer new words are offered when many reviews are
  due.

### Progress and backups

Progress is local-first. The app asks supporting browsers for persistent
storage, and **Progress → Backup** exports a dated JSON file that can be restored
on another device. The saved shape is versioned (`PROGRESS_VERSION` in
`progress.ts`) and migrations preserve older saves. Version 3 adds the FSRS
memory state, target retention and prospective review evidence while preserving
older due dates. Version 4 adds per-word drill skills without reconstructing
past attempts or changing due dates. Version 5 adds the learning goal and daily
minutes. There is intentionally no account. Where a deployment turns sync on,
learners can pair devices with a code; the server stores only encrypted
operations it cannot read ([docs/SYNC.md](docs/SYNC.md)).

Progress is stored in IndexedDB. Each answer is saved in one transaction with
its progress update and the session state, and has a unique id, so a retry,
replay or second tab can never count it twice. Leaving midway and returning
resumes the same session. Missed cards come back at their real relearning
time, and an accidental grade can be undone.

A small journal replays answers interrupted by a closed tab. If saving fails, a
warning offers **Export progress** and **Retry saving**. A save that cannot be
read, or that a newer version wrote, is never replaced automatically: a
recovery screen offers the untouched original as a download, the readable
parts, or a fresh start. The original localStorage save is copied once and
verified before IndexedDB takes over. See
[docs/PROGRESS_STORAGE.md](docs/PROGRESS_STORAGE.md).

### Smart Practice

Today → **Smart Practice** opens a short optional session across studied levels.
It prioritizes fragile words and observed spelling, listening, meaning or context
mistakes. Words in learning/relearning, due within six hours, or practised within
the past 30 minutes remain outside this session. These are explicit product
guardrails, not a fitted forgetting model.

A correct practice answer preserves the exact FSRS state and due date. A miss
uses the existing due-now policy so Review can schedule it. If audio cannot be
heard, **Skip listening** records no answer, XP, skill observation or review.
Skill observations survive reload and JSON backup/restore; older saves start
with empty skill evidence. See [docs/SMART_PRACTICE.md](docs/SMART_PRACTICE.md).

### Data notes

- Card ids are persistent learner-data keys. `npm run validate:data` hashes
  each dataset's id set, so accidental renames or deletions fail CI. If an id
  must change intentionally, plan a progress migration and update the contract.
- Headwords follow the Oxford lists' British spelling. Spelling modes also
  accept the American form for the words listed in `AMERICAN` in `text.ts`.
- The whole catalogue is improved with the process the A1 pilot validated:
  plans per level, drafting, authoring checks, bilingual review and release.
  Reference notes have their own review ledger, and a catalogue audit in CI
  keeps fixed problems fixed ([docs/CATALOGUE.md](docs/CATALOGUE.md)).

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
- For a public release, also set `VITE_CONTENT_CHANNEL=released`, so learners
  meet only enhanced entries whose reviews are approved. Without it, every
  enhanced entry is taught, unreviewed ones labelled as drafts
  ([docs/PILOT_CONTENT.md](docs/PILOT_CONTENT.md#releasing-at-the-pace-of-review)).


## Privacy and offline behavior

The production app makes no application API or AI-service request unless the
optional coach or sync is configured ([docs/OPERATIONS.md](docs/OPERATIONS.md)).
The coach sends a learner's sentence to an AI service only after they confirm.
Sync uploads progress only after the learner turns it on, encrypted on the
device with a key the server never receives; the server can see how many
changes arrive and when, not what they are ([docs/SYNC.md](docs/SYNC.md#what-the-server-can-see)). Fonts use
system stacks, so the core UI and vocabulary data do not depend on Google Fonts
or another web-font host. Pilot pronunciation is recorded audio served by the app
itself. For other words, the browser's speech synthesis is used; depending on
the browser and voice, it may run on the device or send the text to the browser
vendor's speech service.

Speaking practice records with the microphone only when the learner presses
Record. The recording stays in the page's memory and is never uploaded or saved
([docs/AUDIO.md](docs/AUDIO.md#speaking-practice)).

The service worker is deliberately limited to same-origin GET requests. Learning
data and hashed assets are cached; navigations prefer the network and fall back
to the cached app when offline. Pronunciation clips have their own cache that
survives updates, and Progress offers a download of every clip for one accent. The production build fingerprints every deployed
client/data file into the service-worker cache version, so a data-only release
also activates a fresh cache instead of leaving installed learners on stale
vocabulary.

## Content provenance

See [docs/CONTENT_PROVENANCE.md](docs/CONTENT_PROVENANCE.md). Code/data integrity
checks establish what ships; they do not establish third-party redistribution
rights. Enhanced teaching content is shown as a draft until a bilingual
reviewer approves it ([docs/PILOT_CONTENT.md](docs/PILOT_CONTENT.md)), and a
reference note is marked as reviewed once one has ([docs/CATALOGUE.md](docs/CATALOGUE.md)).
