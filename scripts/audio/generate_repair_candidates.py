"""Generate one bounded repair candidate per planned audio target.

Candidates are written outside public/audio. They are not shippable artifacts:
independent recognition and the TypeScript certificate authority must certify a
candidate before the promotion script may copy it into the product.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
from pathlib import Path
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
ENHANCED = ROOT / "content" / "compiled" / "enhanced.json"
POLICY = ROOT / "content" / "assurance" / "audio" / "repair-policy.json"

# Reuse the production normalisation/encoding path so candidate and release
# signal statistics have identical semantics.
from generate_audio import process, faults  # noqa: E402


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf8"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def candidate_name(policy: dict, item: dict, synthesis_text: str, is_phonemes: bool) -> str:
    candidate = item["candidate"]
    key = json.dumps(
        [
            policy["policyVersion"],
            policy["model"]["name"],
            policy["model"]["modelSha256"],
            policy["model"]["voicesSha256"],
            candidate["id"],
            candidate["voice"],
            candidate["lang"],
            candidate["speed"],
            policy["model"]["bitrate"],
            "phonemes" if is_phonemes else "text",
            synthesis_text,
        ],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return hashlib.sha256(key.encode("utf8")).hexdigest()[:24] + ".mp3"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--models", type=Path, required=True)
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    policy = read_json(POLICY)
    plan = read_json(args.plan)
    if plan.get("schemaVersion") != 1 or plan.get("policyVersion") != policy.get("policyVersion"):
        raise RuntimeError("repair plan does not match the frozen policy")

    model_file = args.models / policy["model"]["modelFile"]
    voices_file = args.models / policy["model"]["voicesFile"]
    if sha256(model_file) != policy["model"]["modelSha256"]:
        raise RuntimeError("Kokoro model SHA-256 differs from repair policy")
    if sha256(voices_file) != policy["model"]["voicesSha256"]:
        raise RuntimeError("Kokoro voices SHA-256 differs from repair policy")

    installed = importlib.metadata.version("kokoro-onnx")
    if installed != policy["model"]["packageVersion"]:
        raise RuntimeError(
            f"kokoro-onnx {installed} installed; repair policy requires {policy['model']['packageVersion']}"
        )
    if policy["model"]["bitrate"] != "40k":
        raise RuntimeError("candidate generator currently supports only the frozen 40k release encoding")

    enhanced = read_json(ENHANCED)
    entries = {entry["id"]: entry for entry in enhanced["entries"]}

    import soundfile as sf
    from kokoro_onnx import Kokoro

    kokoro = Kokoro(str(model_file), str(voices_file))
    args.out_dir.mkdir(parents=True, exist_ok=True)
    items = []

    try:
        for planned in plan.get("items", []):
            entry = entries.get(planned["entryId"])
            if entry is None:
                raise RuntimeError(f"{planned['targetId']}: enhanced entry is missing")
            if entry["headword"] != planned["expectedText"]:
                raise RuntimeError(
                    f"{planned['targetId']}: repair expected text must equal the learner-facing headword"
                )
            sense = next((row for row in entry["senses"] if row["id"] == planned["senseId"]), None)
            if sense is None:
                raise RuntimeError(f"{planned['targetId']}: enhanced sense is missing")
            accent = planned["accent"]
            configured = next(
                (
                    row
                    for row in policy["candidates"][accent]
                    if row["id"] == planned["candidate"]["id"]
                ),
                None,
            )
            if configured is None or configured != planned["candidate"]:
                raise RuntimeError(f"{planned['targetId']}: candidate differs from frozen policy")

            tts = (sense.get("tts") or {}).get(accent)
            synthesis_text = tts or entry["headword"]
            is_phonemes = bool(tts)
            name = candidate_name(policy, planned, synthesis_text, is_phonemes)
            target = args.out_dir / name

            samples, rate = kokoro.create(
                synthesis_text,
                voice=configured["voice"],
                speed=configured["speed"],
                lang=configured["lang"],
                is_phonemes=is_phonemes,
            )
            with tempfile.TemporaryDirectory() as temp:
                raw = Path(temp) / "raw.wav"
                sf.write(raw, samples, rate)
                stats = process(raw, target)

            items.append(
                {
                    "targetId": planned["targetId"],
                    "unitId": planned["unitId"],
                    "entryId": planned["entryId"],
                    "senseId": planned["senseId"],
                    "accent": accent,
                    "sourceClipFile": planned["sourceClipFile"],
                    "sourceClipSha256": planned["sourceClipSha256"],
                    "candidateId": configured["id"],
                    "expectedText": planned["expectedText"],
                    "pronunciation": planned["pronunciation"],
                    "synthesisText": synthesis_text,
                    "isPhonemes": is_phonemes,
                    "clipFile": "candidates/" + name,
                    "clipSha256": sha256(target),
                    "signal": stats,
                    "generation": {
                        "model": policy["model"]["name"],
                        "modelSha256": policy["model"]["modelSha256"],
                        "voicesSha256": policy["model"]["voicesSha256"],
                        "packageVersion": policy["model"]["packageVersion"],
                        "voice": configured["voice"],
                        "lang": configured["lang"],
                        "speed": configured["speed"],
                        "bitrate": policy["model"]["bitrate"],
                    },
                    "issues": faults(stats, "word"),
                }
            )
    finally:
        voices = getattr(kokoro, "voices", None)
        close = getattr(voices, "close", None)
        if callable(close):
            close()

    output = {
        "schemaVersion": 1,
        "policyVersion": policy["policyVersion"],
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "items": items,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(f"Generated {len(items)} isolated repair candidate(s) in {args.out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
