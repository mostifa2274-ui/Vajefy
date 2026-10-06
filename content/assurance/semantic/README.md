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
