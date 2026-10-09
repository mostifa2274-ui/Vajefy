import type { IndependentNgslSelection } from "./rights-independent-ngsl";

export type NgslEditorialDraft = {
  selectionId: string; lemma: string; sourceRank: number;
  partOfSpeech: string; meaningEn: string; meaningFa: string; usageFa: string;
  examples: { en: string; fa: string }[];
  editorialState: "STAGING_ONLY_AI_DRAFT_UNREVIEWED";
  semanticApproved: false; persianApproved: false; cefrApproved: false;
  rightsCleared: false; publicRelease: false;
};

export type NgslDraftManifest = {
  schemaVersion: 1;
  status: "STAGING_ONLY_AI_AUTHORED_LESSONS_NOT_INDEPENDENTLY_VERIFIED";
  selection: string;
  authoringMethod: "MODEL_AUTHORED_FROM_SOURCE_LEMMAS_NO_LEGACY_TEXT_IMPORT";
  authoringAgent: string;
  count: 20;
  semanticallyReviewed: 0; persianReviewed: 0; cefrReviewed: 0;
  rightsCleared: 0; publiclyReleased: 0;
  lessons: NgslEditorialDraft[];
};

/** List source-pinned 20-item draft files without accepting skipped or malformed ranges. */
export function ngslDraftBatchFiles(files: readonly string[]): {
  filenames: string[];
  issues: string[];
} {
  const issues: string[] = [];
  const first = "independent-first-20-drafts.json";
  if (!files.includes(first)) issues.push("Missing NGSL first-20 draft batch");
  const ranges: { name: string; start: number; end: number }[] = [];
  for (const name of files) {
    if (!name.startsWith("independent-ranks-")) continue;
    const match = /^independent-ranks-(\d+)-(\d+)-drafts\.json$/.exec(name);
    if (!match) {
      issues.push("Malformed NGSL draft batch name: " + name);
      continue;
    }
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
        end !== start + 19 || start < 21 || end > 900) {
      issues.push("Invalid NGSL 20-item rank interval: " + name);
      continue;
    }
    ranges.push({ name, start, end });
  }
  ranges.sort((a, b) => a.start - b.start || a.name.localeCompare(b.name));
  let expected = 21;
  for (const range of ranges) {
    if (range.start !== expected) {
      issues.push("Missing, overlapping or out-of-order NGSL rank interval: expected " +
        expected + " but found " + range.start);
    }
    expected = range.end + 1;
  }
  return {
    filenames: files.includes(first) ? [first, ...ranges.map(x => x.name)] : ranges.map(x => x.name),
    issues,
  };
}

const faLetters = /[آ-ی]/u;
const normalize = (s: string) =>
  s.replace(/ي/g, "ی").replace(/ك/g, "ک")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ").trim();

function overlapsDraft(
  text: string,
  inherited: readonly string[],
  tokenThreshold: number,
): boolean {
  const words = normalize(text).split(" ").filter(Boolean);
  if (words.length < tokenThreshold) return false;
  const inheritedText = inherited.map(s => " " + normalize(s) + " ");
  for (let i = 0; i <= words.length - tokenThreshold; i++) {
    const phrase = " " + words.slice(i, i + tokenThreshold).join(" ") + " ";
    if (inheritedText.some(x => x.includes(phrase))) return true;
  }
  return false;
}

/**
 * Structural and long-phrase reuse guard only, never semantic/legal approval.
 * The source-first selection is generated separately without legacy input.
 */
export function auditUnreviewedNgslDrafts(
  raw: NgslDraftManifest,
  selected: IndependentNgslSelection,
  inheritedEnglish: readonly string[] = [],
  inheritedPersian: readonly string[] = [],
): string[] {
  const issues: string[] = [];
  if (selected.status !== "STAGING_ONLY_NOT_A1_ASSESSED_NOT_RIGHTS_CLEARED" ||
      selected.selected !== 900 || selected.releasedItems !== 0 ||
      selected.rightsClearedItems !== 0) {
    issues.push("NGSL selection was not in pinned unapproved staging state");
  }
  if (raw.schemaVersion !== 1 ||
      raw.status !== "STAGING_ONLY_AI_AUTHORED_LESSONS_NOT_INDEPENDENTLY_VERIFIED" ||
      raw.selection !== "content/rights-staging/ngsl-1.2/independent-first-900-selection.json" ||
      raw.authoringMethod !== "MODEL_AUTHORED_FROM_SOURCE_LEMMAS_NO_LEGACY_TEXT_IMPORT" ||
      !raw.authoringAgent.trim() ||
      raw.count !== 20 || raw.lessons?.length !== 20 ||
      raw.semanticallyReviewed !== 0 || raw.persianReviewed !== 0 ||
      raw.cefrReviewed !== 0 || raw.rightsCleared !== 0 || raw.publiclyReleased !== 0) {
    issues.push("NGSL drafted content is not exactly 20 unreviewed, unreleased lessons");
  }
  if (!Array.isArray(raw.lessons)) return issues;
  const seen = new Set<string>();
  for (const [i, item] of raw.lessons.entries()) {
    const source = selected.entries[i];
    if (!source || !item || item.selectionId !== source.selectionId ||
        item.sourceRank !== source.sourceRank || item.lemma !== source.lemma ||
        seen.has(item.selectionId)) {
      issues.push("Missing, out-of-order or wrongly sourced lesson " + (i + 1));
      continue;
    }
    seen.add(item.selectionId);
    if (item.editorialState !== "STAGING_ONLY_AI_DRAFT_UNREVIEWED" ||
        item.semanticApproved !== false || item.persianApproved !== false ||
        item.cefrApproved !== false || item.rightsCleared !== false ||
        item.publicRelease !== false) {
      issues.push(item.selectionId + ": unauthorized approval or release");
    }
    if (![item.partOfSpeech, item.meaningEn, item.meaningFa, item.usageFa]
      .every(x => typeof x === "string" && x.trim())) {
      issues.push(item.selectionId + ": missing editorial field");
    } else if (!faLetters.test(item.meaningFa) || !faLetters.test(item.usageFa)) {
      issues.push(item.selectionId + ": missing Persian explanatory text");
    }
    if (!Array.isArray(item.examples) || item.examples.length !== 2) {
      issues.push(item.selectionId + ": two independently authored examples required");
      continue;
    }
    for (const [j, e] of item.examples.entries()) {
      if (!e || !e.en?.trim() || !e.fa?.trim() || !faLetters.test(e.fa)) {
        issues.push(item.selectionId + ": malformed bilingual example " + j);
        continue;
      }
      if (overlapsDraft(e.en, inheritedEnglish, 9) ||
          overlapsDraft(e.fa, inheritedPersian, 9)) {
        issues.push(item.selectionId + ": long verbatim overlap with legacy text at example " + j);
      }
    }
  }
  return issues;
}
