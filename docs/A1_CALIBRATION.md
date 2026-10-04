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
