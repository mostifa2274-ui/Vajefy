# A1 scene coverage

This artifact makes the roadmap's contextual-recycling coverage measurable
without inventing a release threshold that the frozen plan does not define.

## Authoritative artifact

`content/assurance/scene-coverage.json` is generated from:

- `public/data/enhanced/index.json` — every current A1 learning sense;
- `content/curriculum/A1.json` — the frozen introduction order used to decide
  whether a scene actually recycles a sense after its introduction;
- `content/pilot/scenes.json` — every authored scene and its target senses.

Run:

```bash
npm run assurance:scene-coverage
npm run assurance:scene-coverage:check
```

The check is part of `npm run validate:data`, so CI fails when the matrix is
stale, a scene targets an unknown sense, a scene has no targets, or a scene has
fewer than two comprehension checks.

## Current evidence

The current matrix reports:

- **1,027** A1 senses;
- **14** scenes;
- **51** senses with at least one **later** scene-recycling candidate;
- **976** senses with no later scene recycling;
- **5** senses with at least two later scene-recycling candidates;
- maximum later-recycling coverage of **2** scenes for one sense;
- later-recycling coverage ratio **0.049659**.

Every current scene has at least two comprehension checks; current scenes have
three each. This is structural evidence, not a claim that scene breadth is
sufficient.

## Threshold policy

The roadmap requires a scene coverage matrix and says A1 completion must depend
on coverage rather than merely a fixed scene count. It does **not** currently
freeze a numeric coverage threshold. Accordingly the artifact records:

- `threshold: null`
- `thresholdStatus: "UNSET"`

CI checks freshness and structural validity only. A future numeric threshold
must be explicit, versioned, justified, and committed before it can become a
release gate. Until then, the 51/1,027 later-recycling result is an observed gap, not a pass.
