"""Generate independent recognition evidence for Unit 1-3 word audio.

This never decides release status. It records source-bound evidence from:
- faster-whisper small.en (general ASR);
- Vosk small US English (independent general ASR);
- PocketSphinx forced word/phone alignment.

scripts/audio-certification.ts is the fail-closed authority that turns this
evidence into certificates. No API key or hosted inference service is used.
"""

from __future__ import annotations

import argparse
from array import array
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
import math
from pathlib import Path
import re
import subprocess
import sys
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
CURRICULUM = ROOT / "content" / "curriculum" / "A1.json"
ENHANCED = ROOT / "content" / "compiled" / "enhanced.json"
MANIFEST = ROOT / "content" / "pilot" / "audio-manifest.json"
REPORT = ROOT / "content" / "pilot" / "audio-report.json"
OUTPUT = ROOT / "content" / "assurance" / "audio" / "recognition.json"

SCOPE_UNITS = ("01-introductions", "02-family-home", "03-daily-routine")
WHISPER_REPO = "Systran/faster-whisper-small.en"
WHISPER_REVISION = "4e49ce629e3fa4c3da596c602b212cb026910443"
VOSK_MODEL = "vosk-model-small-en-us-0.15"
VOSK_ARCHIVE_SHA256 = "30f26242c4eb449f948e42cb302dd7a686cb29a3423a8367f99ff41780942498"
SAMPLE_RATE = 16000


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf8"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def normalize_words(value: str) -> str:
    value = value.casefold()
    value = value.replace("\u2018", "'").replace("\u2019", "'").replace("\u02bc", "'")
    replacements = {
        "i'm": "i am",
        "you're": "you are",
        "he's": "he is",
        "she's": "she is",
        "it's": "it is",
        "we're": "we are",
        "they're": "they are",
        "can't": "cannot",
        "don't": "do not",
        "doesn't": "does not",
        "didn't": "did not",
        "won't": "will not",
    }
    for source, target in replacements.items():
        value = re.sub(rf"\b{re.escape(source)}\b", target, value)
    value = re.sub(r"[^a-z0-9']+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def ffmpeg_pcm(path: Path) -> bytes:
    result = subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(path),
            "-ar",
            str(SAMPLE_RATE),
            "-ac",
            "1",
            "-f",
            "s16le",
            "-acodec",
            "pcm_s16le",
            "-",
        ],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if not result.stdout:
        raise RuntimeError(f"{path}: ffmpeg decoded no samples")
    return result.stdout


def signal_stats(raw: bytes) -> dict[str, float]:
    samples = array("h")
    samples.frombytes(raw)
    if sys.byteorder != "little":
        samples.byteswap()
    if not samples:
        raise RuntimeError("decoded audio is empty")
    scale = 32768.0
    peak = max(abs(sample) for sample in samples) / scale
    square = sum((sample / scale) ** 2 for sample in samples)
    rms = math.sqrt(square / len(samples))
    duration = len(samples) / SAMPLE_RATE
    return {
        "duration": round(duration, 3),
        "peak": round(peak, 4),
        "rms": round(rms, 4),
    }


def whisper_transcript(model: Any, audio: Path) -> dict[str, Any]:
    segments, _ = model.transcribe(
        str(audio),
        language="en",
        beam_size=5,
        condition_on_previous_text=False,
        vad_filter=False,
        word_timestamps=False,
    )
    rows = list(segments)
    text = " ".join(segment.text.strip() for segment in rows if segment.text.strip()).strip()
    avg = sum(segment.avg_logprob for segment in rows) / len(rows) if rows else None
    no_speech = max((segment.no_speech_prob for segment in rows), default=None)
    return {
        "transcript": text,
        "avgLogProb": round(float(avg), 6) if avg is not None else None,
        "noSpeechProb": round(float(no_speech), 6) if no_speech is not None else None,
    }


def vosk_transcript(model: Any, raw: bytes) -> dict[str, str]:
    from vosk import KaldiRecognizer

    recognizer = KaldiRecognizer(model, SAMPLE_RATE)
    recognizer.SetWords(True)
    parts: list[str] = []
    for at in range(0, len(raw), 8000):
        chunk = raw[at : at + 8000]
        if recognizer.AcceptWaveform(chunk):
            parsed = json.loads(recognizer.Result())
            if parsed.get("text"):
                parts.append(parsed["text"])
    final = json.loads(recognizer.FinalResult())
    if final.get("text"):
        parts.append(final["text"])
    return {"transcript": " ".join(parts).strip()}


