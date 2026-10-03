"""Generate the controlled pronunciation library for the enhanced pilot.

Reads the compiled pilot (public/data/enhanced.json) and, for every sense and
both accents, synthesises the word and each teaching example with Kokoro
(open weights, Apache 2.0). Each clip is named by the hash of everything that
produced it (model, voice, speed and the exact text or phonemes), so a content
change can never leave outdated audio attached: the content build only attaches
a clip whose text still matches.

Every clip is trimmed, faded, loudness-normalised and checked automatically.
Clips with technical faults, or whose synthesised pronunciation differs from the
entry's reviewed IPA, are listed for human review in content/pilot/audio-report.json.

Usage:
    python3 -m venv .venv-audio && .venv-audio/bin/pip install -r scripts/audio/requirements.txt
    .venv-audio/bin/python scripts/audio/generate_audio.py --models DIR
DIR must contain kokoro-v1.0.onnx and voices-v1.0.bin from
https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
"""

import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parents[2]
PILOT = ROOT / "public" / "data" / "enhanced.json"
OUT = ROOT / "public" / "audio" / "pilot"
MANIFEST = ROOT / "content" / "pilot" / "audio-manifest.json"
REPORT = ROOT / "content" / "pilot" / "audio-report.json"

MODEL = "kokoro-v1.0"
MODEL_SHA256 = {
    "kokoro-v1.0.onnx": "7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5",
    "voices-v1.0.bin": "bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d",
}
# Provisional voices until listening tests choose them (docs/AUDIO.md).
VOICES = {"gb": ("bf_emma", "en-gb"), "us": ("af_heart", "en-us")}
SPEED = 0.95
BITRATE = "40k"
SAMPLE_RATE = 24000


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def clip_name(accent: str, text: str, phonemes: bool) -> str:
    voice, lang = VOICES[accent]
    key = json.dumps([MODEL, voice, lang, SPEED, BITRATE, "phonemes" if phonemes else "text", text])
    return hashlib.sha256(key.encode()).hexdigest()[:20] + ".mp3"


def strip_ipa(value: str) -> str:
    """Reduce IPA to comparable segments: no stress, length, syllables or slashes."""
    value = re.sub(r"[/ˈˌ.ːˑ\s()]", "", value)
    for a, b in [("ɹ", "r"), ("ɡ", "g"), ("ɚ", "ər"), ("ɝ", "ɜr"), ("ᵻ", "ɪ"), ("ɐ", "ə"), ("ɾ", "t"), ("ʔ", "t"), ("ɛ", "e")]:
        value = value.replace(a, b)
    # Kokoro writes the British TRAP vowel as /a/; dictionaries write /æ/.
    return re.sub(r"a(?![ɪʊ])", "æ", value)


def ipa_variants(value: str) -> set[str]:
    """Every pronunciation an entry lists, e.g. weak and stressed forms."""
    return {strip_ipa(match) for match in re.findall(r"/([^/]+)/", value)} or {strip_ipa(value)}


def process(raw_wav: Path, mp3: Path) -> dict:
    """Trim silence, add short fades, normalise loudness and encode."""
    with tempfile.TemporaryDirectory() as tmp:
        clean = Path(tmp) / "clean.wav"
        trim = (
            "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,"
            "areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse,"
            "afade=t=in:d=0.01,loudnorm=I=-18:TP=-2:LRA=11,"
            "apad=pad_dur=0.12"
        )
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(raw_wav), "-af", trim, "-ar", str(SAMPLE_RATE), "-ac", "1", str(clean)],
            check=True,
        )
        samples, rate = sf.read(clean)
        duration = len(samples) / rate
        peak = float(np.max(np.abs(samples))) if len(samples) else 0.0
        rms = float(np.sqrt(np.mean(np.square(samples)))) if len(samples) else 0.0
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(clean), "-codec:a", "libmp3lame", "-b:a", BITRATE, "-ar", str(SAMPLE_RATE), "-ac", "1", "-map_metadata", "-1", str(mp3)],
            check=True,
        )
    return {"duration": round(duration, 3), "peak": round(peak, 4), "rms": round(rms, 4)}


