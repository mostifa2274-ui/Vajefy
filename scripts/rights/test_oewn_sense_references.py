"""Synthetic, offline regressions for exact pinned WordNet sense resolution."""
import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from zipfile import ZipFile

from oewn_sense_references import source_references, STAGING


class WordnetSourceSenseTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.archive = self.root / "oewn.zip"
        with ZipFile(self.archive, "w") as bundle:
            bundle.writestr("wordnet/index.sense",
                            "dog%1:05:00:: 00000001 1 0\nrun%2:38:00:: 00000002 1 0\n")
            bundle.writestr("wordnet/data.noun",
                            "00000001 05 n 02 dog 0 domestic_dog 0 0 | a common household canine\n")
            bundle.writestr("wordnet/data.verb",
                            "00000002 38 v 01 run 0 0 | to move at a fast pace\n")
        self.intake = {
            "sourceArchiveSha256": hashlib.sha256(self.archive.read_bytes()).hexdigest(),
            "status": "STAGING_ONLY_UNREVIEWED_NOT_RELEASE_CLEARED",
            "candidateCount": 2,
            "candidates": [
                {"lemma": "dog", "partOfSpeech": "noun", "wordNetSenseKey": "dog%1:05:00::"},
                {"lemma": "run", "partOfSpeech": "verb", "wordNetSenseKey": "run%2:38:00::"},
            ],
        }

    def test_matching_source_is_staged_not_approved(self):
        manifest = source_references(self.archive, self.intake)
        self.assertEqual(manifest["status"], STAGING)
        self.assertEqual(manifest["candidateCount"], 2)
        self.assertEqual(manifest["references"][0]["sourceGloss"], "a common household canine")
        self.assertEqual(manifest["references"][0]["synsetMembers"], ["dog", "domestic dog"])
        self.assertEqual(manifest["references"][0]["reviewStatus"],
                         "SOURCE_SENSE_NOT_YET_EDITORIALLY_VERIFIED")
        self.assertEqual(manifest["references"][1]["dataFile"], "data.verb")
        self.assertIn("wordnet.princeton.edu", str(manifest["licenseNotices"]))

    def test_rejects_wrong_archive(self):
        self.intake["sourceArchiveSha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "archive hash mismatch"):
            source_references(self.archive, self.intake)

    def test_rejects_fabricated_sense_key(self):
        self.intake["candidates"][0]["wordNetSenseKey"] = "dog%1:05:99::"
        with self.assertRaisesRegex(ValueError, "sense keys missing"):
            source_references(self.archive, self.intake)

    def test_adjective_member_syntactic_marker_matches_bare_sense_lemma(self):
        sat = self.root / "satellite.zip"
        with ZipFile(sat, "w") as bundle:
            bundle.writestr("dict/index.sense", "clear%5:00:02:free:00 00000001 1 0\\n")
            bundle.writestr("dict/data.adj",
                            "00000001 00 s 01 clear(p) 0 0 | not blocked\\n")
        self.intake["sourceArchiveSha256"] = hashlib.sha256(sat.read_bytes()).hexdigest()
        self.intake["candidates"] = [{
            "lemma": "clear", "partOfSpeech": "adjective",
            "wordNetSenseKey": "clear%5:00:02:free:00",
        }]
        self.intake["candidateCount"] = 1
        report = source_references(sat, self.intake)
        self.assertEqual(report["references"][0]["synsetMembers"], ["clear(p)"])
        self.assertEqual(report["references"][0]["sourceGloss"], "not blocked")

    def test_rejects_wrong_synset_member(self):
        bad = self.root / "altered.zip"
        with ZipFile(bad, "w") as bundle:
            bundle.writestr("index.sense", "dog%1:05:00:: 00000001 1 0\n")
            bundle.writestr("data.noun", "00000001 05 n 01 cat 0 0 | wrong source\n")
        self.intake["sourceArchiveSha256"] = hashlib.sha256(bad.read_bytes()).hexdigest()
        self.intake["candidates"] = self.intake["candidates"][:1]
        self.intake["candidateCount"] = 1
        with self.assertRaisesRegex(ValueError, "lemma missing"):
            source_references(bad, self.intake)

    def test_rejects_duplicate_ambiguous_reference(self):
        self.intake["candidates"].append(dict(self.intake["candidates"][0]))
        self.intake["candidateCount"] = 3
        with self.assertRaisesRegex(ValueError, "duplicate WordNet sense keys"):
            source_references(self.archive, self.intake)


if __name__ == "__main__":
    unittest.main()
