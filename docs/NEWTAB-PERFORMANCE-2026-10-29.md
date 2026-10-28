# Chrome new-tab startup performance

The new tab used to stay hidden while it read game history, calculated prayer
times repeatedly, formatted those instants as text, and parsed the text back
into instants. Every open tab also kept its countdown timer and storage
listener active in the background.

## Changes

- Paint the clock, search and dhikr before reading game history or calculating
  prayer details. Prayer and task cards fill in afterward.
- Expose numeric instants from the same adhan calculation used by the existing
  prayer engine. Existing formatted callers retain their original API.
- Reuse today's numeric schedule across tabs with `chrome.storage.session`.
  Changing the city, calculation method, local date or UTC offset invalidates it.
  Missing or unavailable session storage falls back to local calculation.
- Load the prayer library only on a schedule-cache miss. The new tab no longer
  loads the timezone database, speech matcher, scoring rules or window engine.
- Read task IDs from the shared catalog without tokenizing Quran/adhkar text.
  Retain only the current window's completed IDs, not the player's full history.
- Reuse the clock formatter, update unchanged labels less often, and stop
  timers, animations and storage observation while the tab is hidden. Refresh
  settings/progress when it returns, including a restored back/forward page.
- Bound optional weather/account requests to five seconds. Keep the layout,
  backgrounds, localization, search and prayer calculation method intact.

## Measurement

An isolated Chromium extension profile, 1440 x 1000 viewport, CPU throttled 4x,
Arabic interface and a synthetic 2,000-window game-history fixture. Two warm-up
navigations followed by ten measured reloads, using the same browser executable
and extension build directory. These are synthetic startup measurements, not a
claim about the exact delay on the user's installed Chrome profile.

| Metric | Before | After |
| --- | ---: | ---: |
| Median time until the page is revealed | 600.8 ms | 167.8 ms |
| Longest observed main-thread task | 610 ms | 54 ms |
| JavaScript `Intl.DateTimeFormat` constructions per measured navigation | 86 | 1 |

The first visible page appears approximately 72% sooner. Task-history loading
remains asynchronous after that first paint; the task card is not represented
as already complete by the first-paint metric. Raw timing captures and the
browser harness remain in `output/playwright/newtab-performance/` locally.

## Verification

- The existing JavaScript suite plus 114 new new-tab regression checks pass.
- Numeric timestamps match all six existing formatted prayer timestamps in
  96 location/date/device-timezone cases, including DST transitions.
- Task-window keys agree with the shared game window at each prayer boundary
  and before Fajr. Cache invalidation and unavailable session storage are tested.
- Chromium rendered the six prayer rows, live 3-of-9 task progress, English/
  Arabic labels and selectable backgrounds. A screenshot was inspected.
- A simulated visibility event stopped countdown mutations and refreshed the
  language on return. Native tab visibility could not be asserted through this
  Playwright session because its focus emulation kept documents visible.
- The installed store copy found locally is version 2.3.8. The 2.3.9 package
  needs to be distributed/installed for that copy to receive this fix.
