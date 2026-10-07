# Pronunciation audio

Every enhanced sense (the pilot and A1 batches 2–9, all 900 A1 entries) has recorded clips in
British and American English: the word itself and each teaching example. There
are 5,850 clips (2,925 per accent), 50.2 MB in total, in `public/audio/pilot/`.

## How clips are made

`scripts/audio/generate_audio.py` synthesises the clips with
[Kokoro](https://github.com/thewh1teagle/kokoro-onnx) v1.0, an open-weights
(Apache 2.0) text-to-speech model run locally through ONNX. No speech service is
called, and the clips are generated once and shipped as static files.

| Setting | Value |
|---|---|
| British voice | `bf_emma` (`en-gb`) |
| American voice | `af_heart` (`en-us`) |
| Speed | 0.95 |
| Format | MP3, 40 kbit/s, 24 kHz mono, no metadata |
| Loudness | −18 LUFS integrated, −2 dBTP peak |

The voices are **provisional**. They were chosen for clarity, but no listening
test with learners has compared them yet. Changing a voice regenerates every
clip for that accent.

Each clip goes through `ffmpeg`, which:

1. trims leading and trailing silence;
2. adds a 10 ms fade-in;
3. normalises loudness;
4. pads 120 ms of silence at the end;
5. encodes the MP3.

### Names follow content

A clip's file name is a hash of everything that produced it: the model, voice,
language, speed, bitrate, and the exact text or phonemes. `content:build` attaches
a clip to a sense only when the clip's text equals the sense's current word or
example. An edited example therefore never plays outdated audio. It falls back
to browser speech until its clip is regenerated. Clips are served with
`Cache-Control: immutable` (`public/_headers`), which is safe because a changed
clip always gets a new name.

### Words spelled alike, said differently

When spelling alone does not decide the pronunciation, a sense gives phonemes in
`tts` and the clip is synthesised from them. Examples: *close* (verb /kləʊz/,
adjective /kləʊs/), *present* (noun and adjective vs. verb), *live* (verb vs.
adjective), *have to* (/hæf tə/), the verb *use* (/juːz/) and *of course*.

Kokoro's British voice also uses northern vowels in a few words: a short *a*
in *last*, *after*, *afternoon*, *answer*, *ask*, *aunt*, *banana*, *bath*,
*bathroom*, *class*, *classroom*, *dance*, *dancer*, *dancing*, *example*,
*fast*, *glass*, *half*, *laugh*, *paragraph*, *passport*, *past*,
*photograph*, *plant* and *tomato*, and /wɒn/ in *one*, *once*, *anyone*,
*everyone*, *no one* and *someone*. Kokoro also says *husband* and *trousers*
with /s/ for /z/ and *yeah* with a final /h/, and stresses *thirteen* to
*nineteen* on the first syllable, which hides the contrast with *thirty* to
*ninety*. Those senses give phonemes too, so their clips follow the
dictionary.

## Automatic checks

Every clip is checked for:

| Fault | Word clip | Example clip |
|---|---|---|
| Too short | under 0.25 s | under 0.6 s |
| Too long | over 3.5 s | over 12 s |
| Clipping | peak ≥ 0.99 | peak ≥ 0.99 |
| Silent or too quiet | RMS < 0.01 | RMS < 0.01 |

For word clips, the phonemes Kokoro produced are compared with every
pronunciation the sense lists, for example both the weak and the stressed form.
The comparison ignores stress, length and syllable marks, and removes
differences of notation only:

- Kokoro's /a/ for the British TRAP vowel is /æ/;
- a syllabic consonant written /l/ or /l̩/ equals /əl/ (*table*, *cousin*);
- the NEAR and CURE vowels may be written /ɪə/ or /iə/, /ʊə/ or /uə/ (*dear*);
- a word-final happY vowel may be /i/ or /ɪ/ (*every*);
- a headword with several forms (*a, an*) is phonemized as a list, and each
  form must match one the entry lists.

Strong and weak forms, dropped or added sounds, and different vowels still
count as mismatches.

Clips with a fault or a mismatch are listed in `content/pilot/audio-report.json`.
The report flags 174 word clips (114 US, 60 GB, across 123 senses) and no
technical faults. Before the notation rules above it flagged 292; the 118
cleared were notation alone. Most of the rest are expected:

- function words said in isolation use their strong form (*that* /ðæt/), while
  the entry lists only the weak form;
- unstressed vowels differ (*family*, *welcome*), or a sound is dropped in the
  dictionary form (*grandfather*);
- the US voice sometimes drops /r/ (*her*), which is a real fault.

`python3 scripts/audio/generate_audio.py --rescore` re-checks the flags already
in the report with the current comparison, without the model.

The old process required a listener to confirm each remaining flag. That is no
longer the target release gate. `content/assurance/audio/` now defines a
fail-closed machine certificate for Units 1–3. Until independent recognizer
evidence has run, the committed state is honestly
`PENDING_RECOGNITION`: no clip is certified merely because Kokoro's own
phonemizer agrees with the entry.

### Independent audio certification

`scripts/audio/certify_audio.py` evaluates every Unit 1–3 **word/accent**
pair from the shipped MP3 bytes with three offline systems:

- faster-whisper 1.2.1 with the pinned
  `Systran/faster-whisper-small.en` revision
  `4e49ce629e3fa4c3da596c602b212cb026910443`;
- Vosk 0.3.45 with `vosk-model-small-en-us-0.15`, whose downloaded archive
  must match SHA-256
  `30f26242c4eb449f948e42cb302dd7a686cb29a3423a8367f99ff41780942498`;
- PocketSphinx 5.1.1 forced word/phone alignment.

PocketSphinx alignment output is normalized before lexical comparison:
boundary/silence markers such as `<s>` and `<sil>` are excluded, and
dictionary alternate-pronunciation suffixes such as `a(2)` are compared as
their lexical token (`a`). Segment/phone durations and coverage are still
validated; only non-lexical labels are removed from the word sequence.

All inference runs locally on the GitHub runner: there is no speech API key or
hosted inference provider. The evidence records the exact shipped clip
SHA-256, decoded signal statistics, both unconstrained ASR transcripts and
alignment timings. ASR always compares against the learner-facing
entry headword. A phoneme-level `tts` override is synthesis input only and can
never become the expected lexical transcript.

Source identity is scoped to the exact Unit 1–3 inputs consumed by this gate:
the scoped unit membership/order, learner-facing headwords and pronunciations,
word-clip references and signal metadata, and relevant word-level audio flags.
Edits confined to Units 4–12 therefore do not invalidate Unit 1–3 audio
evidence, while any change that can alter a scoped target still changes the
recorded source hashes. The Node release authority and Python recognizer both
consume the same generated scoped-hash file.

`scripts/audio-certification.ts` is the release authority. A target is
`CERTIFIED` only when:

1. the evidence is bound to the current curriculum, enhanced content, audio
   manifest, audio report and exact MP3 bytes;
2. the decoded MP3 passes signal-integrity thresholds;
3. **both** independent ASRs lexically match the intended form;
4. forced word/phone alignment is complete and non-degenerate; and
5. all three systems agree. Missing evidence is `UNCERTAIN`; disagreement,
   stale identity or a failed check is `QUARANTINED`, never averaged into a
   pass.

The automatic `audio-certify.yml` workflow runs when audio or its
certification inputs change and also performs one scheduled check each day.
The scheduled check is cheap when evidence is current: `CERTIFIED` or
`PARTIAL` evidence exits before model/dependency setup. Expensive
certification runs only while recognition is still pending or when committed
evidence is stale/invalid. This gives infrastructure failures an unattended
retry without repeatedly burning compute on a valid partial result.

Every expensive attempt appends a bounded execution record to
`repair-log.json`: GitHub run/attempt, trigger, source commit, job outcome and
the certificate snapshot that actually existed at the end. If a run fails
before evidence can be safely committed, partial working-tree mutations are
discarded after their Actions artifact is uploaded and only the automation
attempt is committed. Bot-generated evidence/promotions/outcome records carry
`[audio-bot]` and are explicitly prevented from recursively starting the
expensive workflow.

### Automatic audio repair

Independent certification, not the legacy pronunciation report, decides
whether a Unit 1–3 word/accent target needs repair. A repair round is strictly
bounded by `content/assurance/audio/repair-policy.json`:

1. `audio-repair-plan.ts` selects only `QUARANTINED` targets whose blockers
   are acoustic/recognition/alignment failures. Missing or stale identity
   evidence is never repaired by synthesis.
2. The planner chooses the first **untried** pre-registered candidate for that
   target and exact source-clip SHA-256. There are four fixed candidates per
   accent; there is no random search or indefinite retry.
3. `generate_repair_candidates.py` verifies the pinned Kokoro model/voice
   checksums and writes candidates under the private workflow workspace, never
   under `public/audio`.
4. The same pinned Whisper, Vosk and PocketSphinx systems independently
   evaluate those candidate bytes. `audio-repair-evaluate.ts` reuses the
   release certificate logic and rejects synthesis/recognizer provenance
   drift.
5. `promote_repair_candidates.py` records every attempt in
   `repair-log.json`. A candidate is copied into the product only when it is
   `CERTIFIED`, its candidate SHA-256 still matches, and the old source clip
   still matches the source SHA-256 that was judged.
6. After every promotion round, generated content is rebuilt. After the last
   bounded round, all 386 current Unit 1–3 word/accent targets are certified
   again from the exact promoted repository state. Isolated candidate
   certification is provisional until this final full-corpus pass.
7. Before the first promotion, the workflow snapshots the exact scoped release
   MP3 bytes, manifest, report and baseline certificates. If a promoted
   candidate loses `CERTIFIED` status in the final full-corpus pass, only that
   target is restored from the SHA-bound snapshot. The instability is recorded
   in `repair-log.json.finalFailures`, stable promotions remain in place, and
   the rolled-back exact state is rebuilt, rebound to fresh scoped source
   identity and re-certified before commit.
8. A rolled-back candidate remains a tried candidate. A later unattended
   `PARTIAL` run proceeds only when the repair planner still has an untried
   frozen candidate, so the next candidate may be evaluated without repeating
   the unstable one or burning compute when the bounded policy is exhausted.

The bot commit guard stages only allowlisted generated audio/evidence files,
never broad repository changes and never force-pushes. Unresolved targets stay
on their previous working clips and keep the release gate red. A later full
Kokoro regeneration also preserves a promoted repair by its per-clip
`repairPolicyVersion` and generation provenance instead of silently replacing
it with the default voice.

This implements the automatic A2/A6 repair machinery but does **not** itself
claim Phase 3 completion. The current committed production evidence remains
`PENDING_RECOGNITION` until a main-branch run writes real recognizer results.
Phase 3 exits only at 386/386 certified targets. A8 is already implemented with
versioned per-unit offline packs and transactional replacement.

## Regenerating

The models come from the kokoro-onnx GitHub release `model-files-v1.0`. The
script refuses files whose SHA-256 does not match:

| File | SHA-256 |
|---|---|
| `kokoro-v1.0.onnx` | `7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5` |
| `voices-v1.0.bin` | `bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d` |

```sh
npm run content:build                      # the script reads the compiled pilot
python3 -m venv .venv-audio
.venv-audio/bin/pip install -r scripts/audio/requirements.txt
.venv-audio/bin/python scripts/audio/generate_audio.py --models <dir with both files>
npm run content:build                      # attach the new clips
```

`ffmpeg` must be on the path. A clip that already exists and is listed in the
previous manifest is kept; only new or changed text is synthesised. The script rewrites
`audio-manifest.json` and `audio-report.json`. Clips that are no longer
referenced can be deleted.

## Playback in the app

`src/lib/learn/speech.ts` is the single playback controller, so only one sound
plays at a time. Each listen button shows its state: loading, playing, or
unavailable with a reason.

- A controlled clip is always tried first. **Slower** plays it at 0.75×.
- If there is no clip, or it fails to load, the browser's speech synthesis
  speaks the text with an English voice only. Depending on the browser and voice,
  that speech may be generated on the device or by the browser vendor's online
  service.
- If neither works, the button says so instead of failing silently.

## Offline audio

Ordinary playback still uses the small opportunistic `vajefy-audio-v1`
cache, but explicit offline downloads now follow A8's unit-pack protocol.

`public/data/enhanced/audio-pack.json` contains one independently versioned
pack for each A1 curriculum unit and accent. A unit version covers the exact
content-hashed filenames plus each file's expected byte length. **Progress →
Pronunciation offline** therefore downloads only the units a learner wants
instead of one 24–26 MB all-course pack.

Each unit/accent/version is installed transactionally in its own
`vajefy-audio-unit-v2:...` Cache Storage namespace:

1. a replacement downloads into a candidate cache;
2. any resumable candidate file is re-read and its byte length revalidated;
3. every newly fetched response must match the manifest byte length;
4. after a full second integrity pass, a completion marker records the unit,
   accent, version, file manifest and install time;
5. only after that marker exists are older versions of the same unit/accent
   removed.

If a tab closes, the connection fails or storage interrupts the candidate,
there is no completion marker. The service worker ignores incomplete
candidates and continues serving the previous complete unit pack. The next
download resumes from already validated candidate files. Removing a unit pack
deletes all explicit versions for that unit/accent; clips cached naturally by
ordinary playback may remain in the lightweight legacy cache.

## Speaking practice

Lessons and the Words page offer **Say it yourself**: the learner records the
word (up to six seconds), plays it back and plays the model clip, to compare by
ear. This is the first stage of speaking practice in the roadmap.

- **Recordings never leave the device.** They are held in the page's memory
  only: never uploaded, never stored, and gone when the learner leaves the
  page. The site's Permissions-Policy allows the microphone for this origin
  only (`microphone=(self)`).
- **There is no automatic score.** Pronunciation assessment has phonemic and
  prosodic dimensions, and a transcript match alone says little. Automated
  feedback on targeted sounds and stress comes only after it has been
  calibrated against human judgements.
- When the browser cannot record, the control is not shown. When access is
  refused, it says so and how to allow it.
