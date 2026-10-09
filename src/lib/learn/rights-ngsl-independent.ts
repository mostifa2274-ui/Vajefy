/**
 * A completely separate, NGSL-only lexical selection STAGING artefact.
 * It does not read, match or adapt Oxford/legacy entries. Frequency is NOT
 * a CEFR, sense, translation, licence-clearance or release judgment.
 */
export const NGSL_CORE_GIT_BLOB = "b8705be6c208bbee4450a208eb39a5be4dea8f63";
export const NGSL_LICENSE_GIT_BLOB = "2d58298e6eda10e7204abb52722efbc840db2390";
export const NGSL_INDEPENDENT_STATUS =
  "STAGING_ONLY_INDEPENDENT_NGSL_FREQUENCY_SELECTION_NOT_RELEASE_APPROVED" as const;
export const NGSL_REVIEW_STATUS =
  "A1_CEFR_SENSE_AND_PEDAGOGY_NOT_REVIEWED" as const;

type IndependentOptions = { sourceRows?: number; selectedRows?: number };

export function buildIndependentNgslSelection(
  coreCsv: string,
  options: IndependentOptions = {},
) {
  const sourceRows = options.sourceRows ?? 2809;
  const selectedRows = options.selectedRows ?? 900;
  if (!Number.isInteger(sourceRows) || !Number.isInteger(selectedRows) ||
      sourceRows < selectedRows || selectedRows < 1) {
    throw new Error("Invalid independent selection size");
  }
  const lines = coreCsv.trim().split(/\r?\n/);
  if (lines.shift() !== "word,rank" || lines.length !== sourceRows) {
    throw new Error("Invalid or incomplete pinned NGSL core CSV");
  }
  const seen = new Set<string>();
  const rows = lines.map((line, index) => {
    const match = /^([^,\r\n]+),(\d+)$/.exec(line);
    if (!match || Number(match[2]) !== index + 1) {
      throw new Error("NGSL core rank/header drift at source row " + (index + 1));
    }
    const lemma = match[1]!.trim();
    const key = lemma.toLowerCase().normalize("NFKC");
    if (!lemma || seen.has(key)) {
      throw new Error("Blank or duplicate NGSL source lemma at rank " + (index + 1));
    }
    seen.add(key);
    return { lemma, rank: index + 1 };
  });

  return {
    schemaVersion: 1 as const,
    status: NGSL_INDEPENDENT_STATUS,
    purpose: "Independently generated candidate vocabulary selection from pinned NGSL core ranks, NOT the inherited Oxford A1 roster.",
    license: "CC BY-SA 4.0" as const,
    source: {
      title: "New General Service List",
      edition: "1.2",
      url: "https://www.newgeneralservicelist.com/new-general-service-list",
      coreCsv: "content/rights-staging/ngsl-1.2/core.csv",
      coreGitBlobSha1: NGSL_CORE_GIT_BLOB,
      licenseNotice: "content/rights-staging/ngsl-1.2/CC-BY-SA-4.0-LICENSE.txt",
      licenseGitBlobSha1: NGSL_LICENSE_GIT_BLOB,
      attribution: "Browne, Charles; Culligan, Brent; and Phillips, Joseph. New General Service List 1.2 (2023).",
    },
    selectionMethod: "top-900-frequency-ranks-from-pinned-NGSL-core-only" as const,
    selectedCount: selectedRows,
    independentlyApprovedCount: 0 as const,
    sourcePermissionAppliedToLegacyContent: false as const,
    candidates: rows.slice(0, selectedRows).map(({ lemma, rank }) => ({
      candidateId: "ngsl-1.2-core-" + String(rank).padStart(4, "0"),
      lemma,
      ngslCoreRank: rank,
      reviewStatus: NGSL_REVIEW_STATUS,
      publicRelease: false as const,
    })),
  };
}
