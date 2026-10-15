// ios-extras — Capacitor "capacitor:copy:after" hook (package.json scripts).
//
// After `npx cap copy|sync ios` has copied www/ into ios/App/App/public/,
// add the iOS-only web assets from ios-assets/ on top. Today that is
// audio/adhan.m4a: WKWebView can't play the shared Ogg Vorbis adhan, so the
// adapter points the lock overlay at an AAC copy on iOS. Kept out of www/ so
// the Android APK doesn't carry a second copy. No-op for other platforms.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.CAPACITOR_PLATFORM_NAME !== "ios") process.exit(0);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "ios-assets");
const DST = path.join(ROOT, "ios", "App", "App", "public");

if (!fs.existsSync(DST)) {
  console.error("ios-extras: " + DST + " is missing (run cap copy ios first)");
  process.exit(1);
}
fs.cpSync(SRC, DST, { recursive: true });
console.log("ios-extras: copied ios-assets/ into ios/App/App/public/");
