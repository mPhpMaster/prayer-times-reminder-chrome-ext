// Prayer desktop (Tauri 2) — native prayer-time enforcement on Windows.
//
// Realizes the full vision locally: a full-screen, always-on-top lock window per
// monitor (reusing the shared overlay-lock.js UI) plus Core Audio mute of the
// default speaker + microphone, with an auto-unlock timer. The web layer talks
// to this via Platform.enforce (adapter.js -> invoke). Key-hook input blocking
// and camera disable need elevation and are staged separately (see README).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder,
};

#[derive(Default)]
struct AppState {
    // The active lock config (raw JSON built by the web layer); None when idle.
    lock_config: Mutex<Option<serde_json::Value>>,
    // The last dhikr config, so the dhikr window can pull it on load (no race).
    dhikr_config: Mutex<Option<serde_json::Value>>,
    // When the tray popup was last hidden — used to debounce the tray click so a
    // click that blurs (hides) the popup doesn't immediately reopen it.
    popup_hidden_at: Mutex<Option<std::time::Instant>>,
}

// Logical size of the tray popup (matches tauri.conf).
const POPUP_W: f64 = 360.0;
const POPUP_H: f64 = 600.0;

const TEST_LOCK_SECONDS: u64 = 10;
const DEFAULT_LOCK_SECONDS: u64 = 300;

// --- Debug logging (temporary) -------------------------------------------------
// Appends to %TEMP%\prayer-debug.log so we can trace what happens without seeing
// the UI.
fn log_line(msg: &str) {
    use std::io::Write;
    let path = std::env::temp_dir().join("prayer-debug.log");
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(f, "{msg}");
    }
}

#[tauri::command]
fn log_js(msg: String) {
    log_line(&format!("[js] {msg}"));
}

// --- WebView2 memory trimming ---------------------------------------------------
// The app keeps two resident webviews (settings popup + hidden scheduler); left
// alone, each idles at WebView2's default working set. LOW memory target lets the
// browser shrink caches; TrySuspend additionally parks a *hidden* webview's
// renderer like an Edge sleeping tab (WebView2 auto-resumes it on show). Never
// suspend the scheduler — its timers fire the prayer locks.
#[cfg(windows)]
fn trim_webview_memory(win: &tauri::WebviewWindow, low: bool, suspend: bool) {
    let label = win.label().to_string();
    let _ = win.with_webview(move |wv| {
        use webview2_com::Microsoft::Web::WebView2::Win32::{
            ICoreWebView2_19, ICoreWebView2_3, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL,
        };
        use windows_core::Interface;
        let controller = wv.controller();
        let core = match unsafe { controller.CoreWebView2() } {
            Ok(c) => c,
            Err(e) => {
                log_line(&format!("trim_webview_memory({label}): no core: {e}"));
                return;
            }
        };
        if let Ok(v19) = core.cast::<ICoreWebView2_19>() {
            let level = COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL(if low { 1 } else { 0 });
            let _ = unsafe { v19.SetMemoryUsageTargetLevel(level) };
        }
        if suspend {
            if let Ok(v3) = core.cast::<ICoreWebView2_3>() {
                let handler = webview2_com::TrySuspendCompletedHandler::create(Box::new(
                    move |_hr, _suspended| Ok(()),
                ));
                let _ = unsafe { v3.TrySuspend(&handler) };
            }
        }
    });
}

#[cfg(not(windows))]
fn trim_webview_memory(_win: &tauri::WebviewWindow, _low: bool, _suspend: bool) {}

// Open one full-screen, always-on-top lock window per monitor and push the
// config to each. Idempotent per label so re-entry doesn't stack windows.
fn open_lock_windows(app: &tauri::AppHandle, config: &serde_json::Value) -> Result<(), String> {
    let monitors = app.available_monitors().unwrap_or_default();
    log_line(&format!("open_lock_windows: monitors={}", monitors.len()));
    if monitors.is_empty() {
        build_lock_window(app, "lock-0", None, config)?;
        return Ok(());
    }
    // One lock window per monitor — building them all `.fullscreen(true)` would
    // stack them on the primary display, so we position each one on its monitor
    // first, then fullscreen it there.
    for (i, monitor) in monitors.iter().enumerate() {
        build_lock_window(app, &format!("lock-{i}"), Some(monitor), config)?;
    }
    Ok(())
}

