"""Snapshot release audio and rollback promotions that fail the final corpus pass.

The isolated repair recognizers are necessary but not sufficient: every promoted
candidate must remain CERTIFIED when re-evaluated in the exact shipped corpus.
This script makes that final check transactional. It snapshots the scoped
pre-repair release, and after final certification restores only promoted
candidates that lost certification.

No rollback is inferred from filenames or timestamps. Every restoration is
bound to baseline certificate SHA-256, current certificate SHA-256 and the
recorded independently certified repair attempt.
"""

from __future__ import annotations

import argparse
import copy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import tempfile

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "content" / "pilot" / "audio-manifest.json"
REPORT = ROOT / "content" / "pilot" / "audio-report.json"
CERTIFICATES = ROOT / "content" / "assurance" / "audio" / "certificates.json"
REPAIR_LOG = ROOT / "content" / "assurance" / "audio" / "repair-log.json"
PUBLIC_AUDIO = ROOT / "public" / "audio"


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf8"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def write_json(path: Path, value, indent: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf8", dir=path.parent, delete=False
    ) as handle:
        handle.write(json.dumps(value, ensure_ascii=False, indent=indent) + "\n")
        temp = Path(handle.name)
    temp.replace(path)


def snapshot(snapshot_dir: Path) -> int:
    if snapshot_dir.exists():
        shutil.rmtree(snapshot_dir)
    (snapshot_dir / "audio").mkdir(parents=True)

    certificates = read_json(CERTIFICATES)
    if certificates.get("generatedAt") is None:
        raise RuntimeError("cannot snapshot pending audio certificates")
    if len(certificates.get("records", [])) != certificates.get("summary", {}).get("targets"):
        raise RuntimeError("baseline certificate record count does not match target count")

    shutil.copy2(MANIFEST, snapshot_dir / "audio-manifest.json")
    shutil.copy2(REPORT, snapshot_dir / "audio-report.json")
    shutil.copy2(CERTIFICATES, snapshot_dir / "certificates.json")

    copied: dict[str, str] = {}
    for record in certificates["records"]:
        file = record["clipFile"]
        expected = record["clipSha256"]
        source = PUBLIC_AUDIO / file
        if not source.is_file():
            raise RuntimeError(f"{record['targetId']}: baseline clip is missing: {file}")
        actual = sha256(source)
        if actual != expected:
            raise RuntimeError(
                f"{record['targetId']}: baseline clip SHA changed: {actual} != {expected}"
            )
        previous = copied.get(expected)
        if previous is None:
            target = snapshot_dir / "audio" / f"{expected}.mp3"
            shutil.copy2(source, target)
            copied[expected] = file
        elif previous != file:
            # Shared bytes are allowed; the SHA-bound backup is identical.
            pass

    print(
        f"Snapshotted {len(certificates['records'])} scoped targets "
        f"({len(copied)} unique MP3 payloads) before repair promotion."
    )
    return 0


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


