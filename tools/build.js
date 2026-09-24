// Build a clean, store-ready copy of the extension into dist/ (plus a .zip).
//
// Since the Phase 0 restructure, the runtime files live in core/ + targets/
// extension/, and tools/sync-core.mjs assembles them into a flat loadable
// folder (targets/extension/build). This script runs that assembly, mirrors it
// into dist/, and zips it. Pure Node built-ins; no dependencies.
//
//   node tools/build.js      (or: npm run build)

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const BUILD = path.join(ROOT, "targets", "extension", "build");
const DIST = path.join(ROOT, "dist");

// Assemble core/ + targets/extension/ -> targets/extension/build (flat).
execSync("node tools/sync-core.mjs extension", { cwd: ROOT, stdio: "inherit" });

// Mirror the assembled build into dist/ (the store output location).
fs.rmSync(DIST, { recursive: true, force: true });
fs.cpSync(BUILD, DIST, { recursive: true });

const version = JSON.parse(
  fs.readFileSync(path.join(DIST, "manifest.json"), "utf8")
).version;
const zipName = `prayer-times-reminder-${version}.zip`;
const zipPath = path.join(ROOT, zipName);
fs.rmSync(zipPath, { force: true });

// Best-effort zip of the dist/ contents (the unpacked dist/ is always produced).
let zipped = false;
try {
  if (process.platform === "win32") {
    // Prefer PowerShell 7 (pwsh): Windows PowerShell 5.1's Compress-Archive
    // writes entry paths with backslashes (icons\icon16.png), which Chrome
    // does not unpack as folders.
    let shell = "powershell";
    try {
      execSync("pwsh -NoProfile -Command exit", { stdio: "ignore" });
      shell = "pwsh";
    } catch {
      console.warn("build: pwsh not found — the zip may use backslash paths; install PowerShell 7.");
    }
    execSync(
      `${shell} -NoProfile -Command "Compress-Archive -Path '${DIST}${path.sep}*' -DestinationPath '${zipPath}' -Force"`,
      { stdio: "ignore" }
    );
  } else {
    execSync(`cd "${DIST}" && zip -r -q "${zipPath}" .`, { stdio: "ignore" });
  }
  zipped = true;
} catch {
  /* zip tooling unavailable — dist/ is still ready to load/zip manually */
}

const fileCount = (function walk(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true }))
    n += e.isDirectory() ? walk(path.join(dir, e.name)) : 1;
  return n;
})(DIST);

console.log(`Built dist/ from core/ + targets/extension/ — ${fileCount} files`);
console.log(
  zipped
    ? `Created ${zipName}`
    : "dist/ ready (auto-zip unavailable here — zip dist/ contents for the store)."
);