fn build_lock_window(
    app: &tauri::AppHandle,
    label: &str,
    monitor: Option<&tauri::Monitor>,
    config: &serde_json::Value,
) -> Result<(), String> {
    if app.get_webview_window(label).is_some() {
        log_line(&format!("build_lock_window: {label} already exists"));
        return Ok(());
    }
    let win = match WebviewWindowBuilder::new(app, label, WebviewUrl::App("lock.html".into()))
        .always_on_top(true)
        .decorations(false)
        .skip_taskbar(true)
        // A lock screen must be a fixed, full-monitor cover: not resizable (no
        // edge-drag) and not minimizable (can't be shrunk away to bypass it).
        .resizable(false)
        .minimizable(false)
        .maximizable(false)
        .visible(false)
        .build()
    {
        Ok(w) => w,
        Err(e) => {
            log_line(&format!("build_lock_window: {label} BUILD ERROR: {e}"));
            return Err(e.to_string());
        }
    };
    log_line(&format!("build_lock_window: {label} built ok"));
    // Cover the target monitor exactly with position + size. We do NOT use
    // set_fullscreen: fullscreen re-targets the window to whichever monitor
    // Windows thinks it's on, which stacked every lock window on the primary
    // display (so only one screen got covered).
    if let Some(m) = monitor {
        let _ = win.set_position(*m.position());
        let _ = win.set_size(*m.size());
        // Pin the window to its monitor: `resizable(false)` stops edge-drags,
        // but the window can still be MOVED (Win+Shift+Arrow, snap shortcuts…)
        // whenever manual unlock is allowed and the input hooks aren't engaged.
        // Snap it straight back on any move away from its spot.
        let expected = *m.position();
        let size = *m.size();
        let win_snap = win.clone();
        win.on_window_event(move |event| {
            if let tauri::WindowEvent::Moved(pos) = event {
                if *pos != expected {
                    let _ = win_snap.set_position(expected);
                    let _ = win_snap.set_size(size);
                }
            }
        });
    } else {
        let _ = win.set_fullscreen(true);
    }
    let _ = win.show();
    let _ = win.set_focus();
    let _ = win.emit("activate-lock", config.clone());
    Ok(())
}

fn close_lock_windows(app: &tauri::AppHandle) {
    for (label, win) in app.webview_windows() {
        if label.starts_with("lock-") {
            let _ = win.close();
        }
    }
}

// Mute/unmute off the main thread — a slow Core Audio COM call must never be
// able to freeze the UI / event loop (that was the "hangs, can't close" bug).
#[cfg(windows)]
fn audio_mute_async(mute: bool) {
    std::thread::spawn(move || {
        let _ = audio::set_mute(mute);
    });
}

// Block/restore app camera access off the main thread (the registry write is
// fast, but keep the lock/unlock path non-blocking, like audio).
#[cfg(windows)]
fn camera_block_async(block: bool) {
    std::thread::spawn(move || {
        if block {
            camera::disable();
        } else {
            camera::enable();
        }
    });
}

// Do the actual clearing. MUST run on the main thread (window ops); call it via
// clear_on_main from timer / shortcut threads.
fn do_clear(app: &tauri::AppHandle) {
    // Restore input first so the user regains control immediately.
    #[cfg(windows)]
    input_block::stop();
    if let Some(state) = app.try_state::<AppState>() {
        *state.lock_config.lock().unwrap() = None;
    }
    close_lock_windows(app);
    #[cfg(windows)]
    audio_mute_async(false);
    #[cfg(windows)]
    camera_block_async(false);
}

// Run clearing on a fresh worker thread. Window ops dispatched from a worker
// reach the (free) main event loop and complete; doing them ON the main thread
// (run_on_main_thread) deadlocks, because WebView window ops need that loop free.
fn clear_lock_spawn(app: &tauri::AppHandle) {
    let a = app.clone();
    std::thread::spawn(move || do_clear(&a));
}

#[tauri::command]
fn start_lock(
    app: tauri::AppHandle,
    state: State<AppState>,
    config: serde_json::Value,
) -> Result<(), String> {
    log_line("start_lock: command entered");
    *state.lock_config.lock().unwrap() = Some(config.clone());

    // Create the lock windows from a worker thread (build() dispatches to the
    // free main event loop — see clear_lock_spawn note).
    let app_win = app.clone();
    let cfg = config.clone();
    std::thread::spawn(move || {
        let _ = open_lock_windows(&app_win, &cfg);
    });

    // Silence the machine for the prayer, EXCEPT our own prayer-time announcement
    // (chime/adhan). Only when "silent during prayer" is on (config.silent,
    // default true); off → leave audio untouched. The mute spares our process
    // tree (audio::set_mute), so the sound plays even in silent mode — no timing
    // hack needed. Every other app is muted immediately.
    let silent = config.get("silent").and_then(|v| v.as_bool()).unwrap_or(true);
    #[cfg(windows)]
    if silent {
        audio_mute_async(true);
    }
    #[cfg(windows)]
    camera_block_async(true);

    // Strict lock (manual unlock off) → block all keyboard + mouse so the covered
    // screen can't be moved (Win+Arrow / drag), Alt-Tabbed, or clicked. Lenient
    // locks keep input live so the ✕ / Esc unlock still works.
    #[cfg(windows)]
    if !config.get("allowUnlock").and_then(|v| v.as_bool()).unwrap_or(false) {
        input_block::start();
    }

    // Auto-unlock fallback so a user is never trapped if the JS timer is lost.
    let is_test = config.get("test").and_then(|v| v.as_bool()).unwrap_or(false);
    let secs = config
        .get("durationSecs")
        .and_then(|v| v.as_u64())
        .unwrap_or(if is_test { TEST_LOCK_SECONDS } else { DEFAULT_LOCK_SECONDS });
    let app_timer = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(secs));
        clear_lock_spawn(&app_timer);
    });
    Ok(())
}

