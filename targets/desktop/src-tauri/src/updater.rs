// New-version notice for the desktop app. The hidden scheduler window
// (web/scheduler.js) decides when to look and with what wording; this side
// does what only native code can:
//
//   * store_update_version — a Microsoft Store install asks the Store
//     (StoreContext) for a pending update of this package.
//   * notify_update — shows a Windows toast; clicking it either has the Store
//     download + install the update, or (setup.exe / MSI installs, which learn
//     about versions from GitHub Releases in scheduler.js) opens the new
//     installer's download link.

use tauri::Manager;
use tauri_winrt_notification::Toast;

// <Application Id> in msix/layout/AppxManifest.xml.
#[cfg(windows)]
const MSIX_APPLICATION_ID: &str = "PrayerTimesReminder";

// The AppUserModelID toasts must carry: a packaged (Store) app has to use its
// own package identity; an installed setup.exe/MSI build uses the bundle
// identifier (what tauri-plugin-notification uses); a dev build from
// target\debug|release isn't registered, so it borrows PowerShell's.
fn toast_app_id(identifier: &str) -> String {
    #[cfg(windows)]
    {
        if let Ok(name) = windows::ApplicationModel::Package::Current()
            .and_then(|p| p.Id())
            .and_then(|id| id.FamilyName())
        {
            return format!("{name}!{MSIX_APPLICATION_ID}");
        }
    }
    let dev = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_string_lossy().to_ascii_lowercase()))
        .map(|d| d.ends_with("\\target\\debug") || d.ends_with("\\target\\release"))
        .unwrap_or(false);
    if dev {
        Toast::POWERSHELL_APP_ID.to_string()
    } else {
        identifier.to_string()
    }
}

/// Store install: the version of a pending Store update ("1.0.11.0"), or None
/// (no update, not a Store install, offline).
#[tauri::command]
pub async fn store_update_version() -> Option<String> {
    tauri::async_runtime::spawn_blocking(store_update_version_blocking)
        .await
        .ok()
        .flatten()
}

#[cfg(windows)]
fn store_update_version_blocking() -> Option<String> {
    use windows::Services::Store::StoreContext;
    let ctx = StoreContext::GetDefault().ok()?;
    let updates = ctx.GetAppAndOptionalStorePackageUpdatesAsync().ok()?.get().ok()?;
    if updates.Size().ok()? == 0 {
        return None;
    }
    let v = updates.GetAt(0).ok()?.Package().ok()?.Id().ok()?.Version().ok()?;
    Some(format!("{}.{}.{}.{}", v.Major, v.Minor, v.Build, v.Revision))
}

#[cfg(not(windows))]
fn store_update_version_blocking() -> Option<String> {
    None
}

/// Shows the "new version" toast. With `url` (a GitHub release installer), a
/// click opens it in the browser; without, a click installs the Store update.
#[tauri::command]
pub fn notify_update(
    app: tauri::AppHandle,
    title: String,
    body: String,
    url: Option<String>,
) -> Result<(), String> {
    let app_id = toast_app_id(&app.config().identifier);
    let handle = app.clone();
    Toast::new(&app_id)
        .title(&title)
        .text1(&body)
        .on_activated(move |_| {
            match &url {
                Some(u) => {
                    let _ = crate::google_auth::open_browser(u);
                }
                None => install_store_update(&handle),
            }
            Ok(())
        })
        .show()
        .map_err(|e| e.to_string())
}

// The Store shows its own download/install progress and restarts the app. A
// desktop (Win32) app must hand StoreContext an owner window first.
fn install_store_update(app: &tauri::AppHandle) {
    #[cfg(windows)]
    {
        let hwnd = app
            .get_webview_window("settings")
            .and_then(|w| w.hwnd().ok())
            .map(|h| h.0 as isize)
            .unwrap_or(0);
        std::thread::spawn(move || {
            let _ = (|| -> windows::core::Result<()> {
                use windows::core::Interface;
                use windows::Services::Store::StoreContext;
                use windows::Win32::{Foundation::HWND, UI::Shell::IInitializeWithWindow};
                let ctx = StoreContext::GetDefault()?;
                let init: IInitializeWithWindow = ctx.cast()?;
                unsafe { init.Initialize(HWND(hwnd as _))? };
                let updates = ctx.GetAppAndOptionalStorePackageUpdatesAsync()?.get()?;
                if updates.Size()? > 0 {
                    ctx.RequestDownloadAndInstallStorePackageUpdatesAsync(&updates)?.get()?;
                }
                Ok(())
            })();
        });
    }
    #[cfg(not(windows))]
    let _ = app;
}
