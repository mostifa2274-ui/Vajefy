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

The app was first built in Grok App Builder and imported here unchanged
(commit `f382981`). [docs/ANALYSIS.md](docs/ANALYSIS.md) has the analysis of that
export and how each finding was fixed.

## Running it

Requires Node 22.

```sh
npm ci
npm run dev        # http://localhost:8080
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server on port 8080 |
| `npm run build` | Production build for Vercel (`.vercel/output`); runs migrations only when `DATABASE_URL` is set |
| `npm run preview` | Serves the production build on `127.0.0.1:8081` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Template tests plus the app tests (`npm run test:app` runs only `src/lib/learn/**/*.test.ts`) |

CI (`.github/workflows/ci.yml`) runs install, typecheck, lint, tests and build
on pull requests and on pushes to `main`.

## How it works

| Path | Contents |
|---|---|
| `src/routes/` | One file per screen: Today, Words, Review, Quiz, Notebook, Progress |
| `src/components/` | Shell, review session, quiz runner, Pairs, sprint, notes button |
| `src/lib/learn/srs.ts` | The scheduler (SM-2 style, with learning steps) |
| `src/lib/learn/store.ts` | Progress state (zustand, persisted to `localStorage` as `roshana-v1`) |
| `src/lib/learn/quiz.ts` | Question generation for every quiz mode |
| `src/lib/learn/backup.ts` | Export and import of progress files |
| `src/lib/learn/coach*.ts` | The optional AI usage notes |
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

### AI usage notes (optional)

With `XAI_API_KEY` set on the server, the **A note** button asks Grok for a
three-sentence usage note. The client sends only an entry id; the server builds
the prompt from the dataset, caches answers, and caps upstream calls at 20 per
client per 10 minutes and 600 per server instance per hour. Without the key,
the button is hidden.

## Deploying

The build targets Vercel through Nitro's `vercel` preset; `vercel.json` sets
the install command. Set `XAI_API_KEY` in the project's environment variables to
enable notes. No database is needed.

## Grok App Builder files

`AGENTS.md`, `.grok/`, `public/__grok/`, `server/` and `scripts/grok-pwa-*`
belong to the Grok App Builder template (agent instructions, the PWA install
page, branding injection, preview tooling). They are kept so the project still
runs in Grok; leave them in place unless you are moving off that platform.