#[tauri::command]
fn clear_lock(app: tauri::AppHandle) -> Result<(), String> {
    clear_lock_spawn(&app);
    Ok(())
}

#[tauri::command]
fn get_lock_config(state: State<AppState>) -> Option<serde_json::Value> {
    state.lock_config.lock().unwrap().clone()
}

#[tauri::command]
fn get_dhikr_config(state: State<AppState>) -> Option<serde_json::Value> {
    state.dhikr_config.lock().unwrap().clone()
}

#[tauri::command]
fn show_dhikr(
    app: tauri::AppHandle,
    state: State<AppState>,
    config: serde_json::Value,
) -> Result<(), String> {
    log_line("show_dhikr: command entered");
    // Store first so the window can pull it on load (get_dhikr_config).
    *state.dhikr_config.lock().unwrap() = Some(config);

    // Build + place the dhikr overlay(s) from a worker thread — one transparent
    // click-through window per monitor (like the lock), so the balloon shows on
    // every screen and always above everything.
    let app_win = app.clone();
    std::thread::spawn(move || {
        for (label, w) in app_win.webview_windows() {
            if label.starts_with("dhikr") {
                let _ = w.close();
            }
        }
        let monitors = app_win.available_monitors().unwrap_or_default();
        let count = monitors.len().max(1);
        for i in 0..count {
            let label = format!("dhikr-{i}");
            let win = match WebviewWindowBuilder::new(
                &app_win,
                &label,
                WebviewUrl::App("tasbih.html".into()),
            )
            .transparent(true)
            .always_on_top(true)
            .decorations(false)
            .skip_taskbar(true)
            .resizable(false)
            .focused(false)
            .visible(false)
            .build()
            {
                Ok(w) => w,
                Err(e) => {
                    log_line(&format!("show_dhikr: {label} build ERROR: {e}"));
                    continue;
                }
            };
            // Cover this monitor exactly (position + size, NOT set_fullscreen —
            // that retargets to the primary and can misplace on multi-monitor).
            // The window is transparent + click-through, so it reads as a floating
            // balloon: the shared overlay-tasbih.js anchors the card to the corner
            // chosen in Settings, exactly like the extension does in a tab.
            if let Some(m) = monitors.get(i) {
                let _ = win.set_position(*m.position());
                let _ = win.set_size(*m.size());
            }
            let _ = win.set_ignore_cursor_events(true);
            let _ = win.show();
            // Re-assert topmost AFTER show: among HWND_TOPMOST windows the most
            // recently asserted wins, so the balloon lands above other
            // always-on-top windows (including our own settings popup).
            let _ = win.set_always_on_top(true);
        }
        log_line(&format!("show_dhikr: {count} window(s) shown"));
    });

    // Auto-close after the card's own dismiss (close from a worker thread).
    let app_close = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(12));
        for (label, w) in app_close.webview_windows() {
            if label.starts_with("dhikr") {
                let _ = w.close();
            }
        }
    });
    Ok(())
}

// Anchor the popup to the bottom-right of the primary monitor, just above the
// taskbar/clock — like a tray flyout.
fn position_popup(win: &tauri::WebviewWindow) {
    if let Ok(Some(m)) = win.primary_monitor() {
        let scale = m.scale_factor();
        let size = m.size();
        let pos = m.position();
        let w = (POPUP_W * scale) as i32;
        let h = (POPUP_H * scale) as i32;
        let margin = (12.0 * scale) as i32;
        let taskbar = (56.0 * scale) as i32;
        let x = pos.x + size.width as i32 - w - margin;
        let y = pos.y + size.height as i32 - h - taskbar;
        let _ = win.set_position(tauri::PhysicalPosition::new(x, y));
    }
}

