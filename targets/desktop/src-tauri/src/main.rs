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

// Do the actual clearing. MUST run on the main thread (window ops); call it via
// clear_on_main from timer / shortcut threads.
fn do_clear(app: &tauri::AppHandle) {
    if let Some(state) = app.try_state::<AppState>() {
        *state.lock_config.lock().unwrap() = None;
    }
    close_lock_windows(app);
    #[cfg(windows)]
    audio_mute_async(false);
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

    #[cfg(windows)]
    audio_mute_async(true);

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

    // Build + place the small dhikr window from a worker thread.
    let app_win = app.clone();
    std::thread::spawn(move || {
        if let Some(w) = app_win.get_webview_window("dhikr") {
            let _ = w.close();
        }
        let win = match WebviewWindowBuilder::new(&app_win, "dhikr", WebviewUrl::App("tasbih.html".into()))
            .inner_size(380.0, 190.0)
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
                log_line(&format!("show_dhikr: build ERROR: {e}"));
                return;
            }
        };
        if let Ok(Some(m)) = win.primary_monitor() {
            let size = m.size();
            let pos = m.position();
            let scale = m.scale_factor();
            let x = pos.x + size.width as i32 - (400.0 * scale) as i32;
            let y = pos.y + size.height as i32 - (250.0 * scale) as i32;
            let _ = win.set_position(tauri::PhysicalPosition::new(x, y));
        }
        let _ = win.show();
        log_line("show_dhikr: window shown");
    });

    // Auto-close after the card's own dismiss (close from a worker thread).
    let app_close = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(12));
        if let Some(w) = app_close.get_webview_window("dhikr") {
            let _ = w.close();
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
        let _ = win.show();
        let _ = win.set_focus();
    }
}

fn hide_popup(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.hide();
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
        let pid = std::process::id().to_string();
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid])
            .spawn();
    }
    app.exit(0);
}

fn main() {
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
            log_js
        ])
        .setup(|app| {
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

            // Tray-flyout behavior: dismiss the popup when it loses focus (click
            // away) and hide (not destroy) on close, so the hidden background
            // scheduler keeps the app alive.
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
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running prayer-desktop");
}

// --- Windows Core Audio: mute/unmute default speaker (eRender) + mic (eCapture).
#[cfg(windows)]
mod audio {
    use windows::core::Result;
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::Media::Audio::{
        eCapture, eMultimedia, eRender, IMMDeviceEnumerator, MMDeviceEnumerator,
    };
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
    };

    pub fn set_mute(mute: bool) -> Result<()> {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
            for flow in [eRender, eCapture] {
                if let Ok(device) = enumerator.GetDefaultAudioEndpoint(flow, eMultimedia) {
                    let volume: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None)?;
                    let _ = volume.SetMute(mute, std::ptr::null());
                }
            }
        }
        Ok(())
    }
}
