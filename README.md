# Vajefy — Roshana (روشنا)

An English-vocabulary trainer for Persian speakers, built on the Oxford 3000
and 5000 lists, with spaced repetition.

- **5,322 headwords** from A1 to C1, each with a Persian gloss, Persian-script
  pronunciation, IPA, part of speech, and an example with its translation.
- **2,950 reference notes**: phrasal verbs, collocations, prepositions, verb
  patterns, occupations, antonyms, common mix-ups, synonyms, word families,
  word formation and irregular verbs.
- **Review** (`/study`): recall first, then grade Again / Hard / Good / Easy.
- **Quiz** (`/drill`): eleven practice modes, including Pairs and a 45-second
  spelling sprint.
- Persian or English interface, right-to-left aware throughout.

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
| `npm run deploy` | Builds and deploys with Wrangler (needs `npx wrangler login` first) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit tests in `src/lib/learn/**/*.test.ts` |

CI (`.github/workflows/ci.yml`) runs install, typecheck, lint, tests and build
on pull requests and on pushes to `main`.

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
- **Quiz, Pairs and the sprint are practice.** They log activity but never add
  a word to the schedule or push a review later. A miss on a scheduled word
  makes it due now, so the next Review asks it properly.

### Progress and backups

Progress is stored only in the browser. **Progress → Backup** exports a dated
JSON file and imports it again, on this device or another. The saved shape is
versioned (`PROGRESS_VERSION` in `store.ts`); when it changes, bump the version
and extend `migrateProgress`.

### Data notes

- Card ids are slugs of the headword text (`lex:A1:about`). If you edit a
  headword in the data, **keep its `id`**, or saved progress for it is lost.
- Headwords follow the Oxford lists' British spelling. Spelling modes also
  accept the American form for the words listed in `AMERICAN` in `text.ts`.

## Deploying to Cloudflare

The app runs on Cloudflare Workers: the Worker renders pages, and everything in
`public/` plus the built scripts is served as static assets. `wrangler.jsonc`
configures the Worker, and `@cloudflare/vite-plugin` builds it.

With the repository connected to Cloudflare (Workers Builds), every push to the
production branch deploys, and other branches get preview versions. Cloudflare's
default settings work as they are: `wrangler.jsonc` has a `build.command`, so
`npx wrangler deploy` (production) and `npx wrangler preview` (other branches)
build the app before uploading it. `wrangler preview` also requires the
`previews` block, which is empty so previews use the production settings. Setting the dashboard's build command to
`npm run build` also works and does not build twice. `.node-version` pins
Node 22 for Cloudflare's build image.

- The Worker's name in the dashboard must match `name` in `wrangler.jsonc`
  (`vajefy`); otherwise Cloudflare refuses to deploy. Change one of them if
  they differ.
- Under **Build → Variables and secrets**, set `VITE_SITE_URL` to the site's
  address (for example `https://vajefy.<account>.workers.dev` or a custom
  domain) so share cards get an absolute image URL. It is read at build time.