fn show_popup(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("settings") {
        position_popup(&win);
        // Showing auto-resumes a suspended webview; also lift the memory cap.
        trim_webview_memory(&win, false, false);
        let _ = win.show();
        let _ = win.set_focus();
        // The window survives between opens, so reopen on the main view even if
        // it was dismissed while on Settings.
        let _ = win.eval("window.__ptPopupReset && window.__ptPopupReset();");
    }
}

fn hide_popup(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.hide();
        // Park the hidden popup: low memory target + suspend its renderer.
        trim_webview_memory(&win, true, true);
        if let Some(state) = app.try_state::<AppState>() {
            *state.popup_hidden_at.lock().unwrap() = Some(std::time::Instant::now());
        }
    }
}

// Tray left-click: show if hidden, hide if shown. Debounced so the click that
// blurred+hid the popup doesn't immediately reopen it.
fn toggle_popup(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("settings") {
        if win.is_visible().unwrap_or(false) {
            hide_popup(app);
        } else {
            let just_hid = app
                .try_state::<AppState>()
                .and_then(|s| *s.popup_hidden_at.lock().unwrap())
                .map(|t| t.elapsed().as_millis() < 300)
                .unwrap_or(false);
            if !just_hid {
                show_popup(app);
            }
        }
    }
}

// Quit: kill the whole process tree (incl. WebView2 children) so nothing lingers
// even if a window is stuck, then exit.
fn quit_app(app: &tauri::AppHandle) {
    #[cfg(windows)]
    {
        // Restore camera access before we hard-kill the process tree.
        camera::enable();
        let pid = std::process::id().to_string();
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid])
            .spawn();
    }
    app.exit(0);
}

// --- Companion Chrome extension ---------------------------------------------
// The published Web Store id (see the READMEs' store link) and listing URL.
const CHROME_EXT_ID: &str = "knahkbkmbjghaiillhngjbhoinmeegoc";
const CHROME_STORE_URL: &str =
    "https://chromewebstore.google.com/detail/prayer-times-reminder/knahkbkmbjghaiillhngjbhoinmeegoc";

// True if any Chromium-based browser on this machine has the extension installed
// — its unpacked folder `<UserData>/<Profile>/Extensions/<id>/` exists on disk.
#[tauri::command]
fn chrome_extension_installed() -> bool {
    let mut roots: Vec<std::path::PathBuf> = Vec::new();
    if let Some(local) = std::env::var_os("LOCALAPPDATA").map(std::path::PathBuf::from) {
        for rel in [
            "Google/Chrome/User Data",
            "Google/Chrome Beta/User Data",
            "Microsoft/Edge/User Data",
            "BraveSoftware/Brave-Browser/User Data",
            "Chromium/User Data",
            "Vivaldi/User Data",
        ] {
            roots.push(local.join(rel));
        }
    }
    if let Some(roaming) = std::env::var_os("APPDATA").map(std::path::PathBuf::from) {
        // Opera keeps its profile directly (no "User Data" wrapper).
        roots.push(roaming.join("Opera Software/Opera Stable"));
        roots.push(roaming.join("Opera Software/Opera GX Stable"));
    }
    roots.iter().any(|r| profile_has_ext(r))
}

// Scan each profile dir under `root` (Default, Profile 1, …) for the extension,
// and also `root` itself (Opera stores the profile at the root).
fn profile_has_ext(root: &std::path::Path) -> bool {
    if root.join("Extensions").join(CHROME_EXT_ID).is_dir() {
        return true;
    }
    let Ok(entries) = std::fs::read_dir(root) else {
        return false;
    };
    entries.flatten().any(|e| {
        e.file_type().map(|t| t.is_dir()).unwrap_or(false)
            && e.path().join("Extensions").join(CHROME_EXT_ID).is_dir()
    })
}

// --- Launch on Windows startup (autostart plugin) --------------------------
#[tauri::command]
fn get_autostart(app: tauri::AppHandle) -> bool {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    let mgr = app.autolaunch();
    if enabled { mgr.enable() } else { mgr.disable() }.map_err(|e| e.to_string())
}

