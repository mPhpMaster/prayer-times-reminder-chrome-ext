# Chrome extension performance audit - 2026-10-29

Release: **2.3.10**. Reviewed the extension shell and shared runtime paths:
service worker, navigation enforcement, notification planners, new tab, popup,
settings, game/task history, voice reader, accounts, family alerts, admin pages,
lock/dhikr overlays, and offscreen audio. This is a code and controlled-browser
performance review, not a guarantee about every website or the installed store copy.

## Changes

- Popup countdown: cache prayer instants for the current date/timezone; change
  labels/styles only when their value changes; pause the clock in Settings,
  hidden tabs and during navigation. Resume on visibility and back/forward restore.
- Game: cache daily/monthly totals until state is saved; reuse its clock formatter;
  avoid re-matching saved recitation text every second; update only the active
  route. Hidden pages stop the clock, except a live microphone's deadline check.
- Prayer, game and family notification planners use the engine's numeric instants
  instead of formatting times and parsing them back. Legacy engines retain their
  fallback. Reuse a bounded cache of 24 prayer/date formatters.
- Lock overlays stop their per-second countdown when hidden. A separate absolute
  expiry timeout and a visibility check release the lock. Cancel expiry/hint
  timers and visibility listeners during cleanup. Hidden dhikr cards skip the
  invisible fade-out timer when removed.
- Both lock injection and unlock fan-out use a concurrency limit of eight.
  Navigation waits for lock-state hydration on a cold service-worker start, then
  returns without per-navigation storage reads when no lock is active.
- Animate countdown text instead of a whole blurred card in the popup/new tab.
  Pause page animations while hidden; preserve layout, themes and localized text.
- Bound game API requests to 15 seconds and family-alert requests to 10 seconds
  where native AbortSignal.timeout is available. Other legacy geocoding/country
  requests are not represented as bounded by this change.
- Split the popup, game and enforcement modules in their existing script order.
  Every added/modified JS, HTML and CSS source is below 500 lines. Version module
  script URLs so a website cache cannot mix the old entry file with new modules.

The 2.3.9 new-tab startup improvements remain included; see
[the startup measurements](NEWTAB-PERFORMANCE-2026-10-29.md).

## Runtime characteristics checked

- No always-on content_scripts entry or all-page MutationObserver. Ordinary
  websites receive overlay code only when the configured lock/dhikr feature runs.
- No permanent interval in the service worker. Chrome alarms drive scheduling;
  discarded tabs are skipped. Event callbacks can still wake the worker.
- Sound plays once in a shared offscreen document, with end/stop cleanup; it is
  not duplicated in every overlay. Speech and identity modules load on demand.
- City lists are fetched/built in Settings on demand. Account/admin/family views
  are action-driven, not periodic polling loops. Pending asynchronous network
  requests do not themselves occupy the main thread continuously.

## Controlled Chromium verification

An isolated temporary extension profile, Playwright Chromium build 1243, 4x CPU throttling for
page samples, English interface and synthetic history of 61 days x five prayer
windows x nine task records. Each sample lasts 4.2 seconds. API calls were
intercepted; no real user account or Chrome profile was changed.

Tabs were placed in the same native window. Actual document.hidden was asserted;
these results are not based only on a simulated visibility event. Test-only tabs
and loopback permissions/public key were added to the isolated fixture, not the
release manifest. Screenshots of the popup and tasks were inspected separately.

| Surface | Before JS time | After JS time | DOM mutations before / after |
| --- | ---: | ---: | ---: |
| Prayer times, visible | 88.8 ms | 4.7 ms | 28 / 4 |
| Prayer times, hidden | 76.4 ms | 0.0 ms | 28 / 0 |
| Tasks, visible | 9.3 ms | 5.3 ms | 102 / 0 |
| Tasks, hidden | 17.8 ms | 0.0 ms | 68 / 0 |
| Leaderboard, visible | 19.6 ms | 3.8 ms | 136 / 0 |

These short samples establish the specific work removed, not a browser-wide
speedup percentage. Visible task cost also depends on whether a minute/window
boundary falls inside the sample. The final new-tab hidden sample likewise had
**0 ms measured JavaScript and 0 DOM mutations**; its visible sample remained live.

Across 12 ordinary localhost tabs, hidden lock countdown callbacks fell from
**22 to 0** during the sampling period. All lock intervals/roots and dhikr roots
were released after expiry. Final checks were made 5.8 seconds after the five-
second test lock and 2.6 seconds after the two-second test dhikr. Background timer
throttling can delay hidden timeouts; returning to a locked tab checks its actual
expiry immediately. No page errors were captured in the final run.

Raw captures/harness/screenshots remain locally in
`output/playwright/extension-performance-audit/` and are not shipped.

## Validation and delivery

- npm test: **1,075 assertions/checks passed**, plus four clean boot-smoke realms.
  Includes 30 lifecycle/cache/planner regressions and existing name/admin checks.
- Targeted source ESLint: zero errors; classic cross-file globals and existing
  style rules produce warnings. No automatic lint refactor was applied.
- Build and package verification passed: 174 files, manifest 2.3.10, 84 referenced
  files present; release permissions unchanged. Generated targets are refreshed
  from core sources rather than edited independently.
- WinSCP read-only hosting recheck: all 60 backend runtime/config/migration files
  match local bytes; all 12 migrations are applied. This release changes no PHP.
- Existing repository/worktree copies are retained. Their branches and generated
  assets are synchronized after the release commit; original backup refs/stashes
  from the earlier reconciliation remain preserved.
- The installed Web Store copy previously inspected was 2.3.8. Store publishing
  and testing this release in that real profile are not completed by these
  isolated tests. The unpacked checkout needs Reload; the store copy needs the
  new release distributed before it receives these fixes.
