import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * This guards our npm release command. Cloudflare Workers Builds configured
 * externally with `npx wrangler deploy` can bypass npm lifecycle hooks;
 * the operator must explicitly select `npm run deploy` in that dashboard.
 */
test("npm production deployment cannot skip the strict redistribution-rights gate", () => {
  const pkg = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  assert.equal(pkg.scripts.predeploy, "npm run assurance:gate0");
  const deploy = pkg.scripts.deploy;
  assert.ok(deploy, "Missing production deploy script");
  const gate = deploy.indexOf("npm run assurance:gate0");
  const build = deploy.indexOf("npm run build");
  const upload = deploy.indexOf("wrangler deploy");
  assert.ok(gate >= 0 && build > gate && upload > build,
    "The Gate 0 check must precede both the build and the production upload");
  assert.match(pkg.scripts["assurance:gate0"] ?? "", /--require-release-ready/);
});