def forced_alignment(raw: bytes, expected: str) -> dict[str, Any]:
    from pocketsphinx import Decoder

    text = normalize_words(expected)
    if not text:
        return {"status": "unavailable", "words": [], "coverage": None, "reason": "empty-normalized-text"}

    try:
        decoder = Decoder(samprate=SAMPLE_RATE, loglevel="ERROR")
        missing = [word for word in text.split() if decoder.lookup_word(word) is None]
        if missing:
            return {
                "status": "unavailable",
                "words": [],
                "coverage": None,
                "reason": f"dictionary-miss:{','.join(missing)}",
            }

        decoder.set_align_text(text)
        decoder.start_utt()
        decoder.process_raw(raw, full_utt=True)
        decoder.end_utt()
        if decoder.hyp() is None:
            return {"status": "unavailable", "words": [], "coverage": None, "reason": "word-alignment-no-hypothesis"}

        decoder.set_alignment()
        decoder.start_utt()
        decoder.process_raw(raw, full_utt=True)
        decoder.end_utt()
        alignment = decoder.get_alignment()
        if alignment is None:
            return {"status": "unavailable", "words": [], "coverage": None, "reason": "subword-alignment-missing"}

        words = []
        for word in alignment:
            phones = [
                {
                    "name": phone.name,
                    "start": int(phone.start),
                    "duration": int(phone.duration),
                }
                for phone in word
            ]
            words.append(
                {
                    "name": word.name,
                    "start": int(word.start),
                    "duration": int(word.duration),
                    "phones": phones,
                }
            )
        if not words:
            return {"status": "unavailable", "words": [], "coverage": None, "reason": "empty-alignment"}

        start = min(word["start"] for word in words)
        end = max(word["start"] + word["duration"] for word in words)
        utterance_frames = max(1.0, (len(raw) / 2 / SAMPLE_RATE) * 100.0)
        coverage = max(0.0, min(1.0, (end - start) / utterance_frames))
        return {
            "status": "ok",
            "words": words,
            "coverage": round(coverage, 6),
            "reason": None,
        }
    except Exception as error:
        return {
            "status": "unavailable",
            "words": [],
            "coverage": None,
            "reason": f"{type(error).__name__}:{str(error)[:160]}",
        }


