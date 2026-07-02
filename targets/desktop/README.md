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
| Low-level key hook (`WH_KEYBOARD_LL`, swallow Win/Alt+Tab/Alt+F4) | **TODO** — needs elevation |
| Camera disable (`CM_Disable_DevNode`) | **TODO** — needs elevation |
| Dhikr card window | **TODO** (`show_dhikr` stub) |

`Ctrl+Alt+Del` is intentionally not blocked (impossible in user mode — accepted).
The lock config (prayer name, localized strings, theme, duration) is built by the
web layer and passed through `start_lock`; for real (non-test) locks the scheduler
must build and pass it the same way the extension's `lockStrings()` does.

> **Build prerequisite not yet installed on this machine:** Rust (1.96) is
> installed, but the **MSVC C++ Build Tools (`link.exe`) are not** — `cargo check`
> fails at the link step (`error: linking with link.exe failed`). Install
> "Visual Studio Build Tools" with the **Desktop development with C++** workload
> (~2–6 GB), then `cargo check` / `tauri dev` will work. Until then the Rust in
> `src-tauri/` is unverified (written against `windows` crate 0.58 + Tauri 2 APIs;
> the `windows` COM surface may need a tweak or two on first real compile). The
> web layer (`src/`, assembled by sync-core) is complete and verified.
