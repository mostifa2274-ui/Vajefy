import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const SCRIPT = path.join(process.cwd(), "scripts", "audio", "generate_audio.py");

function flag(text: string, synthesized: string, entry: string) {
  return {
    sense: `lex:A1:${text}`,
    accent: "gb",
    kind: "word",
    text,
    file: `${text}.mp3`,
    issues: [`pronunciation differs from IPA: synthesized /${synthesized}/, entry ${entry}`],
  };
}

test("re-checking pronunciation flags clears notation differences and keeps real ones", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "vajefy-audio-"));
  try {
    const report = path.join(dir, "audio-report.json");
    writeFileSync(
      report,
      JSON.stringify({
        model: "kokoro-v1.0",
        flagged: [
          // Notation only: a comma list of forms, syllabic consonants, the NEAR vowel, final happY.
          flag("a, an", "ˈeɪ, an", "/ə/, /ən/; stressed /eɪ/, /æn/"),
          flag("table", "tˈeɪbəl", "/ˈteɪbl/"),
          flag("personal", "pˈɜːsənəl", "/ˈpɜːsənl/"),
          flag("dear", "dˈiə", "/dɪə/"),
          flag("every", "ˈɛvɹɪ", "/ˈevri/"),
          // Real differences: a strong form against a weak one, a dropped /r/, a different vowel.
          flag("that", "ðˈat", "/ðət/"),
          flag("her", "hɜː", "/hɝː/"),
          flag("welcome", "wˈɛlkʌm", "/ˈwelkəm/"),
          { sense: "lex:A1:go", accent: "us", kind: "word", text: "go", file: "go.mp3", issues: ["too short"] },
        ],
      }),
    );
    const result = spawnSync("python3", ["-I", SCRIPT, "--rescore", "--report", report], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /9 flagged before, 4 after/);
    const kept = JSON.parse(readFileSync(report, "utf8")).flagged.map((item: { text: string }) => item.text);
    assert.deepEqual(kept, ["that", "her", "welcome", "go"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
