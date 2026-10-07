# Desktop target (Windows / Tauri 2)

Shares `core/` with the extension via `tools/sync-core.mjs desktop`, which
assembles the web layer into `src/`. The shared `popup.html` is the settings
window; `web/lock.html` is the full-screen lock window (reuses
`core/ui/overlay-lock.js`). The web ⇄ native bridge is `web/adapter.js`
(`Platform` over Tauri `invoke`).

## Build / run

```
# from targets/desktop/src-tauri  (Rust + MSVC build tools required; installed)
npx @tauri-apps/cli dev      # sync-core runs via beforeDevCommand
npx @tauri-apps/cli build    # NSIS installer (<10 MB target)
```

### Microsoft Store package (MSIX)

The Store takes an MSIX built from the release exe plus `msix/layout/`
(manifest + logos). The Store re-signs it, so it can go up unsigned.

```
# 1. bump the version in all three: src-tauri/tauri.conf.json, src-tauri/Cargo.toml,
#    msix/layout/AppxManifest.xml (Version="x.y.z.0")
# 2. from targets/desktop/src-tauri (rustup's cargo may not be on PATH:
#    ~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin)
npx @tauri-apps/cli build --no-bundle
# 3. from targets/desktop/msix
copy ..\src-tauri\target\release\prayer-desktop.exe layout\
"C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\makeappx.exe" pack /d layout /p PrayerTimesReminder-x.y.z-x64.msix /o
```

The exe and `*.msix` are gitignored. The manifest declares `microphone`
for the dhikr game (Web Speech in WebView2).

### Telling installed copies about a new version

`web/scheduler.js` checks a minute after start and then daily, and shows a
toast once per version (`updater.rs`):
- **Store (MSIX) installs** ask the Microsoft Store. A click has the Store
  download and install the update. Nothing to publish beyond the Store
  submission.
- **setup.exe / MSI installs** read GitHub Releases. For every desktop version,
  publish a release tagged **`desktop-v<version>`** (e.g. `desktop-v1.0.11`)
  with the NSIS `…-setup.exe` (and optionally the `.msi`) attached. A click
  opens the installer's download link.

```
gh release create desktop-v1.0.11 "PrayerTimesReminder-windows-1.0.11-setup.exe" --title "Windows 1.0.11" --notes "…"
```

`cargo check` validates the Rust without a GUI. `tauri.conf.json` sets
`withGlobalTauri` (so `window.__TAURI__` is available to `adapter.js`),
`frontendDist: ../src`, and the hidden tray-launched settings window.

## Native enforcement — status (`src-tauri/src/main.rs`)

| Feature | State |
|---|---|
| Tray + single-instance + autostart | scaffolded |
| Full-screen always-on-top lock window per monitor | done (`start_lock`/`clear_lock`, emits `activate-lock`) |
| Core Audio mute speaker + mic (`eRender`/`eCapture`) | done (`audio::set_mute`) |
| Auto-unlock timer (Rust fallback) | done |
| **Real prayer-time scheduling** | **done** — hidden `background` window runs `scheduler.js` off `scheduler-core` + `prayer-engine` + `lock-config`, fires `start_lock` at each prayer |
| Settings window hide-on-close + tray reopen | done |
| Low-level key hook (`WH_KEYBOARD_LL` + `WH_MOUSE_LL`, swallow Win/Alt+Tab/Alt+F4) | done (`input_block`; strict locks only; `Ctrl+Alt+U` emergency unlock) |
| Camera disable | done (`camera::disable` — per-user HKCU `ConsentStore\webcam` consent toggle; reversible, no admin, crash-recovery on startup) |
| Dhikr card window | done (`show_dhikr` → transparent per-monitor `tasbih.html`, reuses `overlay-tasbih.js`) |
| Dhikr game | done (`open_game` → resizable `game` window; speech = WebView2 Web Speech via shared `speech-web.js`; email or Google sign-in — Google runs in the default browser and returns to a loopback port, see `google_auth.rs`; the web client must list `http://127.0.0.1:53917/`, `:53918/` and `:53919/` as redirect URIs) |
| Run elevated in release (`requireAdministrator`) | done (`build.rs` embeds the manifest for `--release` only; debug stays as-invoker) |

`Ctrl+Alt+Del` is intentionally not blocked (impossible in user mode — accepted).
The lock config (prayer name, localized strings, theme, duration) is built by the
web layer and passed through `start_lock`; for real (non-test) locks the scheduler
must build and pass it the same way the extension's `lockStrings()` does.

> **Build status:** the toolchain (Rust 1.96 + MSVC 2022 Build Tools with the C++
> workload) is installed; `cargo check` and `cargo build --release` pass cleanly.
> Camera disable uses the per-user camera **consent toggle** (fully reversible, no
> admin); the low-level input hook is more reliable when the app runs elevated,
> which the **release** build does via the `requireAdministrator` manifest embedded
> in `build.rs` (debug builds stay as-invoker so `tauri dev` doesn't prompt UAC).
>
> **Follow-up (elevation × autostart):** `requireAdministrator` makes Windows prompt
> for UAC at launch, and the autostart Run-key entry can't silently elevate. To
> auto-start elevated without a prompt, register a Task Scheduler task with "run with
> highest privileges" instead of the Run key. Not yet done.
