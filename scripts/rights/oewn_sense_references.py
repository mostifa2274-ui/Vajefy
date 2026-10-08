#!/usr/bin/env python3
"""Resolve pinned OEWN 2025 candidate sense keys to real WNDB synset glosses.

This is *staging-only source evidence*, not A1 sense approval, translation
validation, clean-room verification, or rights clearance. Never read legacy
Vajefy content to infer which WordNet sense a candidate should have.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
from zipfile import ZipFile

from oewn_candidates import fingerprint, safe_staging_destination

PINNED_SOURCE = "https://en-word.net/static/english-wordnet-2025.zip"
STAGING = "STAGING_ONLY_LEXICAL_SOURCE_NOT_RELEASE_CLEARED"
INDEX_LIMIT = 40 * 1024 * 1024
DATA_LIMIT = 30 * 1024 * 1024
POS = {
    "noun": "data.noun",
    "verb": "data.verb",
    "adjective": "data.adj",
    "adverb": "data.adv",
}
CODE = {"1": "noun", "2": "verb", "3": "adjective", "4": "adverb", "5": "adjective"}


def archive_member(bundle: ZipFile, name: str, limit: int) -> bytes:
    matching = [m for m in bundle.infolist()
                if m.filename.split("/")[-1] == name and not m.is_dir()]
    if len(matching) != 1 or matching[0].file_size > limit:
        raise ValueError("Expected exactly one size-bounded " + name + " in pinned WNDB")
    return bundle.read(matching[0])


def source_references(archive: Path, intake: dict) -> dict:
    sha = fingerprint(archive)
    if sha != intake["sourceArchiveSha256"]:
        raise ValueError("Pinned source archive hash mismatch")
    if intake.get("status") != "STAGING_ONLY_UNREVIEWED_NOT_RELEASE_CLEARED":
        raise ValueError("Input candidates have been promoted out of unreviewed staging")
    candidates = intake["candidates"]
    if not candidates or len(candidates) != intake["candidateCount"]:
        raise ValueError("Invalid source-candidate roster")
    wanted = {item["wordNetSenseKey"] for item in candidates}
    if len(wanted) != len(candidates):
        raise ValueError("Ambiguous duplicate WordNet sense keys")
    with ZipFile(archive) as bundle:
        index = {}
        for line in archive_member(bundle, "index.sense", INDEX_LIMIT).decode("utf-8").splitlines():
            parts = line.split()
            if len(parts) == 4 and parts[0] in wanted:
                if parts[0] in index:
                    raise ValueError("Duplicate source sense key " + parts[0])
                if not all(x.isdigit() for x in parts[1:]):
                    raise ValueError("Malformed index.sense coordinates " + parts[0])
                index[parts[0]] = (int(parts[1]), int(parts[2]), int(parts[3]))
        if set(index) != wanted:
            raise ValueError("Pinned source sense keys missing: " + ", ".join(sorted(wanted - set(index))[:8]))
        data = {}
        for part in sorted({POS[item["partOfSpeech"]] for item in candidates}):
            by_offset = {}
            blob = archive_member(bundle, part, DATA_LIMIT)
            for line in blob.decode("utf-8").splitlines():
                prefix, separator, gloss = line.partition(" | ")
                parts = prefix.split()
                if not separator or not parts or not re.fullmatch(r"[0-9]{8}", parts[0]):
                    continue
                offset = int(parts[0])
                if offset in by_offset:
                    raise ValueError("Duplicate WNDB offset " + part + ":" + str(offset))
                by_offset[offset] = (parts, gloss)
            data[part] = by_offset

    records = []
    for item in candidates:
        key = item["wordNetSenseKey"]
        lemma = item["lemma"]
        pos = item["partOfSpeech"]
        parts = key.split("%", 1)
        if len(parts) != 2 or not parts[1] or CODE.get(parts[1][0]) != pos:
            raise ValueError("Candidate POS and WNDB sense key disagree: " + key)
        offset, sense_number, tag_count = index[key]
        datafile = POS[pos]
        if offset not in data[datafile]:
            raise ValueError("Missing synset offset for " + key)
        synset, gloss = data[datafile][offset]
        if len(synset) < 5 or synset[2] not in ("n", "v", "a", "s", "r"):
            raise ValueError("Malformed WNDB synset for " + key)
        actual = "adjective" if synset[2] in ("a", "s") else CODE.get(
            {"n": "1", "v": "2", "r": "4"}.get(synset[2], ""),
        )
        if actual != pos or int(synset[0]) != offset:
            raise ValueError("Synset part of speech/offset mismatch for " + key)
        try:
            count = int(synset[3], 16)
            words = [synset[4 + k * 2].replace("_", " ") for k in range(count)]
        except (ValueError, IndexError) as exc:
            raise ValueError("Malformed synset member list for " + key) from exc
        if lemma not in [w.lower() for w in words]:
            raise ValueError("Sense-key lemma missing from source synset for " + key)
        if not gloss.strip() or len(gloss) > 10000:
            raise ValueError("Missing or excessive WordNet source gloss " + key)
        records.append({
            "candidate": {
                "lemma": lemma, "partOfSpeech": pos, "wordNetSenseKey": key,
            },
            "dataFile": datafile,
            "synsetOffset": f"{offset:08d}",
            "senseNumber": sense_number,
            "tagCount": tag_count,
            "synsetMembers": words,
            "sourceGloss": gloss,
            "glossSha256": hashlib.sha256(gloss.encode("utf-8")).hexdigest(),
            "reviewStatus": "SOURCE_SENSE_NOT_YET_EDITORIALLY_VERIFIED",
        })
    return {
        "schemaVersion": 1,
        "status": STAGING,
        "sourceManifest": "content/rights-staging/oewn-2025-candidates.json",
        "sourceArchiveSha256": sha,
        "sourceUrl": PINNED_SOURCE,
        "licenseNotices": [
            "https://github.com/globalwordnet/english-wordnet/blob/main/LICENSE.md",
            "https://wordnet.princeton.edu/license-and-commercial-use",
            "https://creativecommons.org/licenses/by/4.0/",
        ],
        "legalStatus": "No rights or CEFR approvals. Princeton WordNet notice and OEWN CC BY 4.0 attribution must accompany any reproduced glossary.",
        "candidateCount": len(records),
        "references": records,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--intake", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        safe_staging_destination(args.output)
        data = json.loads(args.intake.read_text(encoding="utf-8"))
        report = source_references(args.archive, data)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    except (ValueError, KeyError, OSError, UnicodeError) as exc:
        print("Pinned OEWN sense-reference generation rejected: " + str(exc), file=sys.stderr)
        return 1
    print("Source synsets located for " + str(report["candidateCount"]) +
          " lexical candidates. All editorial reviews and Gate 0 remain BLOCKED.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
