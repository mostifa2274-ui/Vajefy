# Later-unit English/Persian field repairs — 2026-10-10

Four later-unit senses contained Persian-script explanations in learner-facing
English fields. These explanations now live in their Persian notes; the English
sentences and grammar pattern contain only English. Codex (GPT-6) authored the
new translations and explanations. They have no independent semantic certificate.

| Sense | Course unit | Repair |
|---|---|---|
| `lex:A1:too#excess` | 04-food-drink | Move the intended positive meaning into the Persian explanation; distinguish ordinary praise with very from excess with too; supply literal translations for both sentences. |
| `lex:A1:miss#feel-sad` | 07-travel-transport | Put the intended I miss you meaning in the Persian explanation; show distinct literal Persian translations of You miss me and I miss you. |
| `lex:A1:hard#solid` | 10-body-health | Move the intended solid meaning out of the English sentence; supply distinct Persian translations for strong and hard. |
| `lex:A1:afraid` | 11-feelings-opinions | Keep the grammar pattern be afraid in English and explain its usual position after be in the Persian note, alongside the existing example. |

The compiled curriculum uses zero-based unit indices. Membership was checked
against the first three actual course units: all **180 frozen source entry
objects remain identical**. Audio, curriculum and scene source files are unchanged.
No example recording was altered.

The deterministic report changed as follows; no other code increased:

| Finding | Before | After |
|---|---:|---:|
| Persian in English | 4 | 0 |
| Missing wrong-sentence Persian | 1,007 | 1,004 |
| Missing corrected-sentence Persian | 1,007 | 1,004 |
| Grammar notes without Persian | 943 | 942 |
| All deterministic findings | 9,994 | 9,983 |

The no-regression baseline was lowered to these exact counts. Content, coach
cases, real agent provenance, the current unverified rights derivative filenames,
legacy authorship hashes and assurance records were regenerated. The public
inventory still has 60 JSON artifacts with UNVERIFIED lineage and zero approvals.
Semantic judge qualification remains 0/4 and Gate 0 remains BLOCKED. Structural
improvements are not a linguistic review, audio certificate or public release.

Merged as PR #191 (`9556da47a635d706ede0bb794de9cd1f9d0643ed`). Final tested head
`2f7ce7223e4ff25867183d21fc5d51f9bc9478f2` includes the intervening scheduled
calibration evidence; its tree is `18a5b9840fdbfc15b7c8df598206186824990157`.
Full CI 38043997584 passed all 535 unit and 95 browser tests plus the Workers
contract; rollback rehearsal 38043997585 passed. The final tree was matched
to locally validated bytes, and both progress files record this actual merge.
