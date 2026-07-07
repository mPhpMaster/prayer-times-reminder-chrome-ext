fn main() {
    // Windows: ship the RELEASE build elevated (requireAdministrator) so the
    // low-level input hook is reliable against other windows and any future
    // admin-only enforcement works. Keep DEBUG as-invoker so `tauri dev` /
    // `cargo run` don't trigger a UAC prompt on every launch (the camera consent
    // toggle is per-user HKCU and already needs no admin).
    let mut win = tauri_build::WindowsAttributes::new();
    if std::env::var("PROFILE").as_deref() == Ok("release") {
        win = win.app_manifest(ADMIN_MANIFEST);
    }
    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(win))
        .expect("failed to run tauri-build");
}

// Tauri's usual manifest defaults (Common-Controls v6, supportedOS, per-monitor
// DPI, UTF-8) PLUS requestedExecutionLevel=requireAdministrator.
const ADMIN_MANIFEST: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <dependency>
    <dependentAssembly>
      <assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*" />
    </dependentAssembly>
  </dependency>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="requireAdministrator" uiAccess="false" />
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
