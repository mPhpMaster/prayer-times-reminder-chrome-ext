// fetch-asr — downloads the sherpa-onnx Android AAR that WhisperEngine links
// against into targets/mobile/android/app/libs/ (gitignored, ~50 MB).
// The model files themselves are built by tools/asr/README.md.
//
//   node tools/fetch-asr.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = "1.13.8";
const NAME = `sherpa-onnx-${VERSION}.aar`;
const URL = `https://github.com/k2-fsa/sherpa-onnx/releases/download/v${VERSION}/${NAME}`;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEST = path.join(ROOT, "targets", "mobile", "android", "app", "libs", NAME);

if (fs.existsSync(DEST)) {
  console.log(`fetch-asr: ${path.relative(ROOT, DEST)} already present`);
  process.exit(0);
}
fs.mkdirSync(path.dirname(DEST), { recursive: true });
console.log(`fetch-asr: downloading ${URL}`);
const res = await fetch(URL);
if (!res.ok) throw new Error(`HTTP ${res.status} for ${URL}`);
fs.writeFileSync(DEST, Buffer.from(await res.arrayBuffer()));
console.log(`fetch-asr: saved ${path.relative(ROOT, DEST)} (${fs.statSync(DEST).size} bytes)`);
