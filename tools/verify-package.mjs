// verify-package — inspect a built Chrome Web Store zip before uploading it.
//
//   node tools/verify-package.mjs [path/to/package.zip]
//   (default: prayer-times-reminder-<manifest version>.zip in the repo root)
//
// Reads the zip's central directory (no unzip tool needed) and checks that:
//   - every entry uses forward slashes (Chrome doesn't unpack "icons\x.png")
//   - manifest.json sits at the root and matches the source manifest
//   - every file the manifest and the HTML pages reference is inside
//   - nothing that shouldn't ship is inside (keys, env files, tests, sources maps)
// Pure Node built-ins; no dependencies.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, "targets", "extension", "manifest.json"), "utf8"));
const zipPath = path.resolve(process.argv[2] || path.join(ROOT, `prayer-times-reminder-${SOURCE_MANIFEST.version}.zip`));

const FORBIDDEN = [/\.pem$/i, /\.env/i, /\.map$/i, /(^|\/)tests?\//i, /(^|\/)node_modules\//i, /(^|\/)\.git/i, /\.zip$/i];

function readEntries(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("not a zip (no end of central directory)");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("corrupt central directory");
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    entries.set(name, { method, size, local });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readFile(buf, e) {
  const nameLen = buf.readUInt16LE(e.local + 26);
  const extraLen = buf.readUInt16LE(e.local + 28);
  const start = e.local + 30 + nameLen + extraLen;
  const compressedSize = buf.readUInt32LE(e.local + 18);
  const data = buf.subarray(start, start + compressedSize);
  return (e.method === 8 ? zlib.inflateRawSync(data) : data).toString("utf8");
}

const problems = [];
const buf = fs.readFileSync(zipPath);
const entries = readEntries(buf);
const names = [...entries.keys()].filter((n) => !n.endsWith("/"));

for (const n of names) {
  if (n.includes("\\")) problems.push(`backslash path: ${n}`);
  if (FORBIDDEN.some((re) => re.test(n))) problems.push(`must not ship: ${n}`);
}
if (!entries.has("manifest.json")) problems.push("manifest.json is not at the zip root");

const manifest = entries.has("manifest.json") ? JSON.parse(readFile(buf, entries.get("manifest.json"))) : {};
if (JSON.stringify(manifest) !== JSON.stringify(SOURCE_MANIFEST)) problems.push("packaged manifest differs from targets/extension/manifest.json");

const need = new Set(["background.js", manifest.action && manifest.action.default_popup, ...Object.values(manifest.icons || {})]);
for (const loc of ["en", "ar"]) need.add(`_locales/${loc}/messages.json`);
for (const n of names.filter((x) => x.endsWith(".html"))) {
  for (const [, src] of readFile(buf, entries.get(n)).matchAll(/<(?:script|link)[^>]+(?:src|href)=["']([^"':]+)["']/gi)) need.add(src);
}
const bg = entries.has("background.js") ? readFile(buf, entries.get("background.js")) : "";
const imports = bg.match(/importScripts\(([\s\S]*?)\);/);
if (imports) for (const [, f] of imports[1].matchAll(/"([^"]+)"/g)) need.add(f);
for (const f of need) if (f && !entries.has(f)) problems.push(`missing: ${f}`);

const total = names.reduce((s, n) => s + entries.get(n).size, 0);
console.log(`verify-package: ${path.relative(ROOT, zipPath)} — ${names.length} files, ${(total / 1024 / 1024).toFixed(2)} MB unpacked`);
console.log(`  manifest ${manifest.version}; permissions: ${(manifest.permissions || []).join(", ")}`);
console.log(`  optional host permissions: ${(manifest.optional_host_permissions || []).join(", ") || "none"}`);
if (problems.length) {
  for (const p of problems) console.error("  FAIL: " + p);
  process.exit(1);
}
console.log(`  ok: ${need.size} referenced files present, forward-slash paths, nothing forbidden`);
