#!/usr/bin/env python3
"""Stage *independent* WordNet candidates; never relicense the existing corpus.

The English WordNet 2025 WNDB release has an index.sense file with corpus
tag-frequency counts. This script reads ONLY that independently obtained
archive. It does not read Oxford, Vajefy's legacy A1 roster, or generated
learner content. A ranked candidate is not automatically an A1 word, nor
a cleared Vajefy lesson. A separate editorial/licence gate is mandatory.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
from zipfile import BadZipFile, ZipFile

SOURCE_URL = "https://en-word.net/static/english-wordnet-2025.zip"
SOURCE_RELEASE = "OEWN 2025 (WNDB, 2025-12-31)"
SOURCE_LICENSE_URL = "https://github.com/globalwordnet/english-wordnet/blob/main/LICENSE.md"
PRINCETON_LICENSE_URL = "https://wordnet.princeton.edu/license-and-commercial-use"
CC_BY_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
MAX_ARCHIVE_BYTES = 100 * 1024 * 1024
MAX_INDEX_BYTES = 40 * 1024 * 1024
SENSE_RE = re.compile(r"^([a-z]+(?:-[a-z]+)?)%([1-5]):[0-9]{2}:[0-9]{2}:[^ ]*$")
POS = {"1": "noun", "2": "verb", "3": "adjective", "4": "adverb", "5": "adjective"}


def fingerprint(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as inp:
        for block in iter(lambda: inp.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def read_sense_index(archive: Path) -> list[str]:
    if not archive.is_file() or archive.stat().st_size > MAX_ARCHIVE_BYTES:
        raise ValueError("Missing, empty or oversized official WordNet archive")
    if archive.stat().st_size == 0:
        raise ValueError("Empty WordNet archive")
    try:
        with ZipFile(archive) as zipfile:
            candidates = [member for member in zipfile.infolist()
                          if member.filename.split("/")[-1] == "index.sense"
                          and not member.is_dir()]
            if len(candidates) != 1:
                raise ValueError("Expected exactly one WNDB index.sense file")
            member = candidates[0]
            if member.file_size > MAX_INDEX_BYTES:
                raise ValueError("WNDB index.sense exceeds safe size")
            data = zipfile.read(member)
    except BadZipFile as exc:
        raise ValueError("Not a valid WNDB zip archive") from exc
    try:
        return data.decode("utf-8").splitlines()
    except UnicodeDecodeError as exc:
        raise ValueError("Invalid index.sense UTF-8") from exc


def rank_lemmas(lines: list[str], limit: int) -> list[dict[str, object]]:
    # Aggregate usage tags for every lemma/POS solely from independent OEWN
    # sense-index evidence. This is an ordering heuristic, NOT CEFR grading.
    groups: dict[tuple[str, str], dict[str, object]] = {}
    for line in lines:
        parts = line.strip().split()
        if len(parts) != 4 or not parts[1].isdigit() or not parts[2].isdigit():
            continue
        hit = SENSE_RE.fullmatch(parts[0])
        if not hit:
            continue  # Skip proper nouns, phrases, symbols and inflected noise.
        lemma, type_code = hit.groups()
        pos = POS[type_code]
        tag_count = int(parts[3]) if parts[3].isdigit() else -1
        if tag_count < 0:
            continue
        key = lemma, pos
        row = groups.setdefault(key, {
            "lemma": lemma, "partOfSpeech": pos, "taggedOccurrences": 0,
            "senseCount": 0, "wordNetSenseKey": "",
            "topSenseTaggedOccurrences": -1,
        })
        row["taggedOccurrences"] = int(row["taggedOccurrences"]) + tag_count
        row["senseCount"] = int(row["senseCount"]) + 1
        if (tag_count, parts[0]) > (
            int(row["topSenseTaggedOccurrences"]), str(row["wordNetSenseKey"])
        ):
            row["topSenseTaggedOccurrences"] = tag_count
            row["wordNetSenseKey"] = parts[0]
    # OEWN 2025's WNDB index.sense can contain ZERO tag counts across the
    # entire distribution. Zero means there is no observed tag-frequency
    # evidence in this source, not that the lemma should be discarded. The
    # earlier positive-only filter silently rejected every official lemma.
    # Polysemy is only a deterministic ordering proxy, never frequency/CEFR.
    ranked = sorted(groups.values(), key=lambda item: (
        -int(item["taggedOccurrences"]), -int(item["senseCount"]),
        str(item["lemma"]), str(item["partOfSpeech"]),
    ))
    output = []
    for row in ranked:
        if len(output) >= limit:
            break
        output.append({
            "lemma": row["lemma"],
            "partOfSpeech": row["partOfSpeech"],
            "wordNetSenseKey": row["wordNetSenseKey"],
            "taggedOccurrences": row["taggedOccurrences"],
            "senseCount": row["senseCount"],
            "status": "AWAITING_A1_EDITORIAL_REVIEW",
        })
    return output


def staging_manifest(archive: Path, expected_sha256: str | None,
                     limit: int) -> dict[str, object]:
    observed = fingerprint(archive)
    if expected_sha256 and observed != expected_sha256.lower():
        raise ValueError("Source archive SHA-256 does not match reviewed fingerprint")
    items = rank_lemmas(read_sense_index(archive), limit)
    if not items:
        raise ValueError("No usable lemma candidates in source archive")
    return {
        "schemaVersion": 1,
        "status": "STAGING_ONLY_UNREVIEWED_NOT_RELEASE_CLEARED",
        "independentSourceId": "oewn-2025-wndb",
        "sourceName": SOURCE_RELEASE,
        "sourceUrl": SOURCE_URL,
        "sourceArchiveSha256": observed,
        "sourceArchivePreviouslyPinned": bool(expected_sha256),
        "selection": (
            "Descending WNDB index.sense tagged occurrences, then sense count, "
            "then alphabetic lemma/POS. Zero tag counts are retained. "
            "Sense count is NOT corpus frequency, popularity or CEFR evidence."
        ),
        "tagCountEvidence": (
            "present" if any(item["taggedOccurrences"] > 0 for item in items)
            else "absent-or-zero-for-selected-candidates"
        ),
        "licenses": [
            {"owner": "Open English WordNet team", "license": "CC BY 4.0",
             "noticeUrl": SOURCE_LICENSE_URL, "licenseUrl": CC_BY_LICENSE_URL},
            {"owner": "Princeton University WordNet", "license": "WordNet License",
             "noticeUrl": PRINCETON_LICENSE_URL},
        ],
        "requiredBeforeAnyRelease": [
            "Independently choose and review A1 level/sense suitability",
            "Author and verify all new Persian and English teaching text independently",
            "Record the actual source rights and transformation for every final item",
            "Comply with both upstream licence notices and attribution",
            "Pass all existing per-artifact Gate 0 evidence and SHA-256 checks",
        ],
        "candidateCount": len(items),
        "candidates": items,
    }


def safe_staging_destination(target: Path) -> None:
    root = Path(__file__).resolve().parents[2]
    absolute = target.resolve()
    for protected in ("content/pilot", "content/assurance", "public", "src"):
        protected_dir = (root / protected).resolve()
        if absolute == protected_dir or protected_dir in absolute.parents:
            raise ValueError("Refusing to write candidate data into app/source/release assets: " + str(target))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True,
                        help="Manually downloaded official OEWN 2025 WNDB zip (not Oxford)")
    parser.add_argument("--expected-sha256",
                        help="Previously reviewed SHA-256 of exact OEWN 2025 archive")
    parser.add_argument("--output", type=Path, required=True,
                        help="Staging JSON only, outside public/content/pilot")
    parser.add_argument("--limit", type=int, default=250,
                        help="Number of unreviewed candidates, 1..1000")
    args = parser.parse_args()
    if not 1 <= args.limit <= 1000:
        parser.error("--limit must be from 1 to 1000")
    if args.expected_sha256 and not re.fullmatch(r"[0-9a-fA-F]{64}", args.expected_sha256):
        parser.error("--expected-sha256 must be exactly 64 hex digits")
    try:
        safe_staging_destination(args.output)
        report = staging_manifest(args.archive, args.expected_sha256, args.limit)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                               encoding="utf-8")
    except (OSError, ValueError) as exc:
        print("Independent source intake failed safely: " + str(exc), file=sys.stderr)
        return 1
    print("Staged " + str(report["candidateCount"]) +
          " independent WordNet candidates; NOT CEFR-qualified and NOT Gate 0 cleared.")
    print("Source SHA-256: " + str(report["sourceArchiveSha256"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
