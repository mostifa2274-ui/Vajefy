# Third examples for two-example senses

The content standard asks for at least three pedagogically distinct examples
per sense (`EXAMPLE_COUNT`). On 2026-10-12, 1,007 A1 senses had only two. This
work adds a third example, unit by unit, without changing the two existing
examples, so no existing audio clip is lost.

Claude Code wrote the examples in this session, recorded as generator
`claude-code-2026-10-12-third-examples`. They have no independent semantic
certificate.

## Rules for a new example

- It uses the sense being taught, at A1. The content lint reports no word
  above the A2 lists, so the lint count stays at 80.
- It differs in structure or context from the sense's two existing examples.
  It does not nearly repeat a check item, which would give away the answer. Two
  first drafts did (*Is there any fish on the menu?* and *Don't put too much
  salt in the food.*) and were replaced.
- It is not a sentence used anywhere else in the corpus. Three first drafts
  were (*need*, *bank* and *eleven*) and were replaced.
- The Persian is a natural translation. *too* is translated as «بیش از حد».

## Audio

Every example in a curriculum unit needs GB and US audio for the unit to stay
machine-ready (`a1-qualification --require-ready`). New examples get clips from
the documented local pipeline (`docs/AUDIO.md`):
`scripts/audio/generate_audio.py` with the pinned Kokoro v1.0 model files.
Their SHA-256 hashes were checked against the table in `docs/AUDIO.md`.

The script keeps every existing clip and synthesises only new text. It also
deleted 13 unreferenced orphan files, which were restored to keep each batch
narrow. No clip flagged for review was added. Example clips are not audio
certification targets (those are word clips), so certification is unchanged.

## Batches

| Batch | Units | Senses | `EXAMPLE_COUNT` after | New clips |
|---|---|---:|---:|---:|
| 1 | 04 food and drink, 05 shopping and money | 183 | 824 | 366 |
