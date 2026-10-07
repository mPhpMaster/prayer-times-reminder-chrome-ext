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
//   node tools/sync-core.mjs vencord     -> targets/vencord/build/prayerTimesBreak/
//
// The vencord target is the one exception to "flat copy": a Vencord userplugin
// is bundled by Vencord's esbuild as ES modules, so instead of copying core/
// we GENERATE core.generated.js — an ES module that evaluates the shared core
// scripts inside one function scope and re-exports their globals (see
// assembleVencord below). The core files themselves are never forked.
//
// Pure Node built-ins; no dependencies.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORE = path.join(ROOT, "core");

// Where each target wants its assembled web assets (the dir its shell loads).
const OUT_DIR = {
  extension: path.join(ROOT, "targets", "extension", "build"),
  desktop: path.join(ROOT, "targets", "desktop", "src"),
  mobile: path.join(ROOT, "targets", "mobile", "www"),
  vencord: path.join(ROOT, "targets", "vencord", "build", "prayerTimesBreak"),
};

// The per-target shell source: the web files merged on top of core/. For the
// extension this is the target root (manifest.json, background.js, adapter,
// content scripts). For desktop/mobile it's a dedicated `web/` subdir so the
// native projects (src-tauri/, android/) are NOT copied into the web output.
const SHELL_DIR = {
  extension: path.join(ROOT, "targets", "extension"),
  desktop: path.join(ROOT, "targets", "desktop", "web"),
  mobile: path.join(ROOT, "targets", "mobile", "web"),
  vencord: path.join(ROOT, "targets", "vencord", "plugin"),
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

// ---- vencord: Discord (Vencord userplugin) ----------------------------------
//
// Core scripts the plugin needs, in load order (vendor first, exactly like the
// <script> order of the other shells). They are classic scripts that declare
// globals, so they are concatenated into ONE function scope where those
// declarations become locals, and the names in VENCORD_EXPORTS are returned.
const VENCORD_CORE = [
  "platform/vendor/adhan.js",
  "platform/vendor/tz-lookup.js",
  "data/i18n.js",
  "data/tasbih-phrases.js",
  "logic/prayer-engine.js",
  "logic/lock-config.js",
  "logic/scheduler-core.js",
  "logic/dhikr-core.js",
];

const VENCORD_EXPORTS = [
  "tr", "SUPPORTED_LANGS", "METHODS", "TASBIH_POSITIONS", "DEFAULT_SETTINGS",
  "DEFAULT_LOCK_MINUTES", "DEFAULT_TASBIH_MINUTES", "DEFAULT_TASBIH_POSITION",
  "PrayerEngine", "buildLockConfig", "prayerLabel", "randomTasbihPhrase",
  "normalizeTheme", "normalizeTasbihPosition", "planPrayerAlarms", "nextRefreshTime",
  "prayerTimestamp", "clampLockMinutes", "clampTasbihMinutes", "alarmFiredLate",
  "usesArabicDigits", "toArabicDigits", "toDevanagariDigits", "pad",
];

// The DOM overlays are self-installing IIFEs that only need window/document;
// they run verbatim inside installOverlays() so the plugin decides when.
const VENCORD_OVERLAYS = ["ui/overlay-lock.js", "ui/overlay-tasbih.js"];

const VENCORD_HEADER = `/*
 * Prayer Times Break — Vencord userplugin
 * Copyright (c) 2026 mPhpMaster
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable */
// GENERATED by \`node tools/sync-core.mjs vencord\` from the shared core/ —
// DO NOT EDIT. Edit core/ (or targets/vencord/plugin/) and re-run sync-core.
`;

function readCore(rel) {
  return fs
    .readFileSync(path.join(CORE, rel), "utf8")
    .replace(/\r\n/g, "\n")
    // A mid-file source-map pragma would make the bundler look for a .map we don't ship.
    .replace(/^\/\/# sourceMappingURL=.*$/gm, "");
}

// The function expression that evaluates the core and returns its exports.
//
// Its parameters deliberately SHADOW the globals the vendored UMD bundles probe,
// so nothing leaks onto Discord's real window and nothing depends on how the
// bundler treats `module`/`exports`:
//   - adhan.js is UMD: with an `exports` object + `module` defined it takes the
//     CommonJS branch and fills our private `exports` (bound to `adhan` below,
//     which prayer-engine.js reads as a free identifier).
//   - tz-lookup.js declares `function tzlookup` (a local here) and then sets
//     `module.exports` / `globalThis.tzlookup` — both land on private objects.
function vencordCoreExpression() {
  let body = "";
  for (const rel of VENCORD_CORE) {
    body += `\n// ---- core/${rel} ----\n${readCore(rel)}\n`;
    if (rel.endsWith("adhan.js")) body += "const adhan = exports;\n";
  }
  body += `\nreturn { ${VENCORD_EXPORTS.join(", ")} };\n`;
  return (
    "(function (module, exports, define, globalThis, self) {\n" +
    body +
    "}).call(__sandbox, { exports: {} }, {}, undefined, __sandbox, __sandbox)"
  );
}

// Type declarations for core.generated.js, so the TypeScript plugin sources
// type-check against the real shapes (Vencord's tsconfig resolves the .d.ts).
const VENCORD_DTS = `/* GENERATED by \`node tools/sync-core.mjs vencord\` — DO NOT EDIT. */

export type PrayerKey = "Fajr" | "Sunrise" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";

export interface I18nDict {
    dir: "ltr" | "rtl";
    locale: string;
    prayers: Record<string, string>;
    [key: string]: any;
}

export interface PrayerTimingsResult {
    timings: Record<PrayerKey, string>;
    date: {
        readable: string;
        gregorian: { date: string; };
        hijri: {
            day: string;
            month: { number: number; en: string; ar: string; };
            year: string;
            designation: { abbreviated: string; };
        };
    };
    meta: { timezone: string; };
}

export interface CoreLocation { latitude: number; longitude: number; method?: number; }

export interface TasbihDisplay { lines: { text: string; dir: string; variant: string; }[]; }

export interface LockSettings {
    lang?: string;
    theme?: string;
    arabicDigits?: boolean;
    lockMinutes?: number;
    allowUnlock?: boolean;
    silentDuringPrayer?: boolean;
    prayerSound?: string;
}

export interface LockConfig {
    type: "ACTIVATE_LOCK";
    test: boolean;
    prayerName: string;
    title: string;
    subtitle: string;
    countdownPrefix: string;
    unlockLabel: string;
    unlockHint: string;
    dir: "ltr" | "rtl";
    lang: string;
    arabicDigits: boolean;
    allowUnlock: boolean;
    silent: boolean;
    sound: string;
    theme: string;
    unlockAt: number;
    durationSecs: number;
    onUnlock?: () => void;
}

export function tr(lang: string): I18nDict;
export const SUPPORTED_LANGS: readonly { code: string; name: string; dir: string; locale: string; }[];
export const METHODS: readonly { value: number; en: string; ar: string; }[];
export const TASBIH_POSITIONS: readonly ({ key: string; en: string; } & Record<string, string>)[];
export const DEFAULT_SETTINGS: Record<string, any>;
export const DEFAULT_LOCK_MINUTES: number;
export const DEFAULT_TASBIH_MINUTES: number;
export const DEFAULT_TASBIH_POSITION: string;
export const PrayerEngine: {
    timings(location: CoreLocation, date?: Date): PrayerTimingsResult;
    qibla(location: CoreLocation): number;
    tzForCoords(lat: number, lon: number): string;
    adhanParamsForMethod(method: number): unknown;
};
export function buildLockConfig(settings: LockSettings, opts?: { test?: boolean; prayerName?: string; }): LockConfig;
export function prayerLabel(L: I18nDict, key: string, date?: Date): string;
export function randomTasbihPhrase(lang: string): TasbihDisplay;
export function normalizeTheme(theme: unknown): "classic" | "midnight-emerald";
export function normalizeTasbihPosition(value: unknown): string;
export function planPrayerAlarms(timings: Record<string, string>, prayers: readonly string[], now: Date, tz?: string): { id: string; when: number; }[];
export function nextRefreshTime(now: Date): number;
export function prayerTimestamp(timeStr: string, ref: Date, timeZone?: string): number | null;
export function clampLockMinutes(value: unknown): number;
export function clampTasbihMinutes(value: unknown, fallback: number): number;
export function alarmFiredLate(scheduledTime: number, now: number, graceMs: number): boolean;
export function usesArabicDigits(lang: string, arabicDigits: boolean): boolean;
export function toArabicDigits(str: string): string;
export function toDevanagariDigits(str: string): string;
export function pad(n: number): string;

/** Installs window.__prayerTabLockActivate/__prayerTabLockClear and
 *  window.__prayerTasbihActivate/__prayerTasbihClear (idempotent). */
export function installOverlays(): void;
`;

// Evaluate the generated core in a fresh VM context and smoke-test it, so a
// core change that breaks the wrapper fails the sync instead of Discord.
function verifyVencordCore(expr) {
  // Strict, like the ES module it ends up in.
  const src = `"use strict";\nconst __sandbox = {};\n${expr}`;
  const core = vm.runInNewContext(src, {}, { filename: "core.generated.js" });
  const missing = VENCORD_EXPORTS.filter((n) => core[n] === undefined);
  if (missing.length) throw new Error(`vencord core wrapper: undefined exports: ${missing.join(", ")}`);
  const t = core.PrayerEngine.timings({ latitude: 24.7136, longitude: 46.6753, method: 4 }, new Date(2026, 0, 15, 12));
  if (!/^\d\d:\d\d$/.test(t.timings.Fajr) || t.meta.timezone !== "Asia/Riyadh") {
    throw new Error(`vencord core wrapper: bad timings ${JSON.stringify(t)}`);
  }
  const lock = core.buildLockConfig({ lang: "ar" }, { prayerName: "x" });
  if (lock.type !== "ACTIVATE_LOCK" || !lock.title) throw new Error("vencord core wrapper: bad lock config");
  if (!core.randomTasbihPhrase("en").lines.length) throw new Error("vencord core wrapper: no dhikr phrase");
}

function assembleVencord() {
  const out = OUT_DIR.vencord;
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  copyShell("vencord", out); // index.ts, settings.ts, runtime.ts …

  const expr = vencordCoreExpression();
  verifyVencordCore(expr);

  let js = VENCORD_HEADER;
  js += `// Sources: ${VENCORD_CORE.concat(VENCORD_OVERLAYS).map((r) => "core/" + r).join(", ")}\n\n`;
  js += "const __sandbox = {};\n";
  js += `const __core = ${expr};\n\n`;
  js += `export const {\n  ${VENCORD_EXPORTS.join(",\n  ")}\n} = __core;\n\n`;
  js += "// Runs the shared overlay IIFEs against Discord's window/document. Each one\n";
  js += "// guards itself (window.__prayer*Injected), so calling this again is a no-op.\n";
  js += "export function installOverlays() {\n";
  for (const rel of VENCORD_OVERLAYS) js += `// ---- core/${rel} ----\n${readCore(rel)}\n`;
  js += "}\n";

  fs.writeFileSync(path.join(out, "core.generated.js"), js);
  fs.writeFileSync(path.join(out, "core.generated.d.ts"), VENCORD_DTS);

  const count = fs.readdirSync(out).length;
  console.log(`sync-core: assembled 'vencord' -> ${path.relative(ROOT, out)} (${count} files)`);
}

// `all` = the three app shells; the Vencord plugin is opt-in (`vencord`).
const ALL_TARGETS = ["extension", "desktop", "mobile"];

function main() {
  const target = process.argv[2];
  const targets = target === "all" ? ALL_TARGETS : [target];

  if (target !== "all" && !OUT_DIR[target]) {
    console.error(
      `Usage: node tools/sync-core.mjs <extension|desktop|mobile|vencord|all>\n` +
        `  (all = extension + desktop + mobile)\n` +
        `  unknown target: ${target ?? "(none)"}`
    );
    process.exit(1);
  }

  for (const t of targets) (t === "vencord" ? assembleVencord : assemble)(t);
}

main();