def targets() -> list[dict[str, Any]]:
    curriculum = read_json(CURRICULUM)
    enhanced = read_json(ENHANCED)
    manifest = read_json(MANIFEST)

    units = {unit["id"]: unit for unit in curriculum["units"]}
    entries = {entry["id"]: entry for entry in enhanced["entries"]}
    rows = []
    for unit_id in SCOPE_UNITS:
        unit = units.get(unit_id)
        if unit is None:
            raise RuntimeError(f"missing curriculum unit {unit_id}")
        for item in unit["entries"]:
            entry = entries.get(item["id"])
            if entry is None:
                raise RuntimeError(f"{unit_id}: missing enhanced entry {item['id']}")
            for sense in entry["senses"]:
                audio = manifest["senses"].get(sense["id"])
                if audio is None:
                    raise RuntimeError(f"{sense['id']}: missing audio manifest record")
                for accent in ("gb", "us"):
                    word = audio[accent]["word"]
                    clip = ROOT / "public" / "audio" / word["file"]
                    if not clip.exists():
                        raise RuntimeError(f"{sense['id']}:{accent}: missing {word['file']}")
                    rows.append(
                        {
                            "targetId": f"{sense['id']}:{accent}",
                            "unitId": unit_id,
                            "entryId": entry["id"],
                            "senseId": sense["id"],
                            "accent": accent,
                            "clipFile": word["file"],
                            "expectedText": entry["headword"],
                            "pronunciation": sense["pronunciation"][accent],
                            "path": clip,
                        }
                    )
    return rows


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--vosk-model", type=Path, required=True)
    parser.add_argument("--vosk-archive", type=Path, required=True)
    parser.add_argument("--source-hashes", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--candidate-manifest", type=Path)
    parser.add_argument("--candidate-root", type=Path)
    args = parser.parse_args()

    if not args.vosk_model.is_dir():
        parser.error(f"--vosk-model is not a directory: {args.vosk_model}")
    if not args.vosk_archive.is_file():
        parser.error(f"--vosk-archive is not a file: {args.vosk_archive}")
    source_hashes = read_json(args.source_hashes)
    expected_hash_keys = {
        "curriculumSha256",
        "enhancedSha256",
        "audioManifestSha256",
        "audioReportSha256",
    }
    if set(source_hashes) != expected_hash_keys:
        raise RuntimeError("--source-hashes must contain exactly the four scoped source hash fields")
    for key, value in source_hashes.items():
        if not isinstance(value, str) or len(value) != 64 or any(
            char not in "0123456789abcdef" for char in value
        ):
            raise RuntimeError(f"--source-hashes {key} is not a lowercase SHA-256")

    archive_hash = sha256(args.vosk_archive)
    if archive_hash != VOSK_ARCHIVE_SHA256:
        raise RuntimeError(
            f"Vosk archive SHA-256 {archive_hash} does not match pinned {VOSK_ARCHIVE_SHA256}"
        )

    for package, expected in [
        ("faster-whisper", "1.2.1"),
        ("vosk", "0.3.45"),
        ("pocketsphinx", "5.1.1"),
    ]:
        actual = importlib.metadata.version(package)
        if actual != expected:
            raise RuntimeError(f"{package}: installed {actual}, expected {expected}")

    from faster_whisper import WhisperModel
    from vosk import Model, SetLogLevel

    SetLogLevel(-1)
    whisper = WhisperModel(
        WHISPER_REPO,
        revision=WHISPER_REVISION,
        device="cpu",
        compute_type="int8",
        cpu_threads=0,
        num_workers=1,
    )
    vosk = Model(str(args.vosk_model))

    rows = []
    if args.candidate_manifest:
        if not args.candidate_root:
            parser.error("--candidate-root is required with --candidate-manifest")
        candidate_manifest = read_json(args.candidate_manifest)
        if candidate_manifest.get("schemaVersion") != 1:
            raise RuntimeError("candidate manifest schema is unsupported")
        all_targets = []
        for item in candidate_manifest.get("items", []):
            clip = args.candidate_root / Path(item["clipFile"]).name
            if not clip.is_file():
                raise RuntimeError(f"{item['targetId']}: candidate file is missing")
            actual_sha = sha256(clip)
            if actual_sha != item["clipSha256"]:
                raise RuntimeError(
                    f"{item['targetId']}: candidate SHA-256 {actual_sha} does not match manifest {item['clipSha256']}"
                )
            all_targets.append(
                {
                    "targetId": item["targetId"],
                    "unitId": item["unitId"],
                    "entryId": item["entryId"],
                    "senseId": item["senseId"],
                    "accent": item["accent"],
                    "clipFile": item["clipFile"],
                    "expectedText": item["expectedText"],
                    "pronunciation": item["pronunciation"],
                    "path": clip,
                }
            )
        if not all_targets:
            raise RuntimeError("candidate recognition requires at least one candidate")
        scope_units = list(dict.fromkeys(target["unitId"] for target in all_targets))
        print(f"Certifying {len(all_targets)} isolated audio repair candidate(s).")
    else:
        all_targets = targets()
        scope_units = list(SCOPE_UNITS)
        print(f"Certifying {len(all_targets)} Unit 1-3 word/accent targets with independent offline recognizers.")
    for index, target in enumerate(all_targets, 1):
        raw = ffmpeg_pcm(target["path"])
        row = {
            key: target[key]
            for key in (
                "targetId",
                "unitId",
                "entryId",
                "senseId",
                "accent",
                "clipFile",
                "expectedText",
                "pronunciation",
            )
        }
        row["clipSha256"] = sha256(target["path"])
        row["signal"] = signal_stats(raw)
        row["whisper"] = whisper_transcript(whisper, target["path"])
        row["vosk"] = vosk_transcript(vosk, raw)
        row["alignment"] = forced_alignment(raw, target["expectedText"])
        rows.append(row)
        if index % 25 == 0 or index == len(all_targets):
            print(f"{index}/{len(all_targets)}")

    output = {
        "schemaVersion": 1,
        "evidenceVersion": "vajefy-audio-v1",
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "scope": {"units": scope_units},
        "sourceHashes": source_hashes,
        "systems": {
            "whisper": {
                "engine": "faster-whisper",
                "packageVersion": "1.2.1",
                "model": WHISPER_REPO,
                "modelVersion": WHISPER_REVISION,
                "modelSha256": None,
            },
            "vosk": {
                "engine": "vosk",
                "packageVersion": "0.3.45",
                "model": VOSK_MODEL,
                "modelVersion": "0.15",
                "modelSha256": archive_hash,
            },
            "alignment": {
                "engine": "pocketsphinx",
                "packageVersion": "5.1.1",
                "model": "bundled-en-us",
                "modelVersion": "pocketsphinx-5.1.1",
                "modelSha256": None,
            },
        },
        "clips": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(".tmp")
    temporary.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    temporary.replace(args.output)
    print(f"Wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
