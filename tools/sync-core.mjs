// sync-core — the entire "build system" for the multi-target port.
//
// It assembles a loadable app for one target by copying the shared core/ and
// the target's thin shell into a single flat web-asset folder, so every
// existing same-directory relative path (href="theme.css", files:["content-lock.js"],
// url("fonts/..."), getURL("welcome.html")) resolves unchanged. No bundler.
//
//   node tools/sync-core.mjs extension   -> targets/extension/build/
//   node tools/sync-core.mjs desktop     -> targets/desktop/src/
//   node tools/sync-core.mjs mobile      -> targets/mobile/www/
//
// Pure Node built-ins; no dependencies.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORE = path.join(ROOT, "core");

// Where each target wants its assembled web assets (the dir its shell loads).
const OUT_DIR = {
  extension: path.join(ROOT, "targets", "extension", "build"),
  desktop: path.join(ROOT, "targets", "desktop", "src"),
  mobile: path.join(ROOT, "targets", "mobile", "www"),
};

// The per-target shell source: the web files merged on top of core/. For the
// extension this is the target root (manifest.json, background.js, adapter,
// content scripts). For desktop/mobile it's a dedicated `web/` subdir so the
// native projects (src-tauri/, android/) are NOT copied into the web output.
const SHELL_DIR = {
  extension: path.join(ROOT, "targets", "extension"),
  desktop: path.join(ROOT, "targets", "desktop", "web"),
  mobile: path.join(ROOT, "targets", "mobile", "web"),
};

// Shared core pieces, each flattened into the output root (or a named subdir).
// Order matters only for human readability; there are no name collisions.
const CORE_MAP = [
  ["data", "."], // i18n.js, tasbih-phrases.js
  ["logic", "."], // prayer-engine.js, scheduler-core.js, dhikr-core.js (later phases)
  ["platform", "."], // platform.js, vendor/ (later phases)
  ["ui", "."], // popup.*, welcome.*, theme.css, overlay-*.js
  ["assets/fonts", "fonts"],
  ["assets/icons", "icons"],
  ["assets/audio", "audio"], // adhan.ogg for the prayer-time sound option
  ["assets/city-ar", "city-ar"], // Arabic city names per country (tools/build-city-names.mjs)
];

function copyTree(src, dst) {
  if (!fs.existsSync(src)) return;
  let made = false;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyTree(s, d); // skipped silently if empty — no stray dirs in output
    } else {
      if (!made) {
        fs.mkdirSync(dst, { recursive: true });
        made = true;
      }
      fs.copyFileSync(s, d);
    }
  }
}

// Copy a target's web-shell files (from SHELL_DIR) on top of core/, flattened,
// skipping the generated output dir if it nests under the shell root.
function copyShell(target, out) {
  const shellRoot = SHELL_DIR[target];
  if (!fs.existsSync(shellRoot)) return;
  const outName = path.basename(OUT_DIR[target]);
  for (const entry of fs.readdirSync(shellRoot, { withFileTypes: true })) {
    if (entry.name === outName) continue; // never copy build/ into itself
    const s = path.join(shellRoot, entry.name);
    const d = path.join(out, entry.name);
    if (entry.isDirectory()) copyTree(s, d);
    else fs.copyFileSync(s, d);
  }
}

function assemble(target) {
  const out = OUT_DIR[target];
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  for (const [sub, dest] of CORE_MAP) {
    copyTree(path.join(CORE, sub), path.join(out, dest === "." ? "" : dest));
  }
  copyShell(target, out);

  const count = (function walk(dir) {
    let n = 0;
    for (const e of fs.readdirSync(dir, { withFileTypes: true }))
      n += e.isDirectory() ? walk(path.join(dir, e.name)) : 1;
    return n;
  })(out);

  console.log(`sync-core: assembled '${target}' -> ${path.relative(ROOT, out)} (${count} files)`);
}

function main() {
  const target = process.argv[2];
  const targets = target === "all" ? Object.keys(OUT_DIR) : [target];

  if (target !== "all" && !OUT_DIR[target]) {
    console.error(
      `Usage: node tools/sync-core.mjs <extension|desktop|mobile|all>\n` +
        `  unknown target: ${target ?? "(none)"}`
    );
    process.exit(1);
  }

  for (const t of targets) assemble(t);
}

main();