def rollback(snapshot_dir: Path) -> int:
    baseline_certificates = read_json(snapshot_dir / "certificates.json")
    baseline_manifest = read_json(snapshot_dir / "audio-manifest.json")
    baseline_report = read_json(snapshot_dir / "audio-report.json")
    certificates = read_json(CERTIFICATES)
    manifest = read_json(MANIFEST)
    report = read_json(REPORT)
    repair_log = read_json(REPAIR_LOG)

    if certificates.get("generatedAt") is None:
        raise RuntimeError("cannot evaluate rollback against pending certificates")
    baseline_by_target = {
        item["targetId"]: item for item in baseline_certificates.get("records", [])
    }
    current_by_target = {
        item["targetId"]: item for item in certificates.get("records", [])
    }
    if set(baseline_by_target) != set(current_by_target):
        raise RuntimeError("final certificate target scope differs from the pre-repair snapshot")

    attempts = repair_log.get("attempts", [])
    final_failures = repair_log.setdefault("finalFailures", [])
    existing_failures = {
        (
            item["targetId"],
            item["sourceClipSha256"],
            item["candidateId"],
        ): item
        for item in final_failures
    }

    unstable: list[tuple[dict, dict, dict]] = []
    for current in certificates["records"]:
        if current["status"] == "CERTIFIED":
            continue
        matches = [
            attempt
            for attempt in attempts
            if attempt.get("targetId") == current["targetId"]
            and attempt.get("outcome") == "CERTIFIED"
            and attempt.get("candidateClipSha256") == current["clipSha256"]
        ]
        if not matches:
            continue
        if len(matches) != 1:
            raise RuntimeError(
                f"{current['targetId']}: final clip maps to {len(matches)} certified repair attempts"
            )
        baseline = baseline_by_target[current["targetId"]]
        attempt = matches[0]
        if baseline["clipSha256"] != attempt["sourceClipSha256"]:
            raise RuntimeError(
                f"{current['targetId']}: repair source does not match this run's baseline snapshot"
            )
        unstable.append((current, baseline, attempt))

    if not unstable:
        print("Final full-corpus pass found no unstable promoted candidates.")
        return 0

    candidate_names: set[str] = set()
    restored_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    for current, baseline, attempt in unstable:
        sense_id = baseline["senseId"]
        accent = baseline["accent"]
        baseline_word = (
            baseline_manifest.get("senses", {})
            .get(sense_id, {})
            .get(accent, {})
            .get("word")
        )
        if not baseline_word or not baseline_word.get("file"):
            raise RuntimeError(
                f"{current['targetId']}: baseline manifest word record is missing"
            )
        baseline_file = baseline_word["file"]
        baseline_name = Path(baseline_file).name
        backup = snapshot_dir / "audio" / f"{baseline['clipSha256']}.mp3"
        if not backup.is_file() or sha256(backup) != baseline["clipSha256"]:
            raise RuntimeError(
                f"{current['targetId']}: SHA-bound baseline backup is missing or changed"
            )

        current_word = (
            manifest.get("senses", {})
            .get(sense_id, {})
            .get(accent, {})
            .get("word")
        )
        if not current_word or current_word.get("file") != current["clipFile"]:
            raise RuntimeError(
                f"{current['targetId']}: current manifest is detached from final certificate"
            )
        candidate_names.add(Path(current["clipFile"]).name)

        destination = PUBLIC_AUDIO / baseline_file
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(backup, destination)
        if sha256(destination) != baseline["clipSha256"]:
            raise RuntimeError(f"{current['targetId']}: restored bytes failed SHA-256")

        manifest["senses"][sense_id][accent]["word"] = copy.deepcopy(baseline_word)
        baseline_clip = baseline_manifest.get("clips", {}).get(baseline_name)
        if baseline_clip is None:
            raise RuntimeError(
                f"{current['targetId']}: baseline clip metadata is missing"
            )
        manifest.setdefault("clips", {})[baseline_name] = copy.deepcopy(baseline_clip)

        report["flagged"] = [
            item
            for item in report.get("flagged", [])
            if not (
                item.get("sense") == sense_id
                and item.get("accent") == accent
                and item.get("kind") == "word"
            )
        ]
        report["flagged"].extend(
            copy.deepcopy(
                [
                    item
                    for item in baseline_report.get("flagged", [])
                    if item.get("sense") == sense_id
                    and item.get("accent") == accent
                    and item.get("kind") == "word"
                ]
            )
        )

        failure = {
            "targetId": current["targetId"],
            "sourceClipSha256": attempt["sourceClipSha256"],
            "candidateId": attempt["candidateId"],
            "candidateClipSha256": attempt["candidateClipSha256"],
            "at": restored_at,
            "blockers": current["blockers"],
        }
        key = (
            failure["targetId"],
            failure["sourceClipSha256"],
            failure["candidateId"],
        )
        previous = existing_failures.get(key)
        if previous is not None and previous != failure:
            raise RuntimeError(
                f"{current['targetId']}: final-pass failure key already has different evidence"
            )
        if previous is None:
            final_failures.append(failure)
            existing_failures[key] = failure

    referenced = referenced_audio(manifest)
    for candidate_name in candidate_names:
        if candidate_name in referenced:
            continue
        manifest.get("clips", {}).pop(candidate_name, None)
        candidate_file = PUBLIC_AUDIO / "pilot" / candidate_name
        if candidate_file.exists():
            candidate_file.unlink()

    manifest["totalBytes"] = sum(
        int(metadata.get("bytes", 0))
        for metadata in manifest.get("clips", {}).values()
    )
    report["flagged"] = sorted(
        report.get("flagged", []),
        key=lambda item: (
            item.get("sense", ""),
            item.get("accent", ""),
            item.get("kind", ""),
            item.get("file", ""),
        ),
    )
    repair_log["finalFailures"] = sorted(
        final_failures,
        key=lambda item: (
            item["targetId"],
            item["sourceClipSha256"],
            item["candidateId"],
        ),
    )

    write_json(MANIFEST, manifest, 1)
    write_json(REPORT, report, 1)
    write_json(REPAIR_LOG, repair_log, 2)
    print(
        f"Rolled back {len(unstable)} promoted candidate(s) that failed "
        "the final full-corpus certification pass."
    )
    return len(unstable)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["snapshot", "rollback"])
    parser.add_argument("--snapshot-dir", type=Path, required=True)
    parser.add_argument("--changed-marker", type=Path)
    args = parser.parse_args()
    snapshot_dir = args.snapshot_dir.resolve()
    if args.mode == "snapshot":
        return snapshot(snapshot_dir)
    rolled_back = rollback(snapshot_dir)
    if args.changed_marker:
        marker = args.changed_marker.resolve()
        if rolled_back:
            marker.parent.mkdir(parents=True, exist_ok=True)
            marker.write_text(str(rolled_back) + "\n", encoding="utf8")
        elif marker.exists():
            marker.unlink()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
