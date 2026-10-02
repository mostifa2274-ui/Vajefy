import { rm } from "node:fs/promises";

// Cloudflare's multi-environment build can retain old hashed chunks between
// local builds. Never deploy or precache files from an earlier app version.
await rm(new URL("../dist/", import.meta.url), { recursive: true, force: true });