// Open the Web Store listing in the user's default browser.
#[tauri::command]
fn open_chrome_store() -> Result<(), String> {
    #[cfg(windows)]
    std::process::Command::new("cmd")
        .args(["/C", "start", "", CHROME_STORE_URL])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

// Prefer a WebView2 runtime bundled next to the exe. The MSIX/Store build ships a
// fixed-version runtime under `WebView2Runtime\`; pointing the WebView2 loader at
// it (via WEBVIEW2_BROWSER_EXECUTABLE_FOLDER, which the loader honors even when the
// app passes a null browser folder) means the app never depends on the machine
// having the Evergreen runtime installed — the cause of the Store-cert launch
// crash. Absent (dev / NSIS build) => falls back to the Evergreen runtime.
#[cfg(windows)]
fn use_bundled_webview2() {
    if std::env::var_os("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER").is_some() {
        return; // respect an explicit override (e.g. remote-debugging sessions)
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let rt = dir.join("WebView2Runtime");
            if rt.join("msedgewebview2.exe").exists() {
                std::env::set_var("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER", &rt);
                let msg = format!("webview2: using bundled runtime at {}", rt.display());
                log_line(&msg);
                crashlog::write(&msg);
            } else {
                crashlog::write("webview2: no bundled runtime, using Evergreen");
            }
        }
    }
}

// Let the lock window autoplay the prayer-time announcement (chime/adhan) without
// a user gesture — WebView2 otherwise blocks programmatic audio. Appends to any
// existing args so a debugging --remote-debugging-port isn't clobbered.
#[cfg(windows)]
fn enable_webview_autoplay() {
    const KEY: &str = "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS";
    const ARG: &str = "--autoplay-policy=no-user-gesture-required";
    let existing = std::env::var(KEY).unwrap_or_default();
    if existing.contains("autoplay-policy") {
        return;
    }
    let combined = if existing.trim().is_empty() {
        ARG.to_string()
    } else {
        format!("{existing} {ARG}")
    };
    std::env::set_var(KEY, combined);
}