def faults(stats: dict, kind: str) -> list[str]:
    found = []
    if stats["duration"] < (0.25 if kind == "word" else 0.6):
        found.append("too short")
    if stats["duration"] > (3.5 if kind == "word" else 12):
        found.append("too long")
    if stats["peak"] >= 0.99:
        found.append("clipping")
    if stats["rms"] < 0.01:
        found.append("too quiet or silent")
    return found


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--models", required=True, type=Path)
    args = parser.parse_args()
    for name, expected in MODEL_SHA256.items():
        actual = sha256(args.models / name)
        if actual != expected:
            print(f"{name}: checksum {actual} does not match {expected}", file=sys.stderr)
            return 1

    kokoro = Kokoro(str(args.models / "kokoro-v1.0.onnx"), str(args.models / "voices-v1.0.bin"))
    pilot = json.loads(PILOT.read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    previous = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    clips: dict[str, dict] = {}
    senses: dict[str, dict] = {}
    review: list[dict] = []
    generated = 0

    def render(accent: str, text: str, phonemes: bool, kind: str, sense_id: str, ipa: str | None) -> dict:
        nonlocal generated
        name = clip_name(accent, text, phonemes)
        target = OUT / name
        known = previous.get("clips", {}).get(name)
        if not target.exists() or not known:
            voice, lang = VOICES[accent]
            samples, rate = kokoro.create(text, voice=voice, speed=SPEED, lang=lang, is_phonemes=phonemes)
            with tempfile.TemporaryDirectory() as tmp:
                raw = Path(tmp) / "raw.wav"
                sf.write(raw, samples, rate)
                stats = process(raw, target)
            generated += 1
        else:
            stats = {key: known[key] for key in ("duration", "peak", "rms")}
        synthesized = text if phonemes else kokoro.tokenizer.phonemize(text, VOICES[accent][1])
        issues = faults(stats, kind)
        if kind == "word" and ipa and strip_ipa(synthesized) not in ipa_variants(ipa):
            issues.append(f"pronunciation differs from IPA: synthesized /{synthesized}/, entry {ipa}")
        clips[name] = {**stats, "bytes": target.stat().st_size, "text": text, "accent": accent}
        if issues:
            review.append({"sense": sense_id, "accent": accent, "kind": kind, "text": text, "file": name, "issues": issues})
        return {"text": text, "file": f"pilot/{name}"}

    for entry in pilot["entries"]:
        for sense in entry["senses"]:
            record = {}
            for accent in ("gb", "us"):
                tts = (sense.get("tts") or {}).get(accent)
                word = render(accent, tts or entry["headword"], bool(tts), "word", sense["id"], sense["pronunciation"][accent])
                examples = [render(accent, example["en"], False, "example", sense["id"], None) for example in sense["examples"]]
                record[accent] = {"word": word, "examples": examples}
            senses[sense["id"]] = record

    used = set(clips)
    for stale in OUT.glob("*.mp3"):
        if stale.name not in used:
            stale.unlink()
    manifest = {
        "model": MODEL,
        "voices": {accent: voice for accent, (voice, _) in VOICES.items()},
        "speed": SPEED,
        "bitrate": BITRATE,
        "totalBytes": sum(clip["bytes"] for clip in clips.values()),
        "clips": dict(sorted(clips.items())),
        "senses": senses,
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n")
    REPORT.write_text(json.dumps({"model": MODEL, "flagged": review}, ensure_ascii=False, indent=1) + "\n")
    print(f"{len(clips)} clips ({generated} new), {manifest['totalBytes'] / 1e6:.1f} MB; {len(review)} flagged for review")
    return 0


if __name__ == "__main__":
    sys.exit(main())
