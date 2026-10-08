"""Synthetic, network-free regression tests for independent OEWN intake."""
from pathlib import Path
from tempfile import TemporaryDirectory
import hashlib
import json
import subprocess
import sys
import unittest
from zipfile import ZipFile

from oewn_candidates import (
    read_sense_index, rank_lemmas, safe_staging_destination,
    staging_manifest,
)

SCRIPT = Path(__file__).resolve().with_name("oewn_candidates.py")
INDEX = "\n".join([
    "dog%1:05:00:: 02084071 1 42",
    "dog%1:05:01:: 02084072 2 5",
    "cat%1:05:00:: 02121620 1 31",
    "run%2:38:00:: 01926311 1 17",
    "long_phrase%1:00:00:: 00000000 1 999",  # not single-word
    "Capital%1:00:00:: 00000001 1 900",  # no proper-name contamination
    "other%3:00:00:: 00000001 1 nope",
    "",
])


class IndependentSourceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.archive = self.root / "english-wordnet-2025.zip"
        with ZipFile(self.archive, "w") as bundle:
            bundle.writestr("english-wordnet-2025/dict/index.sense", INDEX)

    def test_rank_uses_only_wordnet_frequency_not_legacy_roster(self):
        rows = rank_lemmas(read_sense_index(self.archive), 10)
        self.assertEqual([item["lemma"] for item in rows], ["dog", "cat", "run"])
        self.assertEqual(rows[0]["taggedOccurrences"], 47)
        self.assertEqual(rows[0]["wordNetSenseKey"], "dog%1:05:00::")
        self.assertEqual(rows[0]["status"], "AWAITING_A1_EDITORIAL_REVIEW")

    def test_official_style_zero_tag_counts_do_not_erase_all_candidates(self):
        # The real OEWN 2025 archive reports records like:
        # "'hood%1:14:01:: 07568727 1 0".
        # Zero tagged occurrences are *not* an A1 rating or evidence of
        # nonexistent words; the importer must preserve review candidates.
        zero_archive = self.root / "zero-tags.zip"
        index = "\n".join([
            "book%1:10:00:: 00000001 1 0",
            "book%1:10:01:: 00000002 2 0",
            "tree%1:20:00:: 00000003 1 0",
            "walk%2:38:00:: 00000004 1 0",
            "'hood%1:14:01:: 00000005 1 0",
            "two_words%1:10:00:: 00000006 1 0",
            "",
        ])
        with ZipFile(zero_archive, "w") as archive:
            archive.writestr("oewn2025/index.sense", index)
        rows = rank_lemmas(read_sense_index(zero_archive), 3)
        self.assertEqual([row["lemma"] for row in rows], ["book", "tree", "walk"])
        self.assertTrue(all(row["taggedOccurrences"] == 0 for row in rows))
        report = staging_manifest(zero_archive, hashlib.sha256(zero_archive.read_bytes()).hexdigest(), 3)
        self.assertEqual(report["tagCountEvidence"], "absent-or-zero-for-selected-candidates")
        self.assertEqual(report["candidateCount"], 3)
        self.assertIn("NOT corpus frequency", report["selection"])
        self.assertEqual(report["status"], "STAGING_ONLY_UNREVIEWED_NOT_RELEASE_CLEARED")

    def test_archive_fingerprint_and_upstream_notices_are_preserved(self):
        digest = hashlib.sha256(self.archive.read_bytes()).hexdigest()
        report = staging_manifest(self.archive, digest, 2)
        self.assertEqual(report["sourceArchiveSha256"], digest)
        self.assertEqual(report["candidateCount"], 2)
        self.assertTrue(report["sourceArchivePreviouslyPinned"])
        self.assertIn("NOT_RELEASE_CLEARED", report["status"])
        self.assertEqual({x["owner"] for x in report["licenses"]},
                         {"Open English WordNet team", "Princeton University WordNet"})

    def test_unpinned_source_cannot_be_mistaken_for_checked_source(self):
        report = staging_manifest(self.archive, None, 1)
        self.assertFalse(report["sourceArchivePreviouslyPinned"])
        self.assertEqual(report["candidates"][0]["lemma"], "dog")

    def test_wrong_archive_hash_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "SHA-256"):
            staging_manifest(self.archive, "0" * 64, 2)

    def test_invalid_zip_missing_index_is_rejected(self):
        bad = self.root / "bad.zip"
        with ZipFile(bad, "w") as z:
            z.writestr("docs/README", "not an index")
        with self.assertRaisesRegex(ValueError, "exactly one"):
            read_sense_index(bad)

    def test_no_staging_output_into_public_app_data(self):
        app_root = SCRIPT.resolve().parents[2]
        with self.assertRaisesRegex(ValueError, "Refusing"):
            safe_staging_destination(app_root / "public/data/lex-a1.json")
        safe_staging_destination(self.root / "candidate.json")

    def test_cli_creates_staging_json_only(self):
        output = self.root / "staging" / "oewn.json"
        cmd = [sys.executable, str(SCRIPT), "--archive", str(self.archive),
               "--output", str(output), "--limit", "3"]
        p = subprocess.run(cmd, capture_output=True, text=True)
        self.assertEqual(p.returncode, 0, p.stderr)
        report = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(report["candidateCount"], 3)
        self.assertIn("NOT CEFR-qualified", p.stdout)
        wrong = subprocess.run([*cmd, "--expected-sha256", "0" * 64],
                               capture_output=True, text=True)
        self.assertNotEqual(wrong.returncode, 0)


if __name__ == "__main__":
    unittest.main()
