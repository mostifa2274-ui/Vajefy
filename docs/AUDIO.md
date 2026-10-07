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

All inference runs locally on the GitHub runner: there is no speech API key or
hosted inference provider. The evidence records the exact shipped clip
SHA-256, decoded signal statistics, both unconstrained ASR transcripts and
alignment timings.

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

The automatic `audio-certify.yml` workflow runs only when audio or its
certification inputs change, commits only
`recognition.json` and `certificates.json`, and then keeps the workflow red
until every scoped pair is certified. Generated evidence does not retrigger
the expensive recognizers.

This completes the certification **foundation**, not Phase 3 itself. The Phase
3 exit still requires every Unit 1–3 word/accent pair to be certified, and A8
still requires versioned per-unit offline audio packs that survive interrupted
replacement.

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

The service worker keeps clips in their own cache, `vajefy-audio-v1`, which
survives app updates. A clip played once is cached. **Progress → Pronunciation
offline** downloads every clip for the selected accent: about 25.9 MB for
British, 24.3 MB for American. Each accent can also be removed again.

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
