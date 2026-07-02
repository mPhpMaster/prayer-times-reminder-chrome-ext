// release — one command for the whole "ship it" flow, so you don't have to ask
// for "bump the version, build, and push to GitHub" by hand each time.
//
//   bump version  ->  build dist/ + zip  ->  commit everything  ->  tag  ->  push
//
//   node tools/release.mjs           patch release (default)
//   node tools/release.mjs minor     minor release
//   node tools/release.mjs major     major release
//
// Thin orchestrator: it just calls the existing tools/version.mjs (keeps
// package.json + manifest in sync) and tools/build.js. Pure Node built-ins.

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd) => execSync(cmd, { cwd: ROOT, stdio: "inherit" });

const level =
  process.argv.slice(2).find((a) => ["patch", "minor", "major"].includes(a)) || "patch";

function tagExists(tag) {
  try {
    execSync(`git rev-parse -q --verify "refs/tags/${tag}"`, { cwd: ROOT, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// 1) Bump the version (package.json + targets/extension/manifest.json together).
run(`node tools/version.mjs bump ${level}`);
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

// 2) Build the store-ready dist/ + zip. A failed build aborts here — before any
//    commit or push — so you never ship a broken build. (`npm run version:rollback`
//    undoes the bump if you want to retry.)
run("node tools/build.js");

// 3) Commit all changes, tag the release (matches the repo's bare "x.y.z" tags),
//    and push the branch + tag to GitHub.
run("git add -A");
run(`git commit -m "Release ${version}"`);
if (tagExists(version)) {
  console.log(`release: tag ${version} already exists — skipping tag`);
} else {
  run(`git tag -a ${version} -m "Release ${version}"`);
}
try {
  run("git push --follow-tags");
} catch {
  // First push of this branch — set the upstream and retry.
  run("git push -u origin HEAD --follow-tags");
}

console.log(`\nrelease: shipped ${version} 🚀`);
