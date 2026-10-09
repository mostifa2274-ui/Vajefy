/**
 * Conservative split between the word-list selection and the user's report
 * that their explanations/translations/examples were generated with ChatGPT.
 * User-reported authorship is NOT independent provenance or copyright clearance.
 */
export const RIGHTS_PENDING = "NOT_CLEARED" as const;
export const AI_AUTHORSHIP_REPORT = "USER_REPORTS_CHATGPT_NOT_INDEPENDENTLY_VERIFIED" as const;
export const LIST_SOURCE = "LEGACY_OXFORD_3000_5000_SELECTION_UNVERIFIED" as const;

const selectionKeys = new Set([
  "id", "w", "a", "b", "pair", "group", "root", "base", "affix",
  "band", "rank", "frequency", "level",
]);

export function authoredFieldsOf(row: Record<string, unknown>): string[] {
  return Object.keys(row).filter(key => !selectionKeys.has(key)).sort();
}

export function selectionFieldsOf(row: Record<string, unknown>): string[] {
  return Object.keys(row).filter(key => selectionKeys.has(key) && key !== "id").sort();
}

export function requireUncleared(row: {
  rightsStatus: string;
  selectionProvenance: string;
  aiAuthorship: string;
}): void {
  if (row.rightsStatus !== RIGHTS_PENDING ||
      row.selectionProvenance !== LIST_SOURCE ||
      row.aiAuthorship !== AI_AUTHORSHIP_REPORT) {
    throw new Error("Reported AI authorship cannot grant source redistribution rights");
  }
}
