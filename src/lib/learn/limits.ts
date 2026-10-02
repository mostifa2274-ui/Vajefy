/**
 * Sliding-window rate limiter keyed by a string (an IP, or one shared key for
 * a global cap). In-memory, so it is per server instance: a ceiling on spend,
 * not an exact quota. The oldest keys are evicted past `maxKeys`.
 */
export function createLimiter({ limit, windowMs, maxKeys = 10_000 }: { limit: number; windowMs: number; maxKeys?: number }) {
  const hits = new Map<string, number[]>();
  return {
    take(key: string, now = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((at) => at > now - windowMs);
      hits.delete(key);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > maxKeys) hits.delete(hits.keys().next().value!);
      return true;
    },
  };
}

/** A Map that forgets its least recently used entry past `max`. */
export function createLru<V>(max: number) {
  const map = new Map<string, V>();
  return {
    get(key: string): V | undefined {
      const value = map.get(key);
      if (value !== undefined) {
        map.delete(key);
        map.set(key, value);
      }
      return value;
    },
    set(key: string, value: V) {
      map.delete(key);
      map.set(key, value);
      if (map.size > max) map.delete(map.keys().next().value!);
    },
    get size() {
      return map.size;
    },
  };
}
