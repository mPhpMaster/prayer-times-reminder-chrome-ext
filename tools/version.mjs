// version — bump / roll back the extension version across every source of truth.
//
// The version lives in two hand-maintained files that MUST stay in lockstep
// (sync-core + build.js copy the manifest into build/ and dist/, so those are
// generated and don't need touching here):
//
//   package.json                     "version": "x.y.z"   (2-space JSON)
//   targets/extension/manifest.json  "version": "x.y.z"   (4-space JSON)
//
// We rewrite ONLY the "version" string in place (regex, not JSON re-stringify)
// so each file keeps its own indentation and key order, and manifest_version /
// minimum_chrome_version are never touched.
//
//   node tools/version.mjs bump [patch|minor|major]   bump (default: patch)
//   node tools/version.mjs bump --build [level]       bump, then run the build
//   node tools/version.mjs rollback                   undo the last bump
//
// Pure Node built-ins; no dependencies.

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PKG = path.join(ROOT, "package.json");
const MANIFEST = path.join(ROOT, "targets", "extension", "manifest.json");
const BACKUP = path.join(ROOT, ".version-backup"); // gitignored; enables rollback

// The two files that carry the version. Edit this list if a target adds another.
const FILES = [PKG, MANIFEST];

const rel = (f) => path.relative(ROOT, f).replace(/\\/g, "/");

// Match the `"version": "…"` string field. The leading quote on "version"
// prevents matching "manifest_version" / "minimum_chrome_version".
const VERSION_RE = /("version"\s*:\s*")[^"]+(")/;

function readCurrentVersion() {
  return JSON.parse(fs.readFileSync(PKG, "utf8")).version;
}

function setVersionInFile(file, version) {
  const text = fs.readFileSync(file, "utf8");
  if (!VERSION_RE.test(text)) {
    throw new Error(`No "version" field found in ${rel(file)}`);
  }
  fs.writeFileSync(file, text.replace(VERSION_RE, `$1${version}$2`));
}

function setVersionEverywhere(version) {
  for (const f of FILES) setVersionInFile(f, version);
}

function nextVersion(current, level) {
  const parts = current.split(".").map((n) => Number(n));
  if (parts.length < 3 || parts.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new Error(`Cannot parse semver from "${current}"`);
  }
  const [major, minor, patch] = parts;
  if (level === "major") return `${major + 1}.0.0`;
  if (level === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`; // patch (default)
}

function bump(args) {
  const withBuild = args.includes("--build");
  const level = args.find((a) => ["patch", "minor", "major"].includes(a)) || "patch";

  const current = readCurrentVersion();
  const next = nextVersion(current, level);

  // Remember where we came from so `rollback` can undo exactly this bump.
  fs.writeFileSync(
    BACKUP,
    JSON.stringify({ previous: current, bumpedTo: next, level }, null, 2) + "\n"
  );

  setVersionEverywhere(next);
  console.log(`version: ${current} -> ${next} (${level})`);
  for (const f of FILES) console.log(`  updated ${rel(f)}`);

  if (withBuild) {
    console.log("version: running build…");
    execSync("node tools/build.js", { cwd: ROOT, stdio: "inherit" });
  }
}

function rollback() {
  if (!fs.existsSync(BACKUP)) {
    console.error(
      "version: nothing to roll back — no .version-backup found.\n" +
        "         (it is written by `npm run version:bump`.)"
    );
    process.exit(1);
  }
  const { previous } = JSON.parse(fs.readFileSync(BACKUP, "utf8"));
  const current = readCurrentVersion();

  if (!previous) throw new Error(".version-backup is missing a `previous` version");

  setVersionEverywhere(previous);
  fs.rmSync(BACKUP, { force: true }); // one bump = one undo
  console.log(`version: rolled back ${current} -> ${previous}`);
  for (const f of FILES) console.log(`  updated ${rel(f)}`);
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  try {
    if (command === "bump") bump(args);
    else if (command === "rollback") rollback();
    else {
      console.error(
        "Usage:\n" +
          "  node tools/version.mjs bump [patch|minor|major]   bump version (default: patch)\n" +
          "  node tools/version.mjs bump --build [level]       bump, then run the build\n" +
          "  node tools/version.mjs rollback                   undo the last bump"
      );
      process.exit(1);
    }
  } catch (err) {
    console.error(`version: ${err.message}`);
    process.exit(1);
  }
}

main();
