/**
 * A frequency-only, independent *candidate* selection from pinned NGSL 1.2.
 *
 * This module never loads or consults an Oxford or Vajefy legacy word roster.
 * Frequency rank is NOT a CEFR placement, sense choice, licence for inherited
 * expressions, or a release decision.
 */
export const INDEPENDENT_NGSL_SELECTION_STATUS =
  "STAGING_ONLY_NOT_A1_ASSESSED_NOT_RIGHTS_CLEARED" as const;

export type NgslSelectedLemma = {
  selectionId: string;
  lemma: string;
  sourceRank: number;
  teachingContentStatus: "NOT_AUTHORED";
  cefrStatus: "UNASSESSED";
  sourceRightsStatus: "LICENSE_NOTICE_PRESENT_NOT_ITEM_CLEARED";
  releaseApproved: false;
};

export type IndependentNgslSelection = {
  schemaVersion: 1;
  status: typeof INDEPENDENT_NGSL_SELECTION_STATUS;
  selectionMethod: "FIRST_900_PINNED_NGSL_CORE_RANKS_NO_LEGACY_ROSTER_INPUT";
  source: {
    edition: "NGSL 1.2";
    corePath: string;
    coreGitBlobSha: string;
    licensePath: string;
    licenseGitBlobSha: string;
    upstreamUrl: string;
    license: "CC BY-SA 4.0";
  };
  selected: 900;
  verifiedA1Words: 0;
  authoredLessons: 0;
  rightsClearedItems: 0;
  releasedItems: 0;
  entries: NgslSelectedLemma[];
};

export function readRankedNgslCore(csv: string): { lemma: string; rank: number }[] {
  const lines = csv.replace(/\r/g, "").trimEnd().split("\n");
  if (lines[0] !== "word,rank") throw new Error("NGSL core CSV header changed");
  const seen = new Set<string>();
  const rows = lines.slice(1).map((line, i) => {
    const parts = line.split(",");
    if (parts.length !== 2 || !parts[0]?.trim() || !/^[1-9]\d*$/.test(parts[1] ?? "")) {
      throw new Error("Invalid NGSL core entry at line " + (i + 2));
    }
    const lemma = parts[0]!.trim();
    const rank = Number(parts[1]);
    const key = lemma.toLocaleLowerCase("en").normalize("NFKC");
    if (seen.has(key)) throw new Error("Duplicate normalized NGSL core lemma " + lemma);
    seen.add(key);
    return { lemma, rank };
  });
  rows.sort((a, b) => a.rank - b.rank);
  for (const [i, row] of rows.entries()) {
    if (row.rank !== i + 1) throw new Error("NGSL ranks must be unique, contiguous and start at 1");
  }
  if (rows.length !== 2809) throw new Error("Pinned NGSL core must contain 2,809 ranked lemmas");
  return rows;
}

export function independentNgslSelection(
  core: readonly { lemma: string; rank: number }[],
): IndependentNgslSelection {
  if (core.length !== 2809 || core.some((entry, i) => entry.rank !== i + 1)) {
    throw new Error("Selection needs the entire verified ranked core, not a legacy subset");
  }
  return {
    schemaVersion: 1,
    status: INDEPENDENT_NGSL_SELECTION_STATUS,
    selectionMethod: "FIRST_900_PINNED_NGSL_CORE_RANKS_NO_LEGACY_ROSTER_INPUT",
    source: {
      edition: "NGSL 1.2",
      corePath: "content/rights-staging/ngsl-1.2/core.csv",
      coreGitBlobSha: "b8705be6c208bbee4450a208eb39a5be4dea8f63",
      licensePath: "content/rights-staging/ngsl-1.2/CC-BY-SA-4.0-LICENSE.txt",
      licenseGitBlobSha: "2d58298e6eda10e7204abb52722efbc840db2390",
      upstreamUrl: "https://www.newgeneralservicelist.com/new-general-service-list",
      license: "CC BY-SA 4.0",
    },
    selected: 900,
    verifiedA1Words: 0,
    authoredLessons: 0,
    rightsClearedItems: 0,
    releasedItems: 0,
    entries: core.slice(0, 900).map(({ lemma, rank }) => ({
      selectionId: "ngsl:freq:" + String(rank).padStart(4, "0"),
      lemma,
      sourceRank: rank,
      teachingContentStatus: "NOT_AUTHORED",
      cefrStatus: "UNASSESSED",
      sourceRightsStatus: "LICENSE_NOTICE_PRESENT_NOT_ITEM_CLEARED",
      releaseApproved: false,
    })),
  };
}

export function checkIndependentNgslSelection(
  actual: unknown,
  expected: IndependentNgslSelection,
): string[] {
  if (!actual || typeof actual !== "object" || Array.isArray(actual)) {
    return ["Missing independent selection manifest"];
  }
  // Checking canonical serialization prevents a forged clearance, edited
  // lemma/rank, missing approval field or covert inherited roster dependency.
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    return ["Staged selection deviates from exact pinned source and zero-approval state"];
  }
  return [];
}
