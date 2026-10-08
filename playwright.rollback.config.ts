import { defineConfig } from "@playwright/test";

/**
 * The rollback rehearsal (plan §22), run by `scripts/rollback-rehearsal.mjs`.
 * It serves the current build and a previous release's build side by side.
 */
const previousDir = process.env.ROLLBACK_PREVIOUS_DIR;
if (!previousDir) throw new Error("Run the rollback rehearsal with scripts/rollback-rehearsal.mjs.");
// Workers AI has no local simulator; CI=true keeps the preview from asking for
// remote bindings (vite.config.ts).
const preview = (port: number) => `CI=true npx vite preview --host 127.0.0.1 --port ${port} --strictPort`;

export default defineConfig({
  testDir: "./tests/rollback",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["line"]] : "line",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "allow",
    ...(process.env.PLAYWRIGHT_CHROMIUM ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM } } : {}),
  },
  webServer: [
    { command: preview(8091), url: "http://127.0.0.1:8091", reuseExistingServer: false, timeout: 120_000 },
    { command: preview(8092), cwd: previousDir, url: "http://127.0.0.1:8092", reuseExistingServer: false, timeout: 120_000 },
  ],
});
