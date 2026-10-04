# A1 20-entry calibration slice

Before human review scales across all A1 content, Vajefy uses a fixed 20-entry
calibration slice in `content/calibration/a1-20.json`. It is deliberately a
small practical curriculum rather than the first 20 rows of the source
catalogue.

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
there must be exactly 20 unique A1 entries, every entry must have enhanced
content, prerequisites must already have been introduced, recycling may only
refer backwards, and every sense must have at least one normal teaching check
plus one held-out assessment.

Editorial conditions do **not** auto-fail or auto-approve. The report surfaces
pending or stale human review, incomplete audio, listener flags and senses that
still need later recycling. Those are decisions for an actual bilingual or
pronunciation reviewer.

## Calibration curriculum

| Unit | Entries | Main outcome |
|---|---|---|
| Identify yourself and things | I, you, be, a/an, the | Basic identity and noun-reference patterns |
| Possess and point | my, your, have, this, that | Basic possession and demonstratives |
| Talk about people together | he, she, we, they, and | Reference to people/groups and joining ideas |
| Ask basic questions and express ability | what, who, where, how, can | Core questions and ability |

Each entry in the source declares an explicit teaching objective and
prerequisites. Each later unit also declares which earlier entries it recycles.
The generated packet adds repository-derived evidence for every current sense:
normal teaching checks, the held-out delayed assessment, exact content version,
current review status, GB/US audio completeness, audio-listener flags, and
recycling through later units, contrasts and scenes.

## Human review boundary

Automated checks can verify structure, freshness relationships, IDs, files and
coverage. They cannot truthfully decide that Persian wording is pedagogically
precise or that a generated pronunciation sounds natural. Do not edit
`content/pilot/review.json` to make the slice green without a real review.

After a reviewer completes the packet, record outcomes using the existing
`content:approve` workflow. Any teaching-content change creates a new content
version and makes an older approval inapplicable until that new version is
reviewed.
