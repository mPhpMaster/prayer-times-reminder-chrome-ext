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
