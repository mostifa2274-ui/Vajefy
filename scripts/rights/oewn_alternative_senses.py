#!/usr/bin/env python3
"""Enumerate alternative OEWN 2025 senses for independent A1 editorial drafts.

Uses only the SHA-pinned official WNDB archive and independent staging drafts.
All senses stay unreviewed. Neither a WordNet sense rank nor a good-looking
English gloss establishes CEFR A1, accurate Persian, or redistribution clearance.
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
from oewn_sense_references import archive_member, POS, CODE, INDEX_LIMIT, DATA_LIMIT

STAGING = "STAGING_ONLY_ALTERNATIVE_SENSES_NOT_APPROVED"
REVIEW = "NEEDS_INDEPENDENT_LEXICAL_SENSE_AND_A1_REVIEW"
SOURCE_URL = "https://en-word.net/static/english-wordnet-2025.zip"
SOURCE_PIN = "38b16326159f51853626b7d24a44c453fa88ab33f06fce5ec8fc5996d1c2be93"
DRAFT_FILE = "content/rights-staging/independent-a1-editorial-drafts.json"
REFERENCE_FILE = "content/rights-staging/oewn-2025-sense-references.json"
LICENSE_FILE = "content/rights-staging/OEWN-2025-LICENSE.md"


def ident(candidate: dict) -> tuple[str, str, str]:
    return (candidate["lemma"], candidate["partOfSpeech"], candidate["wordNetSenseKey"])


def validate_manifest(output: dict, drafts: dict, reference: dict) -> None:
    """Offline, fail-closed structure/hash checks; not a substitute for source review."""
    if output.get("schemaVersion") != 1 or output.get("status") != STAGING:
        raise ValueError("Alternative senses must remain unapproved staging")
    if (output.get("sourceArchiveSha256") != SOURCE_PIN or
            output.get("sourceUrl") != SOURCE_URL or
            output.get("draftManifest") != DRAFT_FILE or
            output.get("sourceReferenceManifest") != REFERENCE_FILE or
            output.get("licenseFile") != LICENSE_FILE):
        raise ValueError("Pinned upstream source or attribution coordinates changed")
    if drafts.get("status") != "STAGING_ONLY_NOT_PUBLIC_NOT_RIGHTS_CLEARED":
        raise ValueError("Source draft roster is not staged")
    if reference.get("status") != "STAGING_ONLY_LEXICAL_SOURCE_NOT_RELEASE_CLEARED":
        raise ValueError("Original source references are not staged")
    if (drafts.get("sourceArchiveSha256") != SOURCE_PIN or
            reference.get("sourceArchiveSha256") != SOURCE_PIN):
        raise ValueError("Source archive hashes differ from exact pinned OEWN edition")
    draft_rows = drafts.get("drafts", [])
    reference_rows = reference.get("references", [])
    if (not draft_rows or len(draft_rows) != drafts.get("draftCount") or
            len(reference_rows) != reference.get("candidateCount")):
        raise ValueError("Draft/source reference counts are inconsistent")
    originals = {ident(item["candidate"]): item for item in reference_rows}
    if len(originals) != len(reference_rows):
        raise ValueError("Duplicate original pinned source sense")
    result = output.get("entries")
    if not isinstance(result, list) or len(result) != len(draft_rows) or output.get("draftCount") != len(draft_rows):
        raise ValueError("Exactly one alternative-sense group is required per independent draft")
    if output.get("selectedSenseCount") != 0 or output.get("approvedCount") != 0:
        raise ValueError("Generated source catalogue cannot claim selections or approvals")
    seen = set()
    for draft, group in zip(draft_rows, result):
        key = ident(draft["candidate"])
        if key in seen:
            raise ValueError("Duplicate independent draft")
        seen.add(key)
        if group.get("candidate") != draft["candidate"]:
            raise ValueError("Alternative group does not match the original draft key/order")
        if group.get("editorialMeaningEn") != draft["authoredTeaching"]["meaningEn"]:
            raise ValueError("Draft teaching meaning changed without independent review")
        if (group.get("reviewStatus") != REVIEW or
                group.get("selectedSenseKey") is not None or
                group.get("approved") is not False):
            raise ValueError("Unexpected sense-selection or approval claim")
        candidates = group.get("alternatives")
        if not isinstance(candidates, list) or not candidates:
            raise ValueError("Every draft must have pinned WordNet alternatives")
        senses = set()
        for row in candidates:
            sk = row.get("wordNetSenseKey")
            if not isinstance(sk, str) or sk in senses:
                raise ValueError("Missing or duplicate alternative sense key")
            senses.add(sk)
            if (row.get("partOfSpeech") != key[1] or
                    row.get("lemma") != key[0] or
                    row.get("dataFile") != POS[key[1]]):
                raise ValueError("Alternative sense lemma/POS/source-file mismatch")
            if (not isinstance(row.get("senseNumber"), int) or row["senseNumber"] < 1 or
                    not re.fullmatch(r"[0-9]{8}", str(row.get("synsetOffset"))) or
                    not isinstance(row.get("tagCount"), int) or row["tagCount"] < 0):
                raise ValueError("Malformed WNDB sense index evidence")
            gloss = row.get("sourceGloss")
            if (not isinstance(gloss, str) or not gloss.strip() or
                    hashlib.sha256(gloss.encode("utf-8")).hexdigest() != row.get("glossSha256")):
                raise ValueError("Altered or missing upstream synset gloss digest")
            if row.get("reviewStatus") != "SOURCE_SENSE_NOT_YET_EDITORIALLY_VERIFIED":
                raise ValueError("Alternative source reference must remain unreviewed")
        source = originals.get(key)
        matching = [row for row in candidates if row["wordNetSenseKey"] == key[2]]
        if not source or len(matching) != 1:
            raise ValueError("Original exact pinned sense absent from alternatives")
        for field in ("synsetOffset", "senseNumber", "tagCount", "sourceGloss", "glossSha256", "synsetMembers"):
            if matching[0].get(field) != source.get(field):
                raise ValueError("Alternative's original WNDB source reference diverged: " + field)
        if len(candidates) != group.get("availableSenseCount"):
            raise ValueError("Alternative-sense group count inconsistent")


def build_manifest(archive: Path, drafts: dict, reference: dict) -> dict:
    if fingerprint(archive) != SOURCE_PIN:
        raise ValueError("OEWN archive SHA-256 mismatch")
    wanted = {(d["candidate"]["lemma"], d["candidate"]["partOfSpeech"]) for d in drafts["drafts"]}
    by_key: dict[tuple[str, str], list[tuple[str, int, int, int]]] = {key: [] for key in wanted}
    with ZipFile(archive) as bundle:
        for line in archive_member(bundle, "index.sense", INDEX_LIMIT).decode("utf-8").splitlines():
            parts = line.split()
            if len(parts) != 4 or "%" not in parts[0] or not all(x.isdigit() for x in parts[1:]):
                continue
            lemma, rest = parts[0].split("%", 1)
            pos = CODE.get(rest[:1])
            key = (lemma.replace("_", " "), pos)
            if key in by_key:
                by_key[key].append((parts[0], int(parts[1]), int(parts[2]), int(parts[3])))
        if any(not vals for vals in by_key.values()):
            raise ValueError("Missing draft lemma/POS in pinned source index")
        offsets_by_file: dict[str, set[int]] = {}
        for (_, pos), rows in by_key.items():
            offsets_by_file.setdefault(POS[pos], set()).update(r[1] for r in rows)
        records: dict[tuple[str, int], tuple[list[str], str]] = {}
        for datafile, offsets in offsets_by_file.items():
            for line in archive_member(bundle, datafile, DATA_LIMIT).decode("utf-8").splitlines():
                prefix, separator, gloss = line.partition(" | ")
                parts = prefix.split()
                if not separator or len(parts) < 5 or not re.fullmatch(r"[0-9]{8}", parts[0]):
                    continue
                offset = int(parts[0])
                if offset not in offsets:
                    continue
                if (datafile, offset) in records:
                    raise ValueError("Duplicate synset offset in pinned source")
                count = int(parts[3], 16)
                if len(parts) < 4 + 2 * count:
                    raise ValueError("Malformed WNDB source member count")
                members = [parts[4 + 2 * k].replace("_", " ") for k in range(count)]
                records[(datafile, offset)] = (members, gloss)
        entries = []
        for draft in drafts["drafts"]:
            c = draft["candidate"]
            key = (c["lemma"], c["partOfSpeech"])
            alternatives = []
            for sense_key, offset, ordinal, tag_count in sorted(by_key[key], key=lambda r: (r[2], r[0])):
                datafile = POS[key[1]]
                if (datafile, offset) not in records:
                    raise ValueError("Index.sense points to missing pinned synset")
                members, gloss = records[(datafile, offset)]
                bare_members = [re.sub(r"\((?:a|p|ip)\)$", "", w.lower()) for w in members]
                if key[0] not in bare_members:
                    raise ValueError("Draft lemma missing from pinned synset member list")
                alternatives.append({
                    "lemma": key[0], "partOfSpeech": key[1],
                    "wordNetSenseKey": sense_key, "dataFile": datafile,
                    "synsetOffset": f"{offset:08d}", "senseNumber": ordinal,
                    "tagCount": tag_count, "synsetMembers": members,
                    "sourceGloss": gloss,
                    "glossSha256": hashlib.sha256(gloss.encode("utf-8")).hexdigest(),
                    "reviewStatus": "SOURCE_SENSE_NOT_YET_EDITORIALLY_VERIFIED",
                })
            entries.append({
                "candidate": c,
                "editorialMeaningEn": draft["authoredTeaching"]["meaningEn"],
                "reviewStatus": REVIEW,
                "selectedSenseKey": None,
                "approved": False,
                "availableSenseCount": len(alternatives),
                "alternatives": alternatives,
            })
    result = {
        "schemaVersion": 1,
        "status": STAGING,
        "sourceUrl": SOURCE_URL,
        "sourceArchiveSha256": SOURCE_PIN,
        "draftManifest": DRAFT_FILE,
        "sourceReferenceManifest": REFERENCE_FILE,
        "licenseFile": LICENSE_FILE,
        "draftCount": len(entries),
        "selectedSenseCount": 0,
        "approvedCount": 0,
        "entries": entries,
    }
    validate_manifest(result, drafts, reference)
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--drafts", type=Path, default=Path(DRAFT_FILE))
    parser.add_argument("--references", type=Path, default=Path(REFERENCE_FILE))
    parser.add_argument("--archive", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--check", type=Path)
    args = parser.parse_args()
    try:
        if (args.archive is None) == (args.check is None):
            raise ValueError("Supply exactly one of --archive and --check")
        drafts = json.loads(args.drafts.read_text(encoding="utf-8"))
        source = json.loads(args.references.read_text(encoding="utf-8"))
        if args.check:
            result = json.loads(args.check.read_text(encoding="utf-8"))
            validate_manifest(result, drafts, source)
        else:
            if args.output is None:
                raise ValueError("--archive requires an output file")
            safe_staging_destination(args.output)
            result = build_manifest(args.archive, drafts, source)
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except (ValueError, OSError, KeyError, TypeError, UnicodeError) as exc:
        print("Unapproved OEWN alternative-sense evidence FAILED: " + str(exc), file=sys.stderr)
        return 1
    print("Unapproved source senses: " + str(result["draftCount"]) +
          " independently drafted items, " +
          str(sum(e["availableSenseCount"] for e in result["entries"])) +
          " possible OEWN senses; 0 chosen, 0 approved. Gate 0 BLOCKED.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
