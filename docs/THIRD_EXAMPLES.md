# Third examples for two-example senses

The content standard asks for at least three pedagogically distinct examples
per sense (`EXAMPLE_COUNT`). On 2026-10-12, 1,007 A1 senses had only two. This
work adds a third example, unit by unit, without changing the two existing
examples, so no existing audio clip is lost. All 1,007 are done, so
`EXAMPLE_COUNT` is 0. Unit 1, the calibration slice, had none and is unchanged.

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
- It names no place or word outside the vocabulary lists. In batch 2, eleven
  first drafts named Iranian cities or used *notebook*, *pharmacy* or
  *easiest*, and were replaced so the lint count stayed at 80. In batch 3,
  fourteen first drafts used words outside the lists (*nest*, *zoo*, *gloves*,
  *click*) or nearly repeated a check item, and were replaced. Batch 4 replaced
  twelve for the same reasons (*shelf*, *staff*, *picnic*, *breathe*), and batch
  5 five (*mosque* and four near-repeats).
- It does not repeat a staged CEFR-J lesson draft, which must stay
  independent of existing teaching text. One batch 2 draft (*The road was
  closed because of the snow.*) matched the staged *closed* lesson and was
  replaced.

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
| 1 | 04 food and drink, 05 shopping and money (#230) | 183 | 824 | 366 |
| 2 | 06 places and directions, 07 travel and transport (#231) | 194 | 630 | 388 |
| 3 | 08 work and study, 09 leisure and people, 10 weather and clothes (#232) | 273 | 357 | 546 |
| 4 | 11 health and feelings, 12 help and everyday problems (#233) | 184 | 173 | 368 |
| 5 | 02 family and home, 03 daily routine (#234) | 173 | 0 | 346 |

## Reused examples

With the audio pipeline in place, the 32 `EXAMPLE_REUSED` findings were fixed
the same way. Each was a sentence that also appears in a sense taught earlier
(for example *I go to work by bus.* under *to*, *by* and *work*). The copy in
the later-taught sense was replaced with a new sentence for that sense, and the
earlier sense keeps its sentence and clips. The new sentences follow the rules
above and got GB/US clips (64). One first draft (*Would you like to come with
us?*) was the expected answer to the sense's production task and was replaced.
Nothing else referenced the GB/US clips for the replaced *You did a great job.*
under *great*, so those two files were removed. `EXAMPLE_REUSED` is 0.
