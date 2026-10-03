/** Where a device's sync pairing is stored; read at startup without loading the sync engine. */
export const SYNC_KEY = "vajefy-sync";

/** Whether this browser holds a sync pairing. */
export function pairingStored(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(SYNC_KEY) !== null;
  } catch {
    return false;
  }
}