fn main() {
    // Install crash logging FIRST so any startup failure (a Rust panic or a native
    // COM/WebView2 exception) is written to a retrievable file before the process
    // dies — this is what makes a Store-cert launch failure diagnosable.
    #[cfg(windows)]
    crashlog::install();
    // Force the bundled WebView2 runtime when present (MSIX/Store build).
    #[cfg(windows)]
    use_bundled_webview2();
    // Allow the lock window to autoplay the prayer-time sound.
    #[cfg(windows)]
    enable_webview_autoplay();
    log_line("main: starting");

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            show_popup(app);
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        // Emergency unlock: Ctrl+Alt+U clears any active lock even if its overlay
        // failed to render — the user can never get stuck.
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        log_line("global-shortcut: emergency unlock fired");
                        clear_lock_spawn(app);
                    }
                })
                .build(),
        )
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            start_lock,
            clear_lock,
            get_lock_config,
            show_dhikr,
            get_dhikr_config,
            chrome_extension_installed,
            open_chrome_store,
            get_autostart,
            set_autostart,
            log_js
        ])
        .setup(|app| {
            // Let the input-block keyboard hook clear the lock on Ctrl+Alt+U
            // (while input is blocked, the global-shortcut plugin can't fire).
            #[cfg(windows)]
            input_block::set_app(app.handle().clone());

            // Undo a leftover camera "Deny" if a previous session crashed while
            // locked (restores the user's prior value from the marker file).
            #[cfg(windows)]
            camera::recover();

            // Register the emergency-unlock shortcut (Ctrl+Alt+U).
            {
                use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
                match app.global_shortcut().register(Shortcut::new(
                    Some(Modifiers::CONTROL | Modifiers::ALT),
                    Code::KeyU,
                )) {
                    Ok(_) => log_line("global-shortcut: Ctrl+Alt+U registered"),
                    Err(e) => log_line(&format!("global-shortcut: register FAILED: {e}")),
                }
            }

            // Tray-only app: the settings window starts hidden (see tauri.conf).
            let open = MenuItem::with_id(app, "open", "Open", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;
            TrayIconBuilder::new()
                .menu(&menu)
                // Left-click toggles the popup; the menu is right-click only.
                .show_menu_on_left_click(false)
                .icon(app.default_window_icon().unwrap().clone())
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_popup(app),
                    "quit" => quit_app(app),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_popup(tray.app_handle());
                    }
                })
                .build(app)?;

            // Tray-flyout behavior: the popup stays always-on-top while open, but
            // clicking anywhere outside (blur) dismisses it — like the volume/clock
            // flyouts. Close also just hides (not destroys), so the hidden
            // background scheduler keeps the app alive. The 300ms debounce in
            // toggle_popup keeps the tray click that caused the blur from
            // immediately reopening it.
            if let Some(settings) = app.get_webview_window("settings") {
                let handle = app.handle().clone();
                settings.on_window_event(move |event| match event {
                    tauri::WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        hide_popup(&handle);
                    }
                    tauri::WindowEvent::Focused(false) => {
                        hide_popup(&handle);
                    }
                    _ => {}
                });
            }

            // First launch: reveal the settings window so the user can set things
            // up. Later runs (and Windows-startup launches) stay in the tray. A
            // marker file in the app config dir records that first run happened.
            if let Ok(dir) = app.path().app_config_dir() {
                let marker = dir.join("first-run-done");
                if !marker.exists() {
                    let _ = std::fs::create_dir_all(&dir);
                    let _ = std::fs::write(&marker, b"1");
                    show_popup(app.handle());
                }
            }

            // Trim the resident webviews once they've finished booting: the
            // scheduler always runs under a LOW memory target (its timers keep
            // running), and the settings popup is parked too if it's hidden
            // (tray-only start). Delayed so CoreWebView2 is fully initialized.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(10));
                if let Some(bg) = handle.get_webview_window("background") {
                    trim_webview_memory(&bg, true, false);
                }
                if let Some(settings) = handle.get_webview_window("settings") {
                    if !settings.is_visible().unwrap_or(true) {
                        trim_webview_memory(&settings, true, true);
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running prayer-desktop");
}

// --- Crash logging -------------------------------------------------------------
// Writes startup breadcrumbs and any fatal error to
// %LOCALAPPDATA%\PrayerTimesReminder\startup.log — a stable, user-retrievable path
// (unlike %TEMP%). Catches both Rust panics (via the panic hook, which still runs
// under panic=abort) and native structured exceptions such as a COM/WebView2
// failure (via SetUnhandledExceptionFilter). Purpose: if a Store-cert launch
// crash recurs, this file names the exact cause instead of leaving us guessing.
#[cfg(windows)]
mod crashlog {
    use std::io::Write;
    use std::path::PathBuf;

    pub fn log_path() -> PathBuf {
        let base = std::env::var_os("LOCALAPPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let dir = base.join("PrayerTimesReminder");
        let _ = std::fs::create_dir_all(&dir);
        dir.join("startup.log")
    }

    pub fn write(msg: &str) {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        if let Ok(mut f) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_path())
        {
            let _ = writeln!(f, "[{ts}] {msg}");
        }
    }

    pub fn install() {
        let prev = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |info| {
            write(&format!("PANIC: {info}"));
            prev(info);
        }));
        unsafe {
            windows::Win32::System::Diagnostics::Debug::SetUnhandledExceptionFilter(Some(
                seh_filter,
            ));
        }
        write("---- launch ----");
    }

    unsafe extern "system" fn seh_filter(
        info: *const windows::Win32::System::Diagnostics::Debug::EXCEPTION_POINTERS,
    ) -> i32 {
        let (mut code, mut addr) = (0u32, 0usize);
        if !info.is_null() {
            let rec = (*info).ExceptionRecord;
            if !rec.is_null() {
                code = (*rec).ExceptionCode.0 as u32;
                addr = (*rec).ExceptionAddress as usize;
            }
        }
        write(&format!(
            "UNHANDLED EXCEPTION: code=0x{code:08X} addr=0x{addr:016X}"
        ));
        0 // EXCEPTION_CONTINUE_SEARCH — let default (WER/terminate) proceed
    }
}

