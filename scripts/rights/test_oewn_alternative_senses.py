"""Offline adversarial tests for independently sourced, unapproved OEWN sense options."""
import copy
import hashlib
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from zipfile import ZipFile

import oewn_alternative_senses as alt


class AlternativeSenseTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.archive = Path(self.temp.name) / "upstream.zip"
        with ZipFile(self.archive, "w") as bundle:
            bundle.writestr("wndb/index.sense",
                "run%2:38:00:: 00000001 1 0\nrun%2:42:00:: 00000002 2 0\n")
            bundle.writestr("wndb/data.verb",
                "00000001 38 v 01 run 0 0 | move fast on foot\n"
                "00000002 42 v 01 run 0 0 | manage an organization\n")
        self.pin = alt.SOURCE_PIN
        alt.SOURCE_PIN = hashlib.sha256(self.archive.read_bytes()).hexdigest()
        self.addCleanup(lambda: setattr(alt, "SOURCE_PIN", self.pin))
        self.candidate = {"lemma": "run", "partOfSpeech": "verb", "wordNetSenseKey": "run%2:42:00::"}
        self.drafts = {
            "status": "STAGING_ONLY_NOT_PUBLIC_NOT_RIGHTS_CLEARED",
            "sourceArchiveSha256": alt.SOURCE_PIN,
            "draftCount": 1,
            "drafts": [{
                "candidate": self.candidate,
                "authoredTeaching": {"meaningEn": "move fast using your legs"},
            }],
        }
        gloss = "manage an organization"
        self.references = {
            "status": "STAGING_ONLY_LEXICAL_SOURCE_NOT_RELEASE_CLEARED",
            "sourceArchiveSha256": alt.SOURCE_PIN,
            "candidateCount": 1,
            "references": [{
                "candidate": self.candidate,
                "synsetOffset": "00000002",
                "senseNumber": 2,
                "tagCount": 0,
                "synsetMembers": ["run"],
                "sourceGloss": gloss,
                "glossSha256": hashlib.sha256(gloss.encode()).hexdigest(),
            }],
        }

    def test_unapproved_alternatives_include_original_and_first_sense(self):
        report = alt.build_manifest(self.archive, self.drafts, self.references)
        self.assertEqual(report["draftCount"], 1)
        self.assertEqual(report["selectedSenseCount"], 0)
        self.assertEqual(report["approvedCount"], 0)
        row = report["entries"][0]
        self.assertIsNone(row["selectedSenseKey"])
        self.assertFalse(row["approved"])
        self.assertEqual(row["editorialMeaningEn"], "move fast using your legs")
        self.assertEqual([s["senseNumber"] for s in row["alternatives"]], [1, 2])
        self.assertEqual(row["alternatives"][0]["sourceGloss"], "move fast on foot")
        self.assertEqual(row["alternatives"][1]["wordNetSenseKey"], self.candidate["wordNetSenseKey"])

    def test_source_archive_must_match_pinned_sha(self):
        self.archive.write_bytes(b"forged archive")
        with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
            alt.build_manifest(self.archive, self.drafts, self.references)

    def test_cannot_invent_approval_or_selection(self):
        report = alt.build_manifest(self.archive, self.drafts, self.references)
        for key, value in [("approvedCount", 1), ("selectedSenseCount", 1)]:
            forged = copy.deepcopy(report)
            forged[key] = value
            with self.assertRaisesRegex(ValueError, "approvals"):
                alt.validate_manifest(forged, self.drafts, self.references)
        forged = copy.deepcopy(report)
        forged["entries"][0]["selectedSenseKey"] = "run%2:38:00::"
        with self.assertRaisesRegex(ValueError, "approval"):
            alt.validate_manifest(forged, self.drafts, self.references)

    def test_forged_source_gloss_and_missing_original_are_rejected(self):
        report = alt.build_manifest(self.archive, self.drafts, self.references)
        edited = copy.deepcopy(report)
        edited["entries"][0]["alternatives"][0]["sourceGloss"] = "altered"
        with self.assertRaisesRegex(ValueError, "digest"):
            alt.validate_manifest(edited, self.drafts, self.references)
        edited = copy.deepcopy(report)
        edited["entries"][0]["alternatives"] = edited["entries"][0]["alternatives"][:1]
        edited["entries"][0]["availableSenseCount"] = 1
        with self.assertRaisesRegex(ValueError, "Original exact pinned sense"):
            alt.validate_manifest(edited, self.drafts, self.references)

    def test_draft_meaning_and_manifest_cannot_drift(self):
        report = alt.build_manifest(self.archive, self.drafts, self.references)
        edited = copy.deepcopy(report)
        edited["entries"][0]["editorialMeaningEn"] = "something else"
        with self.assertRaisesRegex(ValueError, "meaning changed"):
            alt.validate_manifest(edited, self.drafts, self.references)
        edited = copy.deepcopy(report)
        edited["sourceArchiveSha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "coordinates changed"):
            alt.validate_manifest(edited, self.drafts, self.references)


if __name__ == "__main__":
    unittest.main()
