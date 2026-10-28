# scripts/ — store & app asset generators

Python generators (Pillow) that produce the store listing assets and the
Android launcher icons. Run from the repo root; paths resolve off the repo,
not the current directory.

| Script                     | Produces                                              | Output                              |
| -------------------------- | ----------------------------------------------------- | ----------------------------------- |
| `make_icons.py`            | The app icon (crescent + star on a teal tile), 4 sizes | `core/assets/icons/icon{16,32,48,128}.png` |
| `make_android_icons.py`    | Android launcher icons (all densities + adaptive layers) | `targets/mobile/android/.../res/mipmap-*/ic_launcher*.png` |
| `make_store_screenshots.py`| 1280×800 store screenshots of the live UI, 8 languages; the game's tasks view (Asr tasks + morning adhkar) for en/ar | `screenshots/<lang>.png` + `welcome-<lang>.png` + `game-{en,ar}.png`; Chrome Web Store set in `store-release/assets/chrome/screenshots/` |
| `make_ios_icons.py`        | iOS app icons (every size + the 1024 App Store icon, no alpha) and splash | `targets/mobile/ios/App/App/Assets.xcassets/` |
| `make_promo.py`            | Promo tiles (small + marquee)                          | `screenshots/promo-{small-440x280,marquee-1400x560}.{png,jpg}` |

```
pip install pillow
python scripts/make_icons.py           # icon is the shared source; re-sync targets after
python scripts/make_android_icons.py   # reuses make_icons art; rebuild the APK after
python scripts/make_ios_icons.py       # reuses make_icons art; writes the iOS Assets.xcassets
python scripts/make_store_screenshots.py   # auto-runs sync-core; needs Chrome installed
python scripts/make_promo.py           # reuses make_icons art so promo & icon never drift
```

Notes:
- `make_icons.py` writes the **shared** icon under `core/assets/`; run
  `npm run sync:all` afterwards to copy it into each target's build.
- `make_store_screenshots.py` renders the real `popup.html`/`welcome.html` from
  the assembled `targets/extension/build/` via headless Chrome (mocked clock +
  prayer data), so screenshots always reflect the current UI.
- `make_promo.py` imports `make_icons.make()` for the tile art — edit the icon
  once and both the icon and the promo update together.
