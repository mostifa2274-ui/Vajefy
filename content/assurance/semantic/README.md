# Semantic assurance evidence

This directory is the evidence boundary for probabilistic content judgment.

The deterministic Unit 1 gate is already independent of this layer. Semantic
evidence is additive: missing evidence keeps a sense quarantined; it never turns
into an implicit approval.

## Required judge roles

Every releasable sense requires all four roles defined in
`content/assurance/semantic-rubrics.json`:

- `english`
- `persian`
- `pedagogical`
- `adversarial`

Each role must use the exact current prompt/rubric version, record the model and
model version, include criterion-level evidence, and use an isolated judge
context.

A judge context may not match the source-generation context and no two required
judges may share the same `contextIsolationKey`.

## Unit evidence file

A unit evidence file is named `<unit-id>.json`, for example
`01-introductions.json`.

Shape:

```json
{
  "schemaVersion": 1,
  "unitId": "01-introductions",
  "generationContextKey": "source-authoring:unit1:v1",
  "judgments": [
    {
      "schemaVersion": 1,
      "role": "english",
      "targetId": "lex:A1:i",
      "contentVersion": "<exact entry version>",
      "inputHash": "<64-char sha256>",
      "generatedAt": "<ISO timestamp>",
      "evaluator": {
        "kind": "model",
        "provider": "<provider>",
        "modelId": "<model>",
        "modelVersion": "<version>",
        "promptVersion": "english-a1-prompt-v1",
        "rubricVersion": "english-a1-v1",
        "contextIsolationKey": "<unique isolated context>",
        "runId": "<reproducible run id>"
      },
      "criteria": [
        {
          "criterion": "sense_fidelity",
          "result": "PASS",
          "confidence": 0.98,
          "evidence": ["sense.meaning", "sense.examples[0]"],
          "reasonCode": null
        }
      ],
      "status": "PASS"
    }
  ]
}
```

The complete role-specific criterion lists live only in the versioned rubric
manifest; a committed judge record missing a required criterion is quarantined.

## Arbitration

The release semantics are fail-closed:

- missing role/evidence -> `QUARANTINED`
- stale content/input/prompt/rubric -> `QUARANTINED`
- shared judge context -> `QUARANTINED`
- high-confidence failure at or above the veto threshold -> `FAIL`
- lower-confidence material judge conflict -> `DISAGREEMENT`
- any unresolved uncertainty -> `UNCERTAIN`
- complete independent qualified consensus only -> `PASS`

The normal CI check validates any committed evidence but does not require
semantic PASS yet. The strict command is reserved for the later semantic
certification gate.

No human approval, legal clearance, learner outcome, or audio certification is
inferred from semantic evidence.


## Reproducible judge packet

Unit 1's committed packet is:

`content/assurance/semantic/packets/01-introductions.json`

It contains 20 sense targets and four role specifications. Every target is bound
to the exact certified sense plus its unit, course order and prerequisites.
Every role records the expected prompt and rubric hashes.

CI runs:

```sh
npm run assurance:semantic:packets:check
```

A source, curriculum, rubric or prompt change therefore makes the packet stale
instead of silently reusing old judgment evidence.

## Isolated judge runner

The repository includes an opt-in OpenAI-compatible/local endpoint adapter. CI
does not call it and no endpoint or credential is committed.

Run one role in one process/context, for example:

```sh
SEMANTIC_JUDGE_ENGLISH_BASE_URL=http://localhost:8000/v1 \
SEMANTIC_JUDGE_ENGLISH_MODEL=my-model \
SEMANTIC_JUDGE_ENGLISH_MODEL_VERSION=model-build-id \
SEMANTIC_JUDGE_ENGLISH_PROVIDER=local \
npm run assurance:semantic:judge -- \
  --role english \
  --packet content/assurance/semantic/packets/01-introductions.json \
  --run-id unit1-english-run-001 \
  --output /tmp/unit1-english.json
```

The role-specific variables may fall back to generic
`SEMANTIC_JUDGE_BASE_URL`, `SEMANTIC_JUDGE_MODEL`,
`SEMANTIC_JUDGE_MODEL_VERSION`, `SEMANTIC_JUDGE_PROVIDER` and
`SEMANTIC_JUDGE_API_KEY`.

The runner:

- verifies the current rubric, prompt and target hashes before inference;
- supplies one exact role rubric;
- derives overall judge status locally from criterion results;
- fills evaluator provenance itself rather than trusting model-supplied metadata;
- rejects missing/extra criteria or invalid structured output;
- writes one role evidence bundle only after every requested target succeeds.

No model call is automatic. In particular, repository CI must not silently spend
credits or use a paid provider.

## Merge isolated role runs

After all independent role runs exist, combine them with:

```sh
npm run assurance:semantic:merge -- \
  --unit 01-introductions \
  --run /tmp/unit1-english.json \
  --run /tmp/unit1-persian.json \
  --run /tmp/unit1-pedagogical.json \
  --run /tmp/unit1-adversarial.json \
  --require-complete
```

The merge command rejects duplicate target/role pairs, unknown targets, wrong
units and mismatched source-generation contexts. The merged evidence is then
checked with:

```sh
npm run assurance:semantic:unit1:check
npm run assurance:semantic:unit1:strict
```

The strict command is the semantic certification gate and remains expected to
fail until genuine independent evidence has been produced for every Unit 1
sense.


## Endpoint preflight

Before any judge execution, run the no-inference preflight:

```sh
npm run assurance:semantic:preflight
```

It reports, for each role:

- provider label;
- base URL;
- model id;
- explicit model/build version;
- whether an API key is present (never the key itself);
- max token setting;
- whether OpenAI JSON response-format mode is enabled;
- exactly which required settings are still missing.

Use the strict variant only when all four independent endpoints are expected to be
configured:

```sh
npm run assurance:semantic:preflight:strict
```

The runner also supports endpoints that reject
`response_format: {"type":"json_object"}`: set the role-specific or generic
`SEMANTIC_JUDGE_JSON_RESPONSE_FORMAT=false`. The model must still return JSON;
the repository parser remains fail-closed.

## Ingestion barriers

External role bundles are validated before the merge command writes anything.
The merge is rejected when any of these conditions occurs:

- wrong unit or source-generation context;
- unknown target or role;
- stale entry content version;
- stale curriculum-aware input hash;
- a run bundle mixes multiple judge roles;
- two different roles reuse one judge context key;
- a judge context matches the source-generation context;
- duplicate target/role evidence;
- `--require-complete` is used while any target/role pair is missing.

These checks duplicate some final arbitration protections intentionally. Bad
external evidence should be stopped both at ingestion and at certification.


## Manual GitHub judge execution

The repository also provides `.github/workflows/semantic-judge.yml`.

This workflow is deliberately manual-only:

- trigger: `workflow_dispatch` only;
- explicit boolean acknowledgement is required before the judge job runs;
- repository permission is `contents: read`;
- it runs exactly one selected role;
- it uploads structured evidence as an artifact;
- it never commits evidence or modifies `main`.

Endpoint variables and API-key secret names are documented in
`content/assurance/semantic/ENDPOINT_RESOLUTION.md`.

The workflow safety contract is checked on every normal CI run. Do not add
`push`, `pull_request`, `schedule` or `workflow_run` triggers to the
semantic judge workflow.
