# Roshana (روشنا) — in-depth analysis

The app was called Roshana when this analysis was written; it is now Vajefy.

Source analysed: the original app-builder workspace export (2 Oct 2026).
Method: read every app file (`src/lib/learn`, `src/components`, `src/routes`), ran
install / typecheck / lint / tests / production build, served the production
build and drove it with Playwright (desktop 1280×860 and mobile 390×844), and ran
the real `srs.ts` / `quiz.ts` / `text.ts` code against the shipped data.

## Status: all findings fixed

The export was imported unchanged in `f382981`; everything below describes that
baseline. Each finding was then fixed on branch `claude/analysis-in-depth-maqczd`
and re-checked in the browser against the production build.

| # | Finding | Fix | Commit |
|---|---|---|---|
| 3.1 | Intervals inflated to "mastered" in minutes | `schedule()` grows from the time since the card was last graded (new `last` field); a pass never shortens an interval | `a51f930` |
| 3.2 | Quizzes enrolled words and bypassed the new-word cap | New `practice()`: never creates a card or pushes one later; a miss makes a scheduled card due now. Pairs counts only first-try matches, never the last pair | `a51f930` |
| 3.3 | Progress only in `localStorage` | Export / import on Progress (zod-validated, migrates older saves); persist `version` + `migrate` | `1e6358b` |
| 3.4 | Anonymous, unthrottled AI endpoint | Entry id only, prompt built server-side from the dataset; per-client and per-instance caps; LRU cache; 15 s timeout; button hidden without a key | `0809ebe` |
| 3.5 | Retry never recovered | Failed loads are evicted from the cache | `9864fa2` |
| 3.6 | Sprint lost focus | Input stays enabled and ignores keys while revealing | `9864fa2` |
| 3.7 | Broken streak still shown | `liveStreak()` on Home, header and Progress | `9864fa2`, `1e6358b` |
| 3.8 | Header showed "۳ / ۲۰۱" | Real "·" text between goal and streak | `9864fa2` |
| 3.9 | Review counter stuck at "1 / N" | Counts answered cards | `9864fa2` |
| 3.10 | Arabic-keyboard search found nothing | `searchKey()` folds ي/ك, ZWNJ, spaces, diacritics (Words and Notebook) | `9864fa2` |
| 3.11 | American spellings marked wrong | Accepted variants for the 39 British-spelled headwords | `9864fa2` |
| 3.12 | Homograph twins as options | Distractors exclude the target's headword | `0c64559` |
| 3.13 | Orphaned cards counted as due forever | Review drops due ids with no entry; README documents keeping ids stable | `0c64559` |
| 3.14 | Mixed digit systems | `useFormat()` everywhere numbers and percents appear; localized chart dates | `1e6358b`, `9864fa2`, `0c64559` |
| 3.15 | Today's entry always A1 | Drawn from the learner's level | `9864fa2` |
| 3.16 | `/drill` and Words ignored the saved level | Adopted after hydration unless already changed | `0c64559` |
| 3.17 | Persian POS in the English UI | `posLabel()` for labels and filter chips | `0c64559` |
| 3.18 | "Reviews" capped at 60 days | Lifetime totals (seeded from logs on migration) | `a51f930`, `1e6358b` |
| 3.19 | Cloze skipped 11.6 %, one leaked the answer | Regular inflections matched (99.6 % eligible), every occurrence blanked | `0c64559` |
| 3.20 | ARIA roles | Quiz options `role="group"`; GoalRing `role="img"` | `0c64559`, `1e6358b` |
| 3.21 | Recharts for one chart | Inline SVG chart, laid out in pixels; Recharts no longer shipped | `1e6358b`, `ab3dafd` |
| 3.22 | Mislabelled A2 "light" | Relabelled "light (make burn or shine)", id kept | `0c64559` |
| 3.23 | Dead code | `shouldRequeue` removed; `isMastered` is now the one mastery check | `a51f930` |
| — | Found while fixing: Common mix-ups had no meaning (no gloss column) | Guide used as the meaning and list subtitle | `0c64559` |
| — | Found while fixing: a note stayed on screen after selecting another word | Notes keyed by entry | `0809ebe` |
| — | Found while fixing: `"constructor:x"` resolved as a deck | `Object.hasOwn` for deck prefixes | `0809ebe` |
| §2 | `npm ci`, lint, 8 failing template tests, no app tests, no CI | Lockfile regenerated; lint clean; PWA tests run from a temp dir; 34 app tests; GitHub Actions CI | `b30c58e` and the fix commits |

