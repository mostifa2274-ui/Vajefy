/**
 * Staging-only lexical candidates. These checks detect several kinds of
 * mistaken source/content reuse; they never grant redistribution permission,
 * certify clean-room authorship, or approve CEFR/translation accuracy.
 */
export type IndependentWordnetCandidate = {
  lemma: string;
  partOfSpeech: string;
  wordNetSenseKey: string;
};
export type StagedTeachingDraft = {
  candidate: IndependentWordnetCandidate;
  editorialStatus: string;
  levelHypothesis: string;
  sourceSenseMatch: string;
  reuseLegacyContent: boolean;
  selectionRationale: string;
  authoredTeaching: {
    meaningEn: string;
    meaningFa: string;
    examples: { en: string; fa: string }[];
  };
};

export type DraftManifest = {
  schemaVersion: number;
  status: string;
  sourceManifest: string;
  sourceArchiveSha256: string;
  authorship: string;
  creationPolicy: string;
  requiredReviews: string[];
  draftCount: number;
  drafts: StagedTeachingDraft[];
};

const ascii = (s: string) => s
  .toLowerCase()
  .normalize("NFKC")
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");
const persian = (s: string) => s.replace(/\s+/g, " ").trim();
// Detect *long* Persian phrase transplants embedded in a modified example.
// Normalizing Arabic variants and punctuation prevents trivial evasion;
// the ten-token threshold avoids treating ordinary short expressions
// (e.g. «من به خانه می‌روم») as evidence of copying.
const persianNgrams = (text: string, n: number): string[] => {
  const tokens = text.normalize("NFKC")
    .replace(/[يى]/g, "ی").replace(/ك/g, "ک")
    .replace(/[^\p{L}\p{N}\u200c]+/gu, " ")
    .trim().split(/\s+/u).filter(Boolean);
  return Array.from({ length: Math.max(0, tokens.length - n + 1) }, (_, i) =>
    tokens.slice(i, i + n).join(" "));
};
const sha256 = /^[a-f0-9]{64}$/;
const persianGlyph = /[\u0600-\u06ff]/u;
const englishGlyph = /[a-z]/i;

function ngrams(line: string, n: number): string[] {
  const tokens = ascii(line).split(" ").filter(Boolean);
  return Array.from({ length: Math.max(0, tokens.length - n + 1) }, (_, i) =>
    tokens.slice(i, i + n).join(" "));
}