// --- Windows input lockdown: block all keyboard + mouse during a STRICT lock ---
// Global low-level hooks on a dedicated message-pump thread swallow every key and
// mouse event, so the covered screen can't be moved (Win+Arrow / drag), Alt-Tabbed,
// or clicked. Only engaged when manual unlock is off. Escapes that always work: the
// auto-unlock timer, Ctrl+Alt+Del (a secure sequence no hook can catch), and the
// in-hook emergency Ctrl+Alt+U, which clears the lock (and thus removes the hooks).
#[cfg(windows)]
mod input_block {
    use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
    use std::sync::OnceLock;
    use tauri::AppHandle;
    use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
    use windows::Win32::System::Threading::GetCurrentThreadId;
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, DispatchMessageW, GetMessageW, PostThreadMessageW, SetWindowsHookExW,
        UnhookWindowsHookEx, HC_ACTION, KBDLLHOOKSTRUCT, MSG, WH_KEYBOARD_LL, WH_MOUSE_LL,
        WM_KEYDOWN, WM_KEYUP, WM_QUIT, WM_SYSKEYDOWN, WM_SYSKEYUP,
    };

    static APP: OnceLock<AppHandle> = OnceLock::new();
    static ACTIVE: AtomicBool = AtomicBool::new(false);
    static THREAD_ID: AtomicU32 = AtomicU32::new(0);
    static CTRL_DOWN: AtomicBool = AtomicBool::new(false);
    static ALT_DOWN: AtomicBool = AtomicBool::new(false);

    // Give the hook a way to clear the lock (for the emergency combo).
    pub fn set_app(app: AppHandle) {
        let _ = APP.set(app);
    }

    unsafe extern "system" fn keyboard_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code == HC_ACTION as i32 {
            let kbd = &*(lparam.0 as *const KBDLLHOOKSTRUCT);
            let vk = kbd.vkCode;
            let m = wparam.0 as u32;
            let is_down = m == WM_KEYDOWN || m == WM_SYSKEYDOWN;
            let is_up = m == WM_KEYUP || m == WM_SYSKEYUP;
            match vk {
                0x11 | 0xA2 | 0xA3 => {
                    // Ctrl (VK_CONTROL / L / R)
                    if is_down {
                        CTRL_DOWN.store(true, Ordering::SeqCst);
                    } else if is_up {
                        CTRL_DOWN.store(false, Ordering::SeqCst);
                    }
                }
                0x12 | 0xA4 | 0xA5 => {
                    // Alt (VK_MENU / L / R)
                    if is_down {
                        ALT_DOWN.store(true, Ordering::SeqCst);
                    } else if is_up {
                        ALT_DOWN.store(false, Ordering::SeqCst);
                    }
                }
                0x55 => {
                    // 'U' — emergency unlock while input is blocked.
                    if is_down
                        && CTRL_DOWN.load(Ordering::SeqCst)
                        && ALT_DOWN.load(Ordering::SeqCst)
                    {
                        if let Some(app) = APP.get() {
                            crate::clear_lock_spawn(app);
                        }
                    }
                }
                _ => {}
            }
            return LRESULT(1); // swallow ALL keyboard input
        }
        CallNextHookEx(None, code, wparam, lparam)
    }

    unsafe extern "system" fn mouse_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code == HC_ACTION as i32 {
            return LRESULT(1); // swallow ALL mouse input (move, click, wheel)
        }
        CallNextHookEx(None, code, wparam, lparam)
    }

    pub fn start() {
        if ACTIVE.swap(true, Ordering::SeqCst) {
            return; // already running
        }
        std::thread::spawn(|| unsafe {
            CTRL_DOWN.store(false, Ordering::SeqCst);
            ALT_DOWN.store(false, Ordering::SeqCst);
            THREAD_ID.store(GetCurrentThreadId(), Ordering::SeqCst);
            let kb = SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_proc), None, 0);
            let ms = SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_proc), None, 0);
            // Pump messages so the LL hooks fire; exits on WM_QUIT from stop().
            let mut msg = MSG::default();
            while GetMessageW(&mut msg, None, 0, 0).as_bool() {
                DispatchMessageW(&msg);
            }
            if let Ok(k) = kb {
                let _ = UnhookWindowsHookEx(k);
            }
            if let Ok(m) = ms {
                let _ = UnhookWindowsHookEx(m);
            }
            THREAD_ID.store(0, Ordering::SeqCst);
            ACTIVE.store(false, Ordering::SeqCst);
        });
    }

    pub fn stop() {
        let tid = THREAD_ID.load(Ordering::SeqCst);
        if tid != 0 {
            unsafe {
                let _ = PostThreadMessageW(tid, WM_QUIT, WPARAM(0), LPARAM(0));
            }
        }
    }
}