After the fixes: `npm ci`, typecheck and lint are clean, all 286 tests pass, and
the build ships ≈ 600 KB of client JS (was ≈ 1.1 MB).

Left as is, on purpose:

- `recharts` stays in `package.json` with the template's preinstalled packages;
  nothing imports it, so it is not shipped.
- The source spreadsheet in `attachments/` was not edited; the "light" label is
  fixed in `public/data/lex-a2.json` only.

### Later: platform and AI removal

After the fixes above, the project was made independent of the platform it was
built on:

- **AI notes removed** (`637462f`). Finding 3.4 no longer applies: the app calls
  no AI service and has no server functions.
- **Platform code removed** (`cf0c82b`): the branding script injector and
  install page, the preview bridge, sandbox scripts, agent docs, and the unused
  sign-in, connector, database and multiplayer modules with their packages. The
  app now ships its own web manifest, home-screen icons and share-card meta.

The project now has 28 unit tests (the template's own tests left with its code),
and the only third-party request the app makes is for Google Fonts.

---

## 1. What the app is

An English-vocabulary trainer for Persian speakers built on the Oxford 3000/5000
lists, with spaced repetition.

| Area | Detail |
|---|---|
| Stack | TanStack Start + React 19, Tailwind v4, zustand (persisted to `localStorage`), Vite 8, Nitro → Vercel |
| Auth / DB | Off. All progress lives in the browser (`localStorage` key `roshana-v1`) |
| Server code | One server function, `explainWord` (`src/lib/learn/coach.ts`), calls an external AI chat API |
| Data | 18 static JSON files in `public/data`, converted 1:1 from `attachments/Oxford_3000_5000_Clean_Final_RTL_Safe_Global_EN_FA.xlsx` (row counts match sheet by sheet) |
| Content | 5,322 headwords across A1–C1 (each with Persian gloss, Persian-script pronunciation, IPA, POS, example + translation) and 2,950 reference notes: phrasal verbs, collocations, prepositions, verb patterns, occupations, antonyms, confusing words, synonyms, word families, word formation, irregular verbs |
| Screens | Today (`/`), Words (`/lexicon`), Review (`/study`), Quiz (`/drill`: 11 modes incl. Pairs and a 45-second spelling sprint), Notebook (`/library`), Progress (`/progress`) |
| App code size | ≈ 4,800 lines (the rest of `src/` is platform template code: auth, app-data, db, multiplayer — unused because auth/db are off) |

## 2. Health check

| Check | Result |
|---|---|
| `npm ci` | **Fails** — `package-lock.json` is out of sync with `package.json` (`ajv@6` vs `ajv@8`, missing `fast-uri`, `require-from-string`). Vercel uses `npm install`, so deploys still work; any CI using `npm ci` will not. |
| `tsc --noEmit` | Pass |
| `eslint .` | 1 error (template file `src/lib/app-data/client.server.ts:281`, empty block), 2 warnings — one of them (`setIndex` unused in `study-session.tsx`) is the symptom of bug 3.9 below |
| `npm test` | 189 / 197 pass. The 8 failures are platform PWA-plugin tests that read the real workspace's `src/lib/og/site.json` and `public/og.jpg` instead of fixtures; deleting `site.json` makes 6 of them pass. Template test bug, not an app bug. |
| Tests for app logic | **None.** `srs.ts`, `store.ts`, `quiz.ts`, `text.ts` have no tests — and that is where most bugs below live. |
| `vite build` | Pass. Initial JS ≈ 160 KB gzipped; Recharts chunk 124 KB gzipped (lazy, Progress page only) |
| Browser console (prod build) | No errors on any route |
| Mobile 390 px | No horizontal overflow on any route |

## 3. Findings

Severity: **High** = corrupts learning data or costs money; **Medium** = visible,
reproducible defect; **Low** = polish / edge case. "Confirmed" = reproduced in the
browser or by running the app's own code.

### High

#### 3.1 Spaced-repetition intervals can be inflated to "mastered" in minutes — confirmed

`schedule()` (`src/lib/learn/srs.ts:77-85`) multiplies the stored interval by ease
on every correct answer, ignoring how long ago the card was last seen. Any
early review therefore grows the interval as if the full interval had passed.

Running the shipped `schedule()` on one new word answered correctly once a minute:

```
answer 1 (+1 min): learning  interval 0d
answer 2 (+2 min): review    interval 1d
answer 3 (+3 min): review    interval 3d
answer 4 (+4 min): review    interval 8d
answer 5 (+5 min): review    interval 20d
answer 6 (+6 min): review    interval 50d   ← counts as "Settled/mastered"
answer 8 (+8 min): review    interval 313d
mature 30-day card reviewed 29 days early → 75 days
```

This is easy to hit in normal use, because three practice modes feed the
scheduler outside the Review screen:

- **Quiz → "My entries"** re-asks the same small pool every round; each correct
  multiple-choice answer (25 % guessable) is graded `good`.
- **Pairs** (`drill.tsx:146`) grades every matched word `good`, even after
  wrong attempts on it, and the last pair is solved by elimination.
- **Spelling sprint** grades a miss `again`, which resets a mature card's interval
  to zero because of one typo under a 45-second timer.

Impact: the "Settled" count and level progress bars become unreliable, and
learners stop seeing words they have not actually retained.

Fix (both parts recommended):
1. Make scheduling elapsed-aware in `schedule()` — base the new interval on
   `min(interval, daysSinceLastReview)` and never shrink a review interval on a
   correct early answer:
   ```ts
   const lastSeen = card.due - card.interval * DAY;
   const elapsed = Math.max(1, (now - lastSeen) / DAY);
   const base = Math.min(card.interval || 1, elapsed);
   interval = Math.max(card.interval, Math.round(base * factor));
   ```
2. Let practice modes (Quiz, Pairs, Sprint) only reschedule cards that are
   actually due; otherwise just log the practice (and maybe flag misses).

#### 3.2 Quizzes silently enrol words and bypass the daily new-word cap — by code

`QuizRun`'s `onGrade` calls `review()` for every question (`drill.tsx:135`), and
`review()` creates a card when none exists (`store.ts:154-173`). A 20-question
"Whole level" quiz therefore adds up to 20 words to the schedule, ignoring the
"New entries a day" setting. It also increments today's `introduced`, so the
Review screen then offers **no** new words that day. A wrong guess on a word the
learner has never studied is stored as a lapse; two such guesses put the word on
the "Unstable" list on Home and Progress.

Fix: in practice modes, only call `review()` for ids already in `cards` (the
Pairs/Sprint path already does this via `touchKnown`).

#### 3.3 All progress lives in one browser's `localStorage` — design risk

There is no export, import, backup or sync. Clearing site data, using a private
window, switching phone, or iOS evicting storage silently wipes months of
reviews. For a long-horizon SRS app this is the biggest product risk.

Fix: at minimum, add "Export / Import progress" (JSON download/upload) on
Progress. Longer term, add accounts and a database so progress follows the user.

#### 3.4 AI "explain" endpoint is anonymous and unthrottled — confirmed

`explainWord` (`src/lib/learn/coach.ts`) is a public server function that spends
the app owner's AI API quota:

- No rate limit, no per-client cap (the template guidance asks for "capped").
- TanStack's CSRF check blocks other *websites*, but a script passes simply by
  sending the app's own `Origin` header. Verified: a `curl` POST with a matching
  Origin and arbitrary text in `word` / `meaning` returns 200.
- The in-memory cache is keyed on the input, so varied inputs bypass it, and the
  cache is unbounded.
- `fetch` to the AI API has no timeout.
- If the API key is not configured, every card still shows the "شرح / A note"
  button, and it always fails. That is what happens in this export's preview.

Fix: add a per-IP and global daily cap (e.g. a small KV/Upstash counter), restrict
input to words that exist in the dataset (look up the id instead of accepting
free text), add `AbortSignal.timeout(10_000)`, and hide the button when the
feature is unavailable (expose a cheap `isExplainAvailable` flag).

### Medium

#### 3.5 "Try again" can never recover from a failed data load — confirmed

`loadJson()` (`src/lib/learn/load.ts:16-25`) caches the promise before it
settles and never evicts a rejection. After one transient network error, the
Retry button on Review (and every later load of that file) re-uses the rejected
promise until the page is reloaded. Reproduced: block `lex-a2.json` once → error
shown → network restored → Retry → still "The data could not be loaded".

Fix:
```ts
const pending = fetch(`/data/${file}`)
  .then(/* … */)
  .catch((err) => { cache.delete(file); throw err; });
```

#### 3.6 Spelling sprint drops keyboard focus after every answer — confirmed

In `sprint-run.tsx:69-74` the timeout calls `inputRef.current?.focus()` in the
same tick as `setReveal(null)`. React has not re-rendered yet, so the input is
still `disabled` and `focus()` does nothing. Reproduced: after a wrong answer
`document.activeElement` is no longer the input, and typed keys go nowhere.
In a 45-second typing game the user must tap the field after every word.

Fix: use `readOnly` instead of `disabled` while revealing, or focus in an effect:
`useEffect(() => { if (!reveal) inputRef.current?.focus(); }, [reveal, index]);`

#### 3.7 Streak keeps showing after it is broken — confirmed

`streak` is only recomputed when the user reviews. Seeded "last studied 6 days
ago, streak 12" → Home shows **"12 in a row"**. Fix: derive the displayed value
— show `streak` only if `lastStudyDate` is today or yesterday, otherwise 0.

#### 3.8 Desktop header shows a wrong number in Persian — confirmed

![header renders ۳ / ۲۰۱ روز پیاپی](analysis/header-bidi.png)

With 3 reviews, goal 20 and a 1-day streak, the header reads
**"۳ / ۲۰۱ روز پیاپی"** ("3 / 201 days in a row"). `shell.tsx:109-116` separates the
goal and the streak only with a CSS margin (`ms-2`). The DOM text is
`۳/۲۰۱روز پیاپی`, so the bidi algorithm treats `۲۰` and `۱` as one number. With
0 reviews and streak 0 it shows "۰ / ۲۰۰". Fix: put a real separator character
(` · `) between them, or wrap each number in `<bdi>`.

#### 3.9 Review counter is stuck at "1 / N" — confirmed

`study-session.tsx` removes answered cards from `order` but never advances
`index` (`setIndex` is unused; lint flags it). The header reads 1/10, 1/9, 1/8…
Fix: show `stats.reviews + 1` / `stats.reviews + order.length`.

#### 3.10 Persian search fails for Arabic-keyboard letters — confirmed

Searching `كتاب` (Arabic ك, common on Windows/Android Arabic layouts) returns
**0** results; `کتاب` (Persian ک) returns 5. The data uses Persian ی/ک
everywhere and ZWNJ in 681 glosses, and search (`lexicon.tsx:91`, `library.tsx`)
does raw `includes`. Fix: normalise both sides
(`ي→ی`, `ك→ک`, strip ZWNJ, tatweel and harakat) before matching.

#### 3.11 Spelling modes reject American spellings — confirmed

The Oxford lists are British, but the app speaks `en-US` and shows General
American IPA. 13 entries (12 words) mark the standard American spelling **wrong**:
centre (A1, B1), metre, kilometre, theatre, litre, programme, dialogue,
catalogue, grey, tyre, mum, jewellery. (-our/-or words pass only because of the
one-letter typo tolerance.) Fix: add an accepted-variants map for spelling,
sprint and cloze.

### Low

| # | Finding | Evidence / fix |
|---|---|---|
| 3.12 | "Meaning → word" quiz can show two identical correct-looking options for 13 homograph pairs (like/like, second/second, last/last, rock/rock, set/set, tear/tear…) | 10 in ≈277 k simulated questions. Check distractors against the target's *bare* headword in `quiz.ts:41-47` |
| 3.13 | Card ids are slugs of the headword text (`lex:A1:like-find-sb-sth-pleasant`). Editing a headword in the spreadsheet orphans saved progress, and orphaned due cards still count in Home's "N cards are due" but never appear in Review. `persist` has no `version`/`migrate` | Keep ids stable (explicit id column) and add a persist `version` |
| 3.14 | Mixed digit systems in the Persian UI: Latin digits in the Review counter, quiz score, session summary, accuracy %, drill/settings chips, and the chart axis (Gregorian `MM-DD`) | Route all numbers through `Num`; use `Intl.DateTimeFormat("fa-IR")` for the chart |
| 3.15 | "Today's entry" is always taken from A1, even for a C1 learner | Pick from the focus level |
| 3.16 | Opening `/drill` directly ignores the saved level (state initialised before hydration); Words also always opens on A1 | Sync from `focus` after hydration |
| 3.17 | POS labels (and POS filter chips) are Persian-only, shown in the English UI | Map to English labels |
| 3.18 | Progress "Reviews" and the accuracy figures cover only the last 60 days (logs are pruned) but are labelled as totals | Relabel or keep all-time counters |
| 3.19 | Cloze skips 11.6 % of words (inflected forms like *begins*, *dollars*), and one item leaks the answer: "He is ______ tall as his brother." | Match inflections; blank all occurrences |
| 3.20 | Accessibility: quiz options use `role="listbox"` with `<button>` children; `GoalRing` has `aria-label` on a role-less `div` | Use `role="group"`/radiogroup; add `role="img"` |
| 3.21 | Recharts (124 KB gz) is loaded to draw one 14-bar chart | A 30-line inline SVG would do |
| 3.22 | Data: A2 "light (from the sun/a lamp)" carries the verb sense (روشن کردن؛ آتش زدن) | Fix the sense label in the spreadsheet |
| 3.23 | Dead code: `shouldRequeue`, `isMastered` (logic duplicated in `store.ts`), `src/lib/multiplayer/p2p.ts` (570 lines, template, unused) | Remove or use |

## 4. What is good

- **Small, readable, coherent code.** Clear split between data loading
  (`load.ts`), presentation models (`faces.ts`), quiz generation (`quiz.ts`),
  scheduling (`srs.ts`) and state (`store.ts`).
- **Careful bidirectional text.** Nearly every English/Persian fragment sets its
  own `lang` and `dir`; the source data even carries Unicode isolates (LRI/PDI)
  around inline English. Bug 3.8 is the one place this slipped.
- **Thoughtful learning UX.** Interval preview on each grade button,
  keyboard grading (Space, 1–4), one-letter typo tolerance, misses summary,
  "unstable words" list, per-level progress.
- **Rich, clean dataset.** No empty fields, no duplicate ids, 5,322 headwords
  plus 2,950 notes, faithfully converted from the spreadsheet.
- **Production-sound.** Typecheck and build pass, no console errors, no mobile
  overflow, the chart is lazy-loaded, and data is static and CDN-cacheable.

## 5. Suggested order of work

1. **Protect learning data:** 3.1 + 3.2 (scheduler and practice-mode grading),
   with unit tests for `srs.ts` and `store.ts`.
2. **Protect progress:** 3.3 (export/import, then optional accounts).
3. **Protect the AI budget:** 3.4 (caps, input restriction, hide when unavailable).
4. **Quick visible fixes (a few lines each):** 3.5, 3.6, 3.7, 3.8, 3.9.
5. **Persian/English correctness:** 3.10, 3.11, 3.14, 3.17.
6. **Hygiene:** regenerate the lockfile, fix or isolate the 8 template tests,
   remove dead code, add app-logic tests to `npm test`.