export function draftAudit(
  data: DraftManifest,
  independentCandidates: ReadonlyMap<string, IndependentWordnetCandidate>,
  sourceArchiveSha256: string,
  inheritedEnglish: readonly string[],
  inheritedPersian: readonly string[],
): string[] {
  const errors: string[] = [];
  if (data?.schemaVersion !== 1 || data.status !== "STAGING_ONLY_NOT_PUBLIC_NOT_RIGHTS_CLEARED") {
    errors.push("Independent draft manifest must remain staging-only and unapproved.");
  }
  if (!sha256.test(data.sourceArchiveSha256 ?? "") || data.sourceArchiveSha256 !== sourceArchiveSha256) {
    errors.push("Independent source archive hash must match the pinned upstream intake.");
  }
  if (data.sourceManifest !== "content/rights-staging/oewn-2025-candidates.json") {
    errors.push("Unexpected independent source manifest.");
  }
  if (!data.authorship?.trim() || !data.creationPolicy?.trim() ||
      !Array.isArray(data.requiredReviews) || data.requiredReviews.length < 3) {
    errors.push("Drafts need explicit non-clearance authoring and review requirements.");
  }
  if (!Array.isArray(data.drafts) || !data.drafts.length) {
    errors.push("Draft count mismatch or empty draft list.");
    return errors;
  }
  if (data.draftCount !== data.drafts.length) {
    errors.push("Draft count mismatch or empty draft list.");
    // Continue inspecting actual draft entries; a count mismatch must not
    // obscure duplicate items or inherited-content reuse in the same run.
  }

  const knownEnglish = new Set(inheritedEnglish.map(ascii).filter(Boolean));
  const knownPersian = new Set(inheritedPersian.map(persian).filter(Boolean));
  const legacyLongPhrases = new Set(inheritedEnglish.flatMap(line => ngrams(line, 8)));
  const legacyPersianLongPhrases = new Set(inheritedPersian.flatMap(line => persianNgrams(line, 10)));
  const seen = new Set<string>();
  const draftSentences = new Set<string>();
  for (const [i, row] of data.drafts.entries()) {
    const key = `${row.candidate?.lemma}|${row.candidate?.partOfSpeech}`;
    const upstream = independentCandidates.get(key);
    if (!upstream || upstream.wordNetSenseKey !== row.candidate?.wordNetSenseKey) {
      errors.push(`draft[${i}]: source lemma/POS/sense key is absent or altered in pinned WordNet intake.`);
    }
    if (seen.has(key)) errors.push(`draft[${i}]: duplicate lemma/POS.`);
    seen.add(key);
    if (row.editorialStatus !== "DRAFT_NEEDS_HUMAN_PEDAGOGY_RIGHTS_AND_SENSE_REVIEW" ||
        row.levelHypothesis !== "A1_UNVERIFIED" ||
        row.sourceSenseMatch !== "NOT_YET_VERIFIED" ||
        row.reuseLegacyContent !== false) {
      errors.push(`draft[${i}]: unverified editorial/sense/rights boundaries were relaxed.`);
    }
    if (!row.selectionRationale?.trim() ||
        !row.authoredTeaching?.meaningEn?.trim() ||
        !persianGlyph.test(row.authoredTeaching?.meaningFa ?? "")) {
      errors.push(`draft[${i}]: missing editorial rationale or bilingual meaning.`);
    }
    const examples = row.authoredTeaching?.examples;
    if (!Array.isArray(examples) || examples.length !== 2) {
      errors.push(`draft[${i}]: exactly two independent example drafts required.`);
      continue;
    }
    for (const [j, ex] of examples.entries()) {
      const en = ascii(ex?.en ?? "");
      const fa = persian(ex?.fa ?? "");
      if (!englishGlyph.test(en) || en.split(" ").length < 5 ||
          !persianGlyph.test(fa) || fa.length < 10) {
        errors.push(`draft[${i}].examples[${j}]: invalid or too-short bilingual example.`);
      }
      if (draftSentences.has(en)) errors.push(`draft[${i}].examples[${j}]: duplicate draft example.`);
      draftSentences.add(en);
      if (knownEnglish.has(en) || knownPersian.has(fa)) {
        errors.push(`draft[${i}].examples[${j}]: verbatim example matches inherited content.`);
      }
      if (ngrams(ex?.en ?? "", 8).some(segment => legacyLongPhrases.has(segment))) {
        errors.push(`draft[${i}].examples[${j}]: eight-word sequence reused from inherited content.`);
      }
      if (persianNgrams(ex?.fa ?? "", 10).some(segment => legacyPersianLongPhrases.has(segment))) {
        errors.push(`draft[${i}].examples[${j}]: ten-word Persian sequence reused from inherited content.`);
      }
    }
  }
  return errors;
}


/** Source-only OEWN evidence, never a legal, CEFR or semantic approval. */
export type OewnSenseReference = {
  candidate: IndependentWordnetCandidate;
  dataFile: string;
  synsetOffset: string;
  senseNumber: number;
  tagCount: number;
  synsetMembers: string[];
  sourceGloss: string;
  glossSha256: string;
  reviewStatus: string;
};

export type OewnSenseReferenceManifest = {
  schemaVersion: number;
  status: string;
  sourceManifest: string;
  sourceArchiveSha256: string;
  sourceUrl: string;
  licenseNotices: string[];
  legalStatus: string;
  candidateCount: number;
  references: OewnSenseReference[];
};

/**
 * SHA validates internal consistency with the pinned intake; the one-use
 * GitHub generation run separately verified the official archive SHA.
 * An accurate WordNet synset match does not mean the draft teaches that
 * synset's sense, nor that the text is A1-ready.
 */
