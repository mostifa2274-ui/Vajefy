# A1 20-entry calibration slice

Before human review scales across all A1 content, Vajefy uses the fixed
20-entry introductions slice declared by `content/curriculum/A1.json`.
`content/calibration/a1-20.json` is its reviewer-facing overlay: it groups the
canonical sequence into smaller review sections and adds objectives, patterns
and explicit recycling. It cannot redefine entry order or prerequisites.

The slice calibrates four things together:

1. curriculum order and prerequisites;
2. bilingual teaching quality;
3. British and American pronunciation review;
4. independent delayed assessment and later recycling.

Run:

```sh
npm run content:calibration
npm run content:calibration -- --json
```

The command reads the current compiled enhanced content, current audio
manifest/report and current editorial ledger. It produces a reviewer-facing
matrix on stdout. Redirect it to a file when a reviewer wants a snapshot:

```sh
npm run content:calibration > a1-calibration-review.md
```

CI runs the same tool with `--check`. Structural failures stop the build:
the packet must exactly match the curriculum's 20 unique A1 entries in order,
every entry must have enhanced content, curriculum-owned prerequisites must
already have been introduced, recycling may only refer backwards, and every
sense must have at least two normal lesson checks plus one held-out assessment.

Editorial conditions do **not** auto-fail or auto-approve. The report surfaces
pending or stale human review, incomplete audio, listener flags and senses that
still need later recycling. Those are decisions for an actual bilingual or
pronunciation reviewer.

The same packet now audits learner-facing English in grammar patterns, examples,
collocations, common-mistake corrections and authored checks. Each lexical
dependency is classified as already introduced, a future item in the 20-entry
sequence, A1 material outside the slice, an external token, or a proper-name
candidate. This prevents hidden vocabulary from being mistaken for
prerequisite-safe teaching text.

Run the stricter language-readiness gate separately while calibration copy is
being cleaned:

```sh
npm run content:calibration:language
```

It fails while unresolved learner-language dependencies remain. Proper names
are not silently exempt. If a token is genuinely unavoidable, add a
`languageExceptions` item to the affected entry in
`content/calibration/a1-20.json` with the exact token and a concrete rationale.
Duplicate, empty-rationale and stale exceptions fail structurally. Recording an
exception is evidence for review, not bilingual approval.

For iterative cleanup, authored checks have their own stricter target:

```sh
npm run content:calibration:tasks
```

This command ignores unresolved vocabulary that appears only in explanatory
prose and fails on unresolved dependencies used by authored learner tasks. The
normal report shows both totals. This lets task prompts become prerequisite-safe
first, without pretending the wider teaching copy is already clean.

When a natural early-A1 task needs a small amount of context that has not been
taught yet, use the check item's optional `support` list instead of a hidden
exception. Each support item contains the exact visible English word or short
phrase plus a Persian gloss, and the lesson renders it before the learner
answers. The calibration audit counts that dependency as scaffolded only for
the specific authored task where the gloss is visible. Support that is stale,
duplicated, or exposes the current target fails structurally.

The resolver treats comma-separated lexical variants such as `a, an` as aliases
of one A1 entry and strips trailing parenthetical sense labels before indexing
headwords such as `like (find sb/sth pleasant)`. Punctuation inside a sense label
must never make the actual headword disappear from the dependency graph.

Entries whose authored tasks are clean are marked `taskLanguageReady` in the
calibration overlay. These flags must form one contiguous curriculum prefix,
and `taskLanguageReadyMinimum` is a monotonic CI ratchet: later work may raise
the minimum but must not silently shrink it. The current cleanup raises that
protected prefix to 15/20 entries, through `school`. This is a task-language
quality claim only; human bilingual and pronunciation review remain separate.

## Calibration curriculum

| Unit                        | Entries                         | Main outcome                                            |
| --------------------------- | ------------------------------- | ------------------------------------------------------- |
| Introduce yourself          | I, you, a/an, be, my            | Basic identity, one person/thing and speaker possession |
| Ask and identify            | your, name, what, this, he      | Exchange a name and identify a nearby person or thing   |
| Ask about people and places | who, where, from, in, school    | Ask identity, origin and location                       |
| Share personal details      | city, live, family, friend, how | Home, close people and wellbeing                        |

The curriculum manifest owns the sequence and prerequisites. The calibration
overlay declares an explicit review objective for each entry and which earlier
entries each later review section genuinely recycles. The gate compares the two
files before producing anything, so a stale or independently edited packet
fails CI. The generated packet then adds repository-derived evidence for every
current sense: two or more normal lesson checks, the final held-out delayed
assessment, exact content version, current review status, GB/US audio
completeness, audio-listener flags, and recycling through later sections,
contrasts and scenes.

## Human review boundary

Automated checks can verify structure, freshness relationships, IDs, files and
coverage. They cannot truthfully decide that Persian wording is pedagogically
precise or that a generated pronunciation sounds natural. Do not edit
`content/pilot/review.json` to make the slice green without a real review.

After a reviewer completes the packet, record outcomes using the existing
`content:approve` workflow. Any teaching-content change creates a new content
version and makes an older approval inapplicable until that new version is
reviewed.
