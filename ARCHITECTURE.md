# Architecture — one brain, three shells

This project ships **one product on three platforms** (Chrome extension, Tauri
desktop, Capacitor Android) from a **single shared `core/`** plus a **thin,
platform-owned shell per target**. It is split *by layer*, not *by platform*:
the expensive-to-maintain UI and prayer logic live once; the cheap,
genuinely-different platform glue lives per target.

> **Why not three separate codebases?** The UI + prayer logic is ~90% identical
> across targets and is polished constantly. Forking it would turn every fix
> (a CSS trap, a regex, a date preset) into three fixes forever. The platform
> layer — scheduling, enforcement, notifications, permissions — is where the
> platforms truly differ, and that layer is already owned per target. So we
> share what's shared and diverge only where the OS forces us to.

```
core/  ────────────────────►  the shared brain (edit here)
  data/     i18n.js, tasbih-phrases.js
  logic/    prayer-engine, scheduler-core, dhikr-core, notify-plan, lock-config
  platform/ platform.js (the contract) + vendor/ (adhan, tz-lookup)
  ui/       popup.*, welcome.*, theme.css, overlay-*.js
  assets/   fonts/, icons/

targets/<t>/ ──────────────►  the thin shell (owns the platform layer)
  extension/  manifest.json · background.js (service worker) · adapter.js
  desktop/    src-tauri/ (Rust) · web/ (adapter.js, scheduler/lock/tasbih html)
  mobile/     android/ (Java native) · web/ (adapter.js, index/lock html)

tools/sync-core.mjs ───────►  the "build": flat-assembles core/ + targets/<t>/
                              into the target's gitignored web-asset dir.
```

## The one rule that keeps this sane

**`core/` may never reference a platform API directly.** It talks only to
`globalThis.__PTPlatform` (the `Platform` object each shell sets up in its own
`adapter.js`). If core needs something a platform can't do, it goes through a
**capability check**, not a platform name check:

```js
// GOOD — core asks "can this platform do X?" and degrades if not.
if (Platform.permissions) {
  const ok = await Platform.permissions.ensureLockAccess();
  ...
}

// BAD — core should never know which shell it's running in.
if (Platform.name === "chrome") { ... }
```

A missing capability is a **feature that legitimately diverges**, not a bug.

## What's allowed to diverge (and does)

| Feature            | Extension            | Desktop (Tauri)      | Mobile (Android)     |
| ------------------ | -------------------- | -------------------- | -------------------- |
| Prayer times / UI  | shared core          | shared core          | shared core          |
| Scheduling         | `chrome.alarms`      | Rust timer           | AlarmManager (WIP)   |
| Notifications      | `chrome.notifications` | OS native          | OS native            |
| **Tab lock**       | ✅ blocks the tab    | ➖ not applicable    | ➖ not applicable     |
| Dhikr overlay      | injected on page     | own webview window   | native (WIP)         |
| `<all_urls>` grant | optional, runtime    | n/a                  | n/a                  |

"Tab lock" is a *browser* concept — do not try to force it onto desktop/mobile.
Those shells simply don't provide the `permissions`/enforce capabilities, and
core skips the feature automatically.

## Build & run

```
npm run sync            # assemble the extension  -> targets/extension/build/
npm run sync:desktop    # assemble desktop         -> targets/desktop/src/
npm run sync:mobile     # assemble mobile          -> targets/mobile/www/
npm run sync:all        # all three at once
```

The three output dirs are **generated artifacts** and are `.gitignore`d — they
are never edited by hand and never committed. Edit `core/` (shared) or
`targets/<t>/` (that platform's shell), then re-run the matching `sync`.

- **Extension:** `npm run sync`, then load `targets/extension/build/` unpacked
  (or ↻ on `chrome://extensions` after each sync).
- **Desktop:** `npm run sync:desktop`, then `cargo tauri dev` in `targets/desktop/src-tauri/`.
- **Mobile:** `npm run sync:mobile`, then `npx cap copy android` + build in `targets/mobile/`.

## Where to make a change

- **Behavior/UI shared by all three** → edit `core/`, then `npm run sync:all`.
- **Only one platform** (scheduling, notifications, native wiring, permissions)
  → edit that target's shell (`adapter.js`, `background.js`, `main.rs`, the Java
  files). Never fork a `core/` file to change one platform — add a capability to
  the `Platform` contract instead.