export function auditOewnSenseReferences(
  manifest: OewnSenseReferenceManifest,
  candidates: readonly IndependentWordnetCandidate[],
  pinnedArchiveSha256: string,
  digest: (content: string) => string,
): string[] {
  const errors: string[] = [];
  if (manifest.schemaVersion !== 1 ||
      manifest.status !== "STAGING_ONLY_LEXICAL_SOURCE_NOT_RELEASE_CLEARED" ||
      manifest.sourceManifest !== "content/rights-staging/oewn-2025-candidates.json") {
    errors.push("OEWN lexical reference evidence must remain in staging only.");
  }
  if (manifest.sourceArchiveSha256 !== pinnedArchiveSha256 || !sha256.test(pinnedArchiveSha256)) {
    errors.push("Source references must be bound to the pinned OEWN archive SHA-256.");
  }
  if (manifest.sourceUrl !== "https://en-word.net/static/english-wordnet-2025.zip") {
    errors.push("OEWN source archive URL mismatch.");
  }
  if (!manifest.legalStatus?.includes("No rights or CEFR approvals") ||
      !Array.isArray(manifest.licenseNotices) ||
      !manifest.licenseNotices.some(v => v.includes("globalwordnet/english-wordnet")) ||
      !manifest.licenseNotices.some(v => v.includes("wordnet.princeton.edu"))) {
    errors.push("Both upstream licence notices and non-clearance disclaimer are required.");
  }
  if (!Array.isArray(manifest.references) ||
      manifest.candidateCount !== candidates.length ||
      manifest.references.length !== candidates.length) {
    errors.push("Staged reference count does not match the pinned candidate intake.");
    if (!Array.isArray(manifest.references)) return errors;
  }
  const wanted = new Map(candidates.map(v => [v.lemma + "|" + v.partOfSpeech, v]));
  const seen = new Set<string>();
  for (const [index, record] of manifest.references.entries()) {
    const key = record.candidate?.lemma + "|" + record.candidate?.partOfSpeech;
    const candidate = wanted.get(key);
    if (seen.has(key)) errors.push("Duplicate lexical reference " + key);
    seen.add(key);
    if (!candidate || candidate.wordNetSenseKey !== record.candidate?.wordNetSenseKey) {
      errors.push("Reference[" + index + "] is not the exact pinned candidate sense key.");
    }
    const expectedFile: Record<string, string> = {
      noun: "data.noun", verb: "data.verb",
      adjective: "data.adj", adverb: "data.adv",
    };
    if (record.dataFile !== expectedFile[record.candidate?.partOfSpeech] ||
        !/^[0-9]{8}$/.test(record.synsetOffset ?? "") ||
        !Number.isInteger(record.senseNumber) || record.senseNumber < 1 ||
        !Number.isInteger(record.tagCount) || record.tagCount < 0) {
      errors.push("Reference[" + index + "] has invalid WNDB coordinates.");
    }
    const members = record.synsetMembers;
    if (!Array.isArray(members) || members.length === 0 ||
        !members.some(m => typeof m === "string" &&
          m.toLowerCase().replace(/\((?:a|p|ip)\)$/, "") === record.candidate?.lemma)) {
      errors.push("Reference[" + index + "] excludes the claimed WordNet lemma.");
    }
    if (!record.sourceGloss?.trim() ||
        !sha256.test(record.glossSha256 ?? "") ||
        record.glossSha256 !== digest(record.sourceGloss ?? "")) {
      errors.push("Reference[" + index + "] has a missing or altered source gloss.");
    }
    if (record.reviewStatus !== "SOURCE_SENSE_NOT_YET_EDITORIALLY_VERIFIED") {
      errors.push("Reference[" + index + "] improperly claims a reviewed or approved source sense.");
    }
  }
  for (const candidate of candidates) {
    if (!seen.has(candidate.lemma + "|" + candidate.partOfSpeech)) {
      errors.push("Missing source sense evidence: " + candidate.wordNetSenseKey);
    }
  }
  return errors;
}
