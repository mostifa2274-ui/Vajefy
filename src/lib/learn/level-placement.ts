import type { LevelId } from "./types";

/**
 * Entries taught at a different level from the one in their stable ID.
 *
 * Entry IDs never change, because learner progress, sync and exports are
 * keyed by them. When the CEFR-J rebuild moves an entry between levels
 * (docs/A1_CEFRJ_REBUILD.md, phase 3), it is listed here with its new level and
 * `levelOf` reads the placement instead of the ID prefix. Senses (`id#sense`)
 * follow their entry. Empty until the staged curriculum goes live.
 */
export const LEVEL_PLACEMENT: Readonly<Record<string, LevelId>> = {};
