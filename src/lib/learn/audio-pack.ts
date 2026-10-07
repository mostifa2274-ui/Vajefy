import type { AudioPackFile, AudioUnitPack } from "./content";

/**
 * Versioned pronunciation packs for offline use.
 *
 * Each unit/accent/version lives in its own cache. A new version is only
 * considered active after every file has been fetched, byte-validated and a
 * completion marker has been written. If a download is interrupted, its
 * partial candidate remains resumable while the previous complete version is
 * left untouched.
 */

export const LEGACY_AUDIO_CACHE = "vajefy-audio-v1";
export const AUDIO_PACK_CACHE_PREFIX = "vajefy-audio-unit-v2:";
export const AUDIO_PACK_MARKER = "/__vajefy_audio_pack_complete__";

export type PackStatus = {
  cached: number;
  total: number;
  /** The requested manifest version has a complete validated marker. */
  current: boolean;
  /** A complete version (current or previous) remains available offline. */
  activeVersion: string | null;
  /** True while a previous complete version protects an incomplete replacement. */
  previous: boolean;
};

type PackMarker = {
  schemaVersion: 1;
  unitId: string;
  accent: "gb" | "us";
  version: string;
  bytes: number;
  files: AudioPackFile[];
  installedAt: number;
};

function available(): boolean {
  return typeof caches !== "undefined";
}

function identityPrefix(pack: Pick<AudioUnitPack, "unitId" | "accent">): string {
  return AUDIO_PACK_CACHE_PREFIX + pack.unitId + ":" + pack.accent + ":";
}

export function packCacheName(pack: Pick<AudioUnitPack, "unitId" | "accent" | "version">): string {
  return identityPrefix(pack) + pack.version;
}

function audioPath(file: string): string {
  return "/audio/" + file;
}

function sameFiles(a: AudioPackFile[], b: AudioPackFile[]): boolean {
  return (
    a.length === b.length &&
    a.every((file, index) => file.file === b[index]?.file && file.bytes === b[index]?.bytes)
  );
}

function markerMatchesPack(marker: PackMarker, pack: AudioUnitPack): boolean {
  return (
    marker.schemaVersion === 1 &&
    marker.unitId === pack.unitId &&
    marker.accent === pack.accent &&
    marker.version === pack.version &&
    marker.bytes === pack.bytes &&
    sameFiles(marker.files, pack.files)
  );
}

async function markerOf(cache: Cache): Promise<PackMarker | null> {
  const response = await cache.match(AUDIO_PACK_MARKER, { ignoreVary: true });
  if (!response) return null;
  try {
    const value = (await response.json()) as Partial<PackMarker>;
    if (
      value.schemaVersion !== 1 ||
      typeof value.unitId !== "string" ||
      (value.accent !== "gb" && value.accent !== "us") ||
      typeof value.version !== "string" ||
      !Number.isInteger(value.bytes) ||
      !Array.isArray(value.files) ||
      !Number.isFinite(value.installedAt)
    ) {
      return null;
    }
    const files = value.files.flatMap((row) =>
      row &&
      typeof row === "object" &&
      typeof (row as AudioPackFile).file === "string" &&
      Number.isInteger((row as AudioPackFile).bytes) &&
      (row as AudioPackFile).bytes > 0
        ? [{ file: (row as AudioPackFile).file, bytes: (row as AudioPackFile).bytes }]
        : [],
    );
    if (files.length !== value.files.length) return null;
    return {
      schemaVersion: 1,
      unitId: value.unitId,
      accent: value.accent,
      version: value.version,
      bytes: value.bytes,
      files,
      installedAt: value.installedAt,
    };
  } catch {
    return null;
  }
}

async function cachedPaths(cache: Cache): Promise<Set<string>> {
  return new Set((await cache.keys()).map((request) => new URL(request.url).pathname));
}

async function markerIsComplete(cache: Cache, marker: PackMarker): Promise<boolean> {
  const paths = await cachedPaths(cache);
  return marker.files.every((file) => paths.has(audioPath(file.file)));
}

async function verified(cache: Cache, file: AudioPackFile): Promise<boolean> {
  const response = await cache.match(audioPath(file.file), { ignoreVary: true });
  if (!response) return false;
  try {
    return (await response.arrayBuffer()).byteLength === file.bytes;
  } catch {
    return false;
  }
}

