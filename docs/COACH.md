# AI coach

The coach answers questions that the fixed exercises cannot:

- **"Is my sentence natural?"** in writing tasks;
- **"Why does this word fit here?"** after a lesson question;
- **"What is the difference between these words?"** in contrast lessons.

It is **off** until it is configured and has passed its evaluation (see
[Turning it on](#turning-it-on)). Until then the app shows no coach at all, and
the lesson notes, examples and mistakes are the help.

## How an answer is made

`POST /api/coach` (`src/api/coach.ts`, with the shared core in
`src/api/coach-core.ts`):

- **Grounded.** The prompt carries the app's own content for the words asked
  about: the Persian meaning, grammar patterns, examples, collocations, usage
  note and common mistake, or the contrast lesson. The instructions forbid
  contradicting it and require the verdict "unsure" when it does not settle
  the question.
- **Structured.** The model must call one tool. Its answer is checked with zod
  before anything is shown:

  | Field | Contents |
  |---|---|
  | `verdict` | `natural`, `needs-change` or `unsure` |
  | `issue` | The problem in a few words |
  | `explanation` | Two or three sentences in the learner's language |
  | `corrected` | A corrected or model English sentence |
  | `next` | An invitation to try again |
  | `confidence` | `high`, `medium` or `low` |

  A malformed answer is not shown. A low-confidence answer is shown as "not
  sure", whatever its verdict.
- **Uncertain when it should be.** "Not sure" answers point the learner back to
  the examples, or to a teacher.
- **Advice only.** Every answer is labelled as AI that can be wrong and that does
  not count towards progress. Nothing the coach says changes a card, a skill,
  a count or the review history.
- **Useful when unavailable.** Offline, rate-limited or failed requests say so,
  and the page's own notes remain.

## Learner text and costs

- A learner's sentence is sent only after they confirm, once per page, that it
  goes to an AI service (Anthropic). The Worker does not log or store it, and
  answers about a learner's own sentence are never cached.
- Questions about the content alone ("why does this fit", "what is the
  difference") are cached at the edge for 30 days, so repeated questions cost
  nothing.
- Each answer is capped at 500 output tokens at temperature 0. Requests are
  limited per address by a Workers rate limit, whose binding is required for
  the coach to turn on. Inputs are capped at 300 characters and three words.

## Evaluation and the release gate

`content/coach-eval/cases.json` is built from the teaching content by
`npm run coach:cases` (CI checks it is current):

| Cases | Expected verdict |
|---|---|
| Teaching examples, and the corrected form of each common mistake | natural |
| Each documented learner mistake, and each "not natural" contrast sentence | needs-change |
| Hand-written context-dependent sentences (`ambiguous.json`) | natural or unsure |

A fixed 30% of cases, chosen by hash, are held out and never used to tune the
prompt. In evaluation, the sentence under test is withheld from the prompt's
reference, so a case cannot be answered by finding itself there.

```sh
ANTHROPIC_API_KEY=… npm run coach:eval -- --model claude-sonnet-5-5
ANTHROPIC_API_KEY=… npm run coach:eval -- --model claude-haiku-4-5-20251001
npm run coach:eval -- --dry-run          # check the set and see a prompt, without a key
```

The harness reports:

- agreement with the expected verdicts;
- the expected-to-answered matrix and the first disagreements;
- malformed answers;
- whether explanations are in Persian;
- latency and token use.

**The gate** is at least **95% agreement** on the balanced held-out split (as
many natural as need-a-change cases, plus the context-dependent ones), with no
malformed answers. The model to use is chosen this way, by measured quality and
cost.

The case set inherits the content's review status. Until bilingual reviewers
confirm the expected verdicts, a pass is provisional. Before the coach goes
public, a reviewer should also read a sample of explanations for accuracy and
tone.

## Turning it on

All of the following must hold, or `/api/coach/status` reports
`{"enabled": false}` and the app shows no coach:

1. The evaluation passes for the chosen model.
2. Under **Workers → Settings → Variables and secrets**, add the secret
   `ANTHROPIC_API_KEY`, and set the variables `COACH=on` and optionally
   `COACH_MODEL` (default `claude-sonnet-5-5`).
3. Add a rate-limit binding named `COACH_LIMITER` to `wrangler.jsonc`, for
   example 30 requests a minute per address:

   ```jsonc
   "ratelimits": [{ "name": "COACH_LIMITER", "namespace_id": "1001", "simple": { "limit": 30, "period": 60 } }]
   ```

## Not yet built

- **"Practise these three words with me in a short conversation."** It needs
  multi-turn state and its own evaluation of conversational feedback.
- **Speaking feedback beyond record-and-compare.** That means targeted sounds,
  stress, and automated scoring once calibrated against human judgements
  ([AUDIO.md](AUDIO.md#speaking-practice)).
