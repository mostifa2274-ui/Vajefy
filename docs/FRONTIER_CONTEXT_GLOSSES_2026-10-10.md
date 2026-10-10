# Later-unit contextual vocabulary support, 2026-10-10

Codex (GPT-6) authored 140 Persian support glosses for 133 exact tasks in Units
4–12: 111 source entries (118 senses) and six scenes. Each gloss explains a word
already visible before the answer. Existing task text, answers, options,
feedback, examples, meanings, curriculum and audio remain unchanged. These
supports are not independently Persian- or semantic-judge certified.

| Measured result | Before | After |
|---|---:|---:|
| `FRONTIER_TASK_VOCABULARY` | 5,100 | 4,966 |
| `FRONTIER_SCENE_VOCABULARY` | 65 | 59 |
| All deterministic findings | 10,134 | 9,994 |
| Non-promotable triage cases | 245 | 105 |
| Frozen cases | 71 | 71 |
| Structurally glossable cases | 142 | 2 |
| Cases requiring rewording/review | 32 | 32 |

No other deterministic finding code increased. The ratchet was lowered, never
raised. Exact comparison against the previous commit confirms all 180 frozen
Units 1–3 entry objects are unchanged. No audio or curriculum file changed.

Meaning was chosen from the actual task, rather than one translation per token:

| Visible word and context | Persian support |
|---|---|
| `medicine`, studying at university | پزشکی (رشتهٔ تحصیلی) |
| `medicine`, taking it every morning | دارو |
| `while`, listening while studying | در حالی که |
| `while`, lying down for a while | مدتی (در عبارت for a while) |
| `touch`, a lamp not touching a table | تماس داشتن |
| `touch`, a warning about a hot cup | لمس کردن |

Two structurally suggested glosses were deliberately deferred. Translating
`hardly` would supply the distinction tested by the hard/hardly meaning task.
Translating `Pick` in `Pick ___ your bag` could translate the entire tested
phrasal verb instead of an independent background word. The remaining 32
reword/review cases include answer and option distinctions and are not cleared
by the structural triage tool.

The six scenes are `scene:directions`, `scene:birthday`, `scene:lost-phone`,
`scene:phone-message`, `scene:study-plan` and `scene:team-meeting`. Their supports
cover pronounced, hurry, Reza, pass and print; their dialogue and answer text
are unchanged.

Generation provenance records the real agent under
`codex-gpt6-2026-10-10-frontier-context-glosses`. Generated content, coach cases,
machine assurance records and rights authorship hashes were rebuilt. Changed
content-hashed public lesson filenames retain conservative UNVERIFIED upstream
rights assignments; no clearance evidence or approval was added. Gate 0 remains
blocked and judge qualification remains 0/4.
