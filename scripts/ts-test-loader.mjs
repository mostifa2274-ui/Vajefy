/**
 * Module resolve hook for `node --experimental-strip-types --test`.
 *
 * App code follows the bundler convention — `./text`, `@/lib/cn` — which
 * Node's own resolver rejects. This maps `@/` to `src/` and retries a
 * missing relative path with `.ts`, `.tsx` and `/index.ts`. Registered by
 * `ts-test-register.mjs`; never loaded by Vite or the deployed app.
 */
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const SRC = pathToFileURL(join(process.cwd(), "src") + "/").href;
const SUFFIXES = [".ts", ".tsx", "/index.ts"];

export async function resolve(specifier, context, nextResolve) {
  const aliased = specifier.startsWith("@/") ? new URL(specifier.slice(2), SRC).href : specifier;
  try {
    return await nextResolve(aliased, context);
  } catch (error) {
    const local = aliased.startsWith(".") || aliased.startsWith("file:");
    if (!local || error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
    for (const suffix of SUFFIXES) {
      try {
        return await nextResolve(aliased + suffix, context);
      } catch {
        // try the next suffix
      }
    }
    throw error;
  }
}