async function activePack(
  keys: string[],
  pack: Pick<AudioUnitPack, "unitId" | "accent">,
): Promise<PackMarker | null> {
  const prefix = identityPrefix(pack);
  const complete: PackMarker[] = [];
  for (const key of keys.filter((name) => name.startsWith(prefix))) {
    const cache = await caches.open(key);
    const marker = await markerOf(cache);
    if (marker && (await markerIsComplete(cache, marker))) complete.push(marker);
  }
  complete.sort((a, b) => b.installedAt - a.installedAt);
  return complete[0] ?? null;
}

export async function packStatus(pack: AudioUnitPack): Promise<PackStatus> {
  if (!available()) {
    return { cached: 0, total: pack.files.length, current: false, activeVersion: null, previous: false };
  }

  const keys = await caches.keys();
  const name = packCacheName(pack);
  let cached = 0;
  let current = false;
  if (keys.includes(name)) {
    const cache = await caches.open(name);
    const paths = await cachedPaths(cache);
    cached = pack.files.filter((file) => paths.has(audioPath(file.file))).length;
    const marker = await markerOf(cache);
    current = Boolean(marker && markerMatchesPack(marker, pack) && (await markerIsComplete(cache, marker)));
  }

  const active = await activePack(keys, pack);
  return {
    cached,
    total: pack.files.length,
    current,
    activeVersion: active?.version ?? null,
    previous: Boolean(active && active.version !== pack.version),
  };
}

/** Download and validate one replacement candidate without disturbing the active pack. */
export async function downloadPack(
  pack: AudioUnitPack,
  onProgress: (status: PackStatus) => void,
  signal?: AbortSignal,
): Promise<PackStatus> {
  if (!available()) throw new Error("This browser cannot store files for offline use.");
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const name = packCacheName(pack);
  const cache = await caches.open(name);
  const initial = await packStatus(pack);
  let cached = 0;
  const valid = new Set<string>();

  // Re-validate resumable candidate entries before counting them.
  for (const file of pack.files) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (await verified(cache, file)) {
      valid.add(file.file);
      cached += 1;
    } else {
      await cache.delete(audioPath(file.file), { ignoreVary: true });
    }
  }
  onProgress({ ...initial, cached, total: pack.files.length, current: false });

  const queue = pack.files.filter((file) => !valid.has(file.file));

  let failed = 0;
  async function worker() {
    while (queue.length) {
      if (signal?.aborted) return;
      const file = queue.shift()!;
      try {
        const response = await fetch(audioPath(file.file), signal ? { signal } : undefined);
        if (!response.ok || response.status !== 200) throw new Error(String(response.status));
        const body = await response.arrayBuffer();
        if (body.byteLength !== file.bytes) {
          throw new Error("byte-length mismatch for " + file.file + ": " + body.byteLength + " != " + file.bytes);
        }
        await cache.put(
          audioPath(file.file),
          new Response(body, {
            status: 200,
            headers: response.headers,
          }),
        );
        cached += 1;
        onProgress({ ...initial, cached, total: pack.files.length, current: false });
      } catch (error) {
        if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
        failed += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: 4 }, worker));
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (failed) throw new Error(failed + " files could not be downloaded.");

  // Full integrity pass before the version becomes active.
  for (const file of pack.files) {
    if (!(await verified(cache, file))) {
      throw new Error("Integrity check failed for " + file.file + ".");
    }
  }

  const marker: PackMarker = {
    schemaVersion: 1,
    unitId: pack.unitId,
    accent: pack.accent,
    version: pack.version,
    bytes: pack.bytes,
    files: pack.files,
    installedAt: Date.now(),
  };
  await cache.put(
    AUDIO_PACK_MARKER,
    new Response(JSON.stringify(marker), { headers: { "content-type": "application/json" } }),
  );

  // Commit succeeded. Only now can older complete/partial versions be retired.
  const keys = await caches.keys();
  const prefix = identityPrefix(pack);
  await Promise.all(
    keys
      .filter((key) => key.startsWith(prefix) && key !== name)
      .map((key) => caches.delete(key)),
  );

  return packStatus(pack);
}

/** Remove every version of one unit/accent pack. Opportunistically played clips may remain in the legacy cache. */
export async function removePack(pack: Pick<AudioUnitPack, "unitId" | "accent">): Promise<void> {
  if (!available()) return;
  const prefix = identityPrefix(pack);
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith(prefix)).map((key) => caches.delete(key)));
}
