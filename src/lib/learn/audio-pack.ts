/**
 * Pronunciation for offline use. Clips are content-hashed, so a cached copy is
 * always correct; they share the service worker's long-lived audio cache.
 */

export const AUDIO_CACHE = "vajefy-audio-v1";

export type PackStatus = { cached: number; total: number };

function available(): boolean {
  return typeof caches !== "undefined";
}

export async function packStatus(files: string[]): Promise<PackStatus> {
  if (!available()) return { cached: 0, total: files.length };
  const cache = await caches.open(AUDIO_CACHE);
  const keys = new Set((await cache.keys()).map((request) => new URL(request.url).pathname));
  return { cached: files.filter((file) => keys.has(`/audio/${file}`)).length, total: files.length };
}

/** Download every missing clip, a few at a time, reporting progress. */
export async function downloadPack(
  files: string[],
  onProgress: (status: PackStatus) => void,
  signal?: AbortSignal,
): Promise<PackStatus> {
  if (!available()) throw new Error("This browser cannot store files for offline use.");
  const cache = await caches.open(AUDIO_CACHE);
  const keys = new Set((await cache.keys()).map((request) => new URL(request.url).pathname));
  let cached = files.filter((file) => keys.has(`/audio/${file}`)).length;
  const missing = files.filter((file) => !keys.has(`/audio/${file}`));
  onProgress({ cached, total: files.length });
  const queue = [...missing];
  let failed = 0;
  async function worker() {
    while (queue.length && !signal?.aborted) {
      const file = queue.shift()!;
      try {
        const response = await fetch(`/audio/${file}`, signal ? { signal } : undefined);
        if (!response.ok) throw new Error(String(response.status));
        await cache.put(`/audio/${file}`, response);
        cached += 1;
        onProgress({ cached, total: files.length });
      } catch {
        failed += 1;
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  if (failed && !signal?.aborted) throw new Error(`${failed} files could not be downloaded.`);
  return { cached, total: files.length };
}

export async function removePack(files: string[]): Promise<void> {
  if (!available()) return;
  const cache = await caches.open(AUDIO_CACHE);
  await Promise.all(files.map((file) => cache.delete(`/audio/${file}`)));
}
