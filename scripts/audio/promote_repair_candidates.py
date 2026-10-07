"""Promote only independently certified repair candidates into release audio.

Every promotion is bound to the source clip SHA recorded by the certificate and
to the candidate SHA evaluated by the independent recognizers. Quarantined
candidates are recorded in repair-log.json but never copied into public/audio.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "content" / "pilot" / "audio-manifest.json"
REPORT = ROOT / "content" / "pilot" / "audio-report.json"
LOG = ROOT / "content" / "assurance" / "audio" / "repair-log.json"
POLICY = ROOT / "content" / "assurance" / "audio" / "repair-policy.json"
PUBLIC_AUDIO = ROOT / "public" / "audio" / "pilot"


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf8"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def write_json(path: Path, value, indent: int) -> None:
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=indent) + "\n", encoding="utf8")
    temp.replace(path)


def referenced_audio(manifest: dict) -> set[str]:
    names: set[str] = set()
    for accents in manifest.get("senses", {}).values():
        for record in accents.values():
            word = record.get("word")
            if word and word.get("file"):
                names.add(Path(word["file"]).name)
            for example in record.get("examples", []):
                if example and example.get("file"):
                    names.add(Path(example["file"]).name)
    return names


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidates", type=Path, required=True)
    parser.add_argument("--result", type=Path, required=True)
    parser.add_argument("--candidate-root", type=Path, required=True)
    parser.add_argument("--repair-log", type=Path, default=LOG)
    args = parser.parse_args()

    candidates = read_json(args.candidates)
    result = read_json(args.result)
    log = read_json(args.repair_log)
    if (
        candidates.get("schemaVersion") != 1
        or result.get("schemaVersion") != 1
        or log.get("schemaVersion") != 1
    ):
        raise RuntimeError("unsupported audio repair schema")
    policy = candidates.get("policyVersion")
    if result.get("policyVersion") != policy or log.get("policyVersion") != policy:
        raise RuntimeError("audio repair policy versions differ")
    policy_sha256 = sha256(POLICY)
    recorded_policy_sha256 = log.get("policySha256")
    if recorded_policy_sha256 is not None and recorded_policy_sha256 != policy_sha256:
        raise RuntimeError("audio repair history belongs to different repair-policy.json bytes")
    if log.get("attempts") and recorded_policy_sha256 is None:
        raise RuntimeError("existing audio repair history is not bound to exact policy bytes")

    manifest = read_json(MANIFEST)
    report = read_json(REPORT)
    by_target = {item["targetId"]: item for item in candidates.get("items", [])}
    existing_attempts = {
        (item["targetId"], item["sourceClipSha256"], item["candidateId"]): item
        for item in log.get("attempts", [])
    }

    promoted = 0
    old_names: set[str] = set()
    for outcome in result.get("items", []):
        candidate = by_target.get(outcome["targetId"])
        if candidate is None:
            raise RuntimeError(f"{outcome['targetId']}: result has no candidate manifest record")
        if (
            outcome["sourceClipSha256"] != candidate["sourceClipSha256"]
            or outcome["candidateId"] != candidate["candidateId"]
            or outcome["candidateClipSha256"] != candidate["clipSha256"]
        ):
            raise RuntimeError(f"{outcome['targetId']}: result is detached from candidate/source identity")

        key = (candidate["targetId"], candidate["sourceClipSha256"], candidate["candidateId"])
        attempt = {
            "targetId": candidate["targetId"],
            "sourceClipSha256": candidate["sourceClipSha256"],
            "candidateId": candidate["candidateId"],
            "candidateClipSha256": candidate["clipSha256"],
            "at": result["evaluatedAt"],
            "outcome": outcome["outcome"],
            "blockers": outcome["blockers"],
        }
        previous = existing_attempts.get(key)
        if previous is not None and previous != attempt:
            raise RuntimeError(f"{candidate['targetId']}: repair attempt key already has different evidence")
        if previous is None:
            if log.get("policySha256") is None:
                log["policySha256"] = policy_sha256
            log.setdefault("attempts", []).append(attempt)
            existing_attempts[key] = attempt

        if outcome["outcome"] != "CERTIFIED":
            continue

        source = ROOT / "public" / "audio" / candidate["sourceClipFile"]
        if not source.is_file() or sha256(source) != candidate["sourceClipSha256"]:
            raise RuntimeError(f"{candidate['targetId']}: current source clip changed before promotion")

        generated = args.candidate_root / Path(candidate["clipFile"]).name
        if not generated.is_file() or sha256(generated) != candidate["clipSha256"]:
            raise RuntimeError(f"{candidate['targetId']}: certified candidate bytes are missing or changed")

        sense_audio = manifest.get("senses", {}).get(candidate["senseId"], {}).get(candidate["accent"])
        if not sense_audio or not sense_audio.get("word"):
            raise RuntimeError(f"{candidate['targetId']}: release manifest word record is missing")
        current_file = sense_audio["word"]["file"]
        if current_file != candidate["sourceClipFile"]:
            raise RuntimeError(f"{candidate['targetId']}: release manifest source changed before promotion")

        destination_name = Path(candidate["clipFile"]).name
        destination = PUBLIC_AUDIO / destination_name
        PUBLIC_AUDIO.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(generated, destination)
        if sha256(destination) != candidate["clipSha256"]:
            raise RuntimeError(f"{candidate['targetId']}: promoted bytes failed SHA-256 verification")

        old_names.add(Path(current_file).name)
        sense_audio["word"] = {
            "text": candidate["synthesisText"],
            "file": "pilot/" + destination_name,
        }
        manifest.setdefault("clips", {})[destination_name] = {
            **candidate["signal"],
            "bytes": destination.stat().st_size,
            "text": candidate["synthesisText"],
            "accent": candidate["accent"],
            "generation": candidate["generation"],
            "repairPolicyVersion": policy,
        }
        report["flagged"] = [
            flag
            for flag in report.get("flagged", [])
            if not (
                flag.get("sense") == candidate["senseId"]
                and flag.get("accent") == candidate["accent"]
                and flag.get("kind") == "word"
            )
        ]
        promoted += 1

    referenced = referenced_audio(manifest)
    for old_name in old_names:
        if old_name in referenced:
            continue
        manifest.get("clips", {}).pop(old_name, None)
        old_path = PUBLIC_AUDIO / old_name
        if old_path.exists():
            old_path.unlink()

    manifest["totalBytes"] = sum(
        int(metadata.get("bytes", 0)) for metadata in manifest.get("clips", {}).values()
    )
    log["attempts"] = sorted(
        log.get("attempts", []),
        key=lambda item: (
            item["targetId"],
            item["sourceClipSha256"],
            item["candidateId"],
        ),
    )

    write_json(MANIFEST, manifest, 1)
    write_json(REPORT, report, 1)
    write_json(args.repair_log, log, 2)
    print(
        f"Audio repair round recorded {len(result.get('items', []))} attempt(s); "
        f"{promoted} certified candidate(s) promoted."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
