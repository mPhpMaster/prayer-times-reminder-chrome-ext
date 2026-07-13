# Security Policy

The security of this extension and its users is a top priority. This document
outlines the security model and how to report vulnerabilities.

## Supported Versions

Only the **latest version** of the extension available on the official browser
stores (e.g., Chrome Web Store) and the latest version of the desktop/mobile
apps are supported with security updates. Please ensure you are always on the
latest version.

| Version | Supported          |
|---------|--------------------|
| Latest  | :white_check_mark: |
| Older   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it privately.
**Do not open a public GitHub issue.**

Please send an email to **mphpmaster@gmail.com** with the following details:

- A clear description of the vulnerability.
- The platform(s) affected (Chrome Extension, Windows Desktop, Android).
- The version number of the application.
- Step-by-step instructions to reproduce the issue.
- Any proof-of-concept, screenshots, or screen recordings that could help
  understand the issue.

You will receive a response acknowledging the report, and we will work with you
to investigate and resolve the issue promptly.

## Security Model

The application is designed with the principle of least privilege and data
minimization in mind.

### General

- **No User Accounts:** The extension does not require user registration.
- **Local Storage:** All user settings (location, preferences) are stored
  locally on your device using the platform's secure storage mechanism. The
  developer has no access to this data.
- **No Tracking:** The extension does not use any analytics, tracking pixels,
  or fingerprinting scripts.
- **Third-Party APIs:** Network requests are made only to the public APIs
  documented in the [Privacy Policy](PRIVACY.md) to fetch prayer times and city
  data. No personal identifiers are sent with these requests.

### Browser Extension (Chrome)

- **Manifest V3:** The extension uses Manifest V3, which enforces a more secure
  extension platform, including disallowing remote code execution.
- **Optional Permissions:** Potentially sensitive permissions like `geolocation`
  and host access (`<all_urls>`) are **optional**. They are not requested at
  install time but at runtime, only when you enable a feature that requires
  them (e.g., "Use my location", "Lock tab during prayer"). You can decline
  these permissions and still use the core features of the extension.
- **Content Script Isolation:** The `scripting` permission with `<all_urls>` is
  used solely to inject the tab lock and dhikr reminder overlays. These scripts:
  - Are self-contained and do not load external resources.
  - Render their UI inside a Shadow DOM
    to avoid interfering with the host page's styles or scripts.
  - **Do not** read page content, form data, passwords, or browsing history.
  - Do not send any data from the page to any server.

### Desktop App (Windows/Tauri)

The desktop application provides a more integrated prayer lock experience.

- **System-wide Lock:** The lock feature creates full-screen, always-on-top
  windows to cover all monitors.
- **Input Blocking:** When "Allow manual unlock" is disabled, the app uses
  low-level Windows hooks to block keyboard and mouse input, preventing the
  lock from being bypassed. This is a powerful feature intended to enforce the
  prayer break. An emergency escape hatch (`Ctrl+Alt+U`) is provided.
- **Audio/Camera Control:** The app can mute system audio and temporarily
  disable camera access during the lock period. This is done through standard
  Windows APIs and is fully reversed when the lock ends or is cleared. Camera
  access is blocked by changing a user-level software setting, not by
  interacting with hardware drivers.
- **No Elevation Required:** The core features of the desktop app, including
  the strict lock, run without requiring administrator privileges.

### Mobile App (Android)

- **Native Enforcement:** The lock is implemented using a full-screen Android
  `Activity` and a foreground service to ensure it remains active. It uses
  standard, non-root mechanisms.
- **Permissions:** The app requests necessary permissions for its features, such
  as `USE_FULL_SCREEN_INTENT` for the lock, `ACCESS_NOTIFICATION_POLICY` for
  Do Not Disturb mode, and `SYSTEM_ALERT_WINDOW` for overlay reminders. Each
  permission is requested with clear context.
- **No Sensitive Data Access:** The app does not request permissions to access
  contacts, SMS, call logs, or other sensitive personal data.