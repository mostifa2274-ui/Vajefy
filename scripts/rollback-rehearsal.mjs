#!/usr/bin/env node
/**
 * Rehearse a production rollback with two real builds (plan §22).
 *
 * The current checkout is the release that is rolled back. The previous
 * release (`--previous <ref>`, by default the first parent of HEAD) is built in
 * a git worktree under `.rollback/`. Both are served by the Workers preview,
 * behind one origin that the browser test switches between them.
 *
 *   node scripts/rollback-rehearsal.mjs [--previous <ref>] [--skip-build]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const previousRef = option("--previous") ?? "HEAD^1";
const skipBuild = args.includes("--skip-build");
const worktree = path.join(root, ".rollback", "previous");

function run(command, commandArgs, options = {}) {
  console.log(`$ ${command} ${commandArgs.join(" ")}${options.cwd ? `  (in ${path.relative(root, options.cwd) || "."})` : ""}`);
  execFileSync(command, commandArgs, { stdio: "inherit", ...options });
}

function git(...gitArgs) {
  return execFileSync("git", gitArgs, { encoding: "utf8" }).trim();
}

const current = git("rev-parse", "HEAD");
const previous = git("rev-parse", "--verify", `${previousRef}^{commit}`);
if (previous === current) throw new Error(`The previous release ${previousRef} is the current commit.`);
console.log(`Rolling back ${current.slice(0, 12)} to ${previous.slice(0, 12)} (${previousRef}).`);

if (!skipBuild) {
  if (fs.existsSync(worktree)) run("git", ["worktree", "remove", "--force", worktree]);
  run("git", ["worktree", "add", "--detach", worktree, previous]);

  // The same lockfile installs the same packages, so the worktree can share
  // them; otherwise it installs its own.
  const lock = (dir) => fs.readFileSync(path.join(dir, "package-lock.json"), "utf8");
  if (lock(root) === lock(worktree)) {
    fs.symlinkSync(path.join(root, "node_modules"), path.join(worktree, "node_modules"), "dir");
  } else {
    run("npm", ["ci", "--no-audit", "--no-fund"], { cwd: worktree });
  }

  // Each build reports its own commit at /api/version, as Workers Builds does.
  run("npm", ["run", "build"], { cwd: worktree, env: { ...process.env, WORKERS_CI_COMMIT_SHA: previous } });
  run("npm", ["run", "build"], { env: { ...process.env, WORKERS_CI_COMMIT_SHA: current } });
}

run("npx", ["playwright", "test", "-c", "playwright.rollback.config.ts"], {
  env: {
    ...process.env,
    ROLLBACK_PREVIOUS_DIR: worktree,
    ROLLBACK_CURRENT_REVISION: current.slice(0, 12),
    ROLLBACK_PREVIOUS_REVISION: previous.slice(0, 12),
  },
});