// --- Windows Core Audio: "silent during prayer" without silencing the prayer ---
// The speaker mute is PER-SESSION and spares our own process tree, so the
// prayer-time announcement (chime/adhan) is still heard while every OTHER app is
// silenced — silent mode must not mute the prayer sound itself. The mic is muted
// at the endpoint (we never play through it, so that can't affect our sound).
#[cfg(windows)]
mod audio {
    use std::collections::HashSet;
    use windows::core::{Interface, Result};
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::Media::Audio::{
        eCapture, eRender, IAudioSessionControl2, IAudioSessionManager2, IMMDeviceEnumerator,
        ISimpleAudioVolume, MMDeviceEnumerator, DEVICE_STATE_ACTIVE,
    };
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
    };
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };

    // Every PID in our own process tree (this process + all descendants). WebView2
    // plays the adhan/chime from a CHILD process (msedgewebview2.exe), so sparing
    // only our own PID would still mute our sound — we must spare the whole subtree.
    fn our_process_tree() -> HashSet<u32> {
        let mut tree = HashSet::new();
        tree.insert(std::process::id());
        let mut pairs: Vec<(u32, u32)> = Vec::new(); // (pid, parent pid)
        unsafe {
            if let Ok(snap) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) {
                let mut e = PROCESSENTRY32W {
                    dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
                    ..Default::default()
                };
                if Process32FirstW(snap, &mut e).is_ok() {
                    loop {
                        pairs.push((e.th32ProcessID, e.th32ParentProcessID));
                        if Process32NextW(snap, &mut e).is_err() {
                            break;
                        }
                    }
                }
                let _ = CloseHandle(snap);
            }
        }
        // Grow the set with children of known members until it stops changing.
        loop {
            let mut added = false;
            for (pid, ppid) in &pairs {
                if tree.contains(ppid) && tree.insert(*pid) {
                    added = true;
                }
            }
            if !added {
                break;
            }
        }
        tree
    }

    pub fn set_mute(mute: bool) -> Result<()> {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;

            let spare = our_process_tree();

            // Speakers (every active render endpoint): walk each device's audio
            // sessions and mute all but our own subtree's. The user may be on a
            // non-default device, so we cover every active endpoint.
            if let Ok(collection) = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE) {
                let count = collection.GetCount().unwrap_or(0);
                for i in 0..count {
                    let Ok(device) = collection.Item(i) else {
                        continue;
                    };
                    let Ok(mgr) = device.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None) else {
                        continue;
                    };
                    let Ok(sessions) = mgr.GetSessionEnumerator() else {
                        continue;
                    };
                    let n = sessions.GetCount().unwrap_or(0);
                    for s in 0..n {
                        let Ok(ctrl) = sessions.GetSession(s) else {
                            continue;
                        };
                        let Ok(ctrl2) = ctrl.cast::<IAudioSessionControl2>() else {
                            continue;
                        };
                        let pid = ctrl2.GetProcessId().unwrap_or(0);
                        if pid != 0 && spare.contains(&pid) {
                            continue; // never mute our own prayer sound
                        }
                        if let Ok(vol) = ctrl2.cast::<ISimpleAudioVolume>() {
                            let _ = vol.SetMute(mute, std::ptr::null());
                        }
                    }
                }
            }

            // Microphone (every active capture endpoint): endpoint-level mute is
            // fine — we never play through the mic, so this can't touch our sound.
            if let Ok(collection) = enumerator.EnumAudioEndpoints(eCapture, DEVICE_STATE_ACTIVE) {
                let count = collection.GetCount().unwrap_or(0);
                for i in 0..count {
                    if let Ok(device) = collection.Item(i) {
                        if let Ok(volume) = device.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None)
                        {
                            let _ = volume.SetMute(mute, std::ptr::null());
                        }
                    }
                }
            }
        }
        Ok(())
    }
}

// --- Windows camera: block app camera access during a lock ------------------
// Uses the per-user "let apps use my camera" consent toggle
// (HKCU ...\ConsentStore\webcam\Value = "Deny"). Fully reversible, needs no
// admin, and can never leave the camera hardware-disabled. We save the prior
// value in a marker file so unlock — or, after a crash while locked, the next
// launch (camera::recover) — restores exactly what the user had.
#[cfg(windows)]
mod camera {
    use std::fs;
    use std::path::PathBuf;
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    const SUBKEY: &str =
        r"Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\webcam";
    const VALUE: &str = "Value";

    fn marker_path() -> PathBuf {
        std::env::temp_dir().join("prayer-cam-restore.txt")
    }

    fn read_value() -> String {
        RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey(SUBKEY)
            .and_then(|k| k.get_value::<String, _>(VALUE))
            .unwrap_or_else(|_| "Allow".to_string())
    }

    fn write_value(v: &str) {
        match RegKey::predef(HKEY_CURRENT_USER).create_subkey(SUBKEY) {
            Ok((key, _)) => {
                let _ = key.set_value(VALUE, &v.to_string());
            }
            Err(e) => crate::log_line(&format!("camera: write '{v}' FAILED: {e}")),
        }
    }

    // Block camera access; remember the prior value so we can restore it. The
    // marker is written only once per lock session so a re-lock can't overwrite
    // the saved value with our own "Deny".
    pub fn disable() {
        let marker = marker_path();
        if !marker.exists() {
            let _ = fs::write(&marker, read_value());
        }
        write_value("Deny");
        crate::log_line("camera: access set to Deny");
    }

    // Restore camera access to the saved prior value (default "Allow").
    pub fn enable() {
        let marker = marker_path();
        let target = fs::read_to_string(&marker)
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "Allow".to_string());
        let _ = fs::remove_file(&marker);
        write_value(&target);
        crate::log_line(&format!("camera: access restored to {target}"));
    }

    // On startup, undo a leftover "Deny" from a session that crashed while locked.
    pub fn recover() {
        if marker_path().exists() {
            crate::log_line("camera: recovering leftover Deny from a previous session");
            enable();
        }
    }
}
