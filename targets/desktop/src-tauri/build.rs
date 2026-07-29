fn main() {
    // Windows: run as-invoker (NEVER requireAdministrator).
    //
    // An elevated manifest makes the app impossible to ship on the Microsoft
    // Store: a packaged (MSIX) full-trust app cannot request elevation, so
    // activation fails outright with ERROR_NOT_SUPPORTED — "The request is not
    // supported." — which is exactly how Store certification failed. It also
    // breaks launch-on-startup (an elevated app can't be auto-started from the
    // per-user Run key) and forces a UAC prompt on every launch of what is a
    // tray app.
    //
    // Nothing here actually needs admin: the audio mute (Core Audio), camera
    // consent (HKCU), autostart (HKCU) and global shortcut are all per-user, and
    // the low-level input hooks install fine unelevated. The only thing given up
    // is suppressing input aimed at *elevated* windows during a lock.
    let win = tauri_build::WindowsAttributes::new().app_manifest(APP_MANIFEST);
    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(win))
        .expect("failed to run tauri-build");
}

// Tauri's usual manifest defaults (Common-Controls v6, supportedOS, per-monitor
// DPI, UTF-8) with requestedExecutionLevel=asInvoker.
const APP_MANIFEST: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <dependency>
    <dependentAssembly>
      <assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*" />
    </dependentAssembly>
  </dependency>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="asInvoker" uiAccess="false" />
      </requestedPrivileges>
    </security>
  </trustInfo>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}" />
      <supportedOS Id="{1f676c76-80e1-4239-95bb-83d0f6d0da78}" />
      <supportedOS Id="{4a2f28e3-53b9-4441-ba9c-d69d4a4a6e38}" />
      <supportedOS Id="{35138b9a-5d96-4fbd-8e2d-a2440225f93a}" />
    </application>
  </compatibility>
  <application xmlns="urn:schemas-microsoft-com:asm.v3">
    <windowsSettings>
      <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware>
      <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2, PerMonitor</dpiAwareness>
      <activeCodePage xmlns="http://schemas.microsoft.com/SMI/2019/WindowsSettings">UTF-8</activeCodePage>
    </windowsSettings>
  </application>
</assembly>
"#;
