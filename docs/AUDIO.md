# Pronunciation audio

Every enhanced sense (the pilot and A1 batches 2–8) has recorded clips in
British and American English: the word itself and each teaching example. There
are 5,542 clips (2,771 per accent), 47.6 MB in total, in `public/audio/pilot/`.

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
with /s/ for /z/ in both accents. Those senses give phonemes too, so their
clips follow the dictionary.

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
The comparison ignores stress, length and syllable marks, and maps notation
differences such as Kokoro's /a/ for the British TRAP vowel to /æ/.

Clips with a fault or a mismatch are listed in `content/pilot/audio-report.json`.
The current report flags 267 word clips and no technical faults. Most are
expected:

- function words said in isolation use their strong form (*a* /eɪ/, *that*
  /ðæt/), while the entry lists the weak form first;
- some flags come from vowel notation that differs between Kokoro and the
  dictionary.

A listener still has to confirm each one. The pronunciation review of an entry
([PILOT_CONTENT.md](PILOT_CONTENT.md)) includes hearing its flagged clips.

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
offline** downloads every clip for the selected accent: about 24.5 MB for
British, 23.1 MB for American. Each accent can also be removed again.

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
