# Prayer game API (Laravel)

The backend for the dhikr game (docs/GAME-DESIGN-2026-09-25.md, phases 2–3):
accounts, progress sync, follows, the leaderboard and period prizes.

**The app never talks to the database.** It calls this API at `/v1/*` with a
bearer token; only this backend holds the database credentials. The database
is chosen in `.env` and can be switched without touching the app:

| Database | `.env` |
|---|---|
| MySQL / MariaDB | `DB_CONNECTION=mysql` + `DB_HOST/DB_PORT/DB_DATABASE/DB_USERNAME/DB_PASSWORD` |
| Neon / Supabase (PostgreSQL) | `DB_CONNECTION=pgsql` + `DB_URL=postgresql://…?sslmode=require` |
| SQLite (local dev, tests) | `DB_CONNECTION=sqlite` |

Queries use only portable query-builder features (`insertOrIgnore`, `like`,
`sum`, a lowercase username column instead of collations), so the same code
runs on all of them.

```bash
composer install
cp .env.example .env && php artisan key:generate
php artisan migrate
php artisan serve --port=8787      # dev; the phone reaches it via `adb reverse tcp:8787 tcp:8787`
php artisan test                   # SQLite in memory
```

## Endpoints (`routes/api.php`)

All under `/v1`. "Auth" = `Authorization: Bearer <token>`; a token is shown
once at sign-in and only its SHA-256 is stored.

**Sign-in** (no auth; throttled 10/min unless noted)

| Method | Path | |
|---|---|---|
| GET | `/v1/auth/config` | → `{google: {clientId} \| null, apple: {servicesId, redirectUri} \| null}` — `null` = that provider is off (Apple stays `null` until `APPLE_*` is set, see `docs/APPLE-SIGNIN.md`) |
| POST | `/v1/auth/register` `{email, password, username, legacyToken?}` | → `{user, token}` |
| POST | `/v1/auth/login` `{email, password, legacyToken?}` | → `{user, token}` |
| POST | `/v1/auth/google` `{idToken, username?, legacyToken?}` | Google ID token checked against `GOOGLE_WEB_CLIENT_ID`; `422 username-required` for a new player |
| POST | `/v1/auth/apple` `{identityToken, nonce?, authorizationCode?, username?, legacyToken?}` | like `/auth/google`; RS256 token checked against Apple's JWKS, `iss`, `aud`, `exp`, nonce. `503 apple-unavailable` while Apple is off |
| POST | `/v1/auth/apple/callback` | Apple's `form_post` Return URL (30/min): 303 to the app's return address chosen by the `state` prefix from a fixed allow-list, token in the URL fragment; `400` for an unknown target |
| POST | `/v1/auth/forgot` `{email}` / `/v1/auth/reset` `{email, code, password}` | 15-minute emailed code (only its hash stored; forgot is throttled 3/10 min); reset signs out every other device |

**Account** (auth)

| Method | Path | |
|---|---|---|
| GET | `/v1/me` | own account incl. private fields: `email`, `hasPassword`, `google`, `apple` (booleans), `legacy` |
| PATCH | `/v1/me` `{displayName?, hideProgress?, settings?: {alerts?, journey?, sound?, newTab?, disputed?}}` | `settings` are the game preferences kept with the account (`disputed` = show the adhkar of disputed authenticity) |
| DELETE | `/v1/me` | deletes the account, its progress, follows and links (and revokes the kept Apple token with Apple) |
| POST | `/v1/auth/logout` | revokes this device's token only |
| POST | `/v1/auth/verify-email/send`, `/v1/auth/verify-email` `{code}` | 6-digit email confirmation code |
| POST | `/v1/me/link/google` `{idToken}` | link Google to this account; `409 account-conflict` (that Google account belongs to another player) / `409 already-linked` (this account has a different one) |
| POST | `/v1/me/link/apple` `{identityToken, nonce?, authorizationCode?}` | same, for Apple |
| DELETE | `/v1/me/link/{google\|apple}` | unlink; `409 last-method` if no other way to sign in would remain. Unlinking Apple revokes its kept token |

**Game** (auth unless noted)

| Method | Path | |
|---|---|---|
| POST | `/v1/progress` `{completions:[…]}` | idempotent, first write wins; caps: 300 per prayer window (`YYYY-MM-DD:Fajr`…`Isha`), 50 per morning / evening adhkar set (`YYYY-MM-DD:Morning` / `:Evening`, `GameRules::SIDE_POINTS`, 13 adhkar each); gift rows are dropped; no future timestamps. The optional disputed adhkar are never sent. → `{accepted, newAchievements}` (ids earned by THIS call only) |
| GET | `/v1/progress?month=YYYY-MM` | own completions |
| GET | `/v1/users?q=` | prefix search (≥ 2 chars) |
| GET | `/v1/users/{username}?month=&today=YYYY-MM-DD` | profile: `followers`, `followingCount`, `joined`, `points`, `stats`, `achievements` (`null` if the player hides progress; they still see their own), `wins` `{month, quarter, half, year, total, lastMonth}` (always public) and `playVerified` |
| PUT / DELETE | `/v1/follows/{username}` | follow / unfollow (one-way) |
| GET | `/v1/follows` | players I follow |
| GET | `/v1/leaderboard?period=all\|year\|half\|quarter\|month&today=YYYY-MM-DD&scope=all\|following` | public (a token adds `me` and `following`). Points never reset: all-time totals or the current period's (from the viewer's `today`); hidden players excluded. `winners`: the latest decided month / quarter / half / year and its winner(s) (ties all win; a hidden winner shows without points). Periods are decided lazily, 2 days after they end (`App\Support\GameWinners`). Older apps send only `month=`. Rows carry `playVerified` (the ✓ mark) |
| GET | `/v1/integrity/challenge` → `{nonce, projectNumber}`; POST `/v1/integrity` `{token}` → `{verified, detail}` | Android Google Play Integrity (10/hour): a one-use nonce, then the standard Integrity token bound to it; Google decodes it with the service account and the verdict is saved on the player (`integrity_status`, `integrity_detail`, `integrity_checked_at`). A pass in the last 30 days = `playVerified`. Nobody is blocked. `503 integrity-off` until `PLAY_INTEGRITY_CREDENTIALS` + `PLAY_INTEGRITY_PROJECT_NUMBER` are set |
| | `/v1/family…` | family: create, invite / accept, roles, parent alerts (`notify`), child status and year view (`FamilyController`) |
| | `/v1/dedications…` | the About page's names (public `GET`), and a player's own name requests |
| | `/v1/admin/…` | the in-app Admin page; `GameAdmin` checks a verified admin email on every call (users, bans, requests, dedications, log, admins; Play Integrity failures are shown per player) |

### Stats and achievements (`app/Support/GameStats.php`)

Derived only from stored completions — never from numbers the app sends.
Stats: all-time points, tasks, gifts, completed windows (all tasks of the
window stored, or its gift), full days (all five), active days, current and
best streak of consecutive active days. Dates are the window's own date, so
streaks follow the player's clock; `today` is the viewer's local date.

Achievements (`game_achievements`, primary key `user_id + achievement_id`)
are awarded with `insertOrIgnore`, and each one's `earned_at` is the finish
time of the completion that earned it. A resent sync, a repeat award or a
profile view adds nothing; an account merge rebuilds them from the merged
completions. `WINDOW_TASK_COUNT` mirrors `WINDOW_TASKS` and
`SIDE_TASK_COUNT` mirrors `SIDE_TASKS` in `core/data/game-tasks.js` (checked
by `tools/test/game.js`). Morning / evening adhkar count toward points and the
leaderboard, but not toward completed windows, full days or family alerts. Deploy needs
`php artisan migrate --force` for the new table.

Errors are `{"error": "code"}` with a matching HTTP status. The app's client
is `core/logic/game-sync.js`. Location is never sent — prayer windows are
computed on the device.

## Production (prayer-times.sarhsoft.com)

- App code: `/home/sarhsoft/laravel/prayer-times` (outside the web root, so
  `.env`, `storage/` and the SQLite file are never served).
- Web root `/home/sarhsoft/public_html/prayer-times.sarhsoft.com`: only a
  copy of `public/` whose `index.php` requires the app by absolute path, and
  `.htaccess` (cPanel `ea-php83` handler + Laravel rewrites). The vhost is set
  to PHP 8.3 (`whmapi1 php_set_vhost_versions`).
- Database: SQLite at `database/database.sqlite` for now; switch by editing
  `.env` (see the table above), then `php artisan migrate --force` and
  `php artisan config:cache`.
- Redeploy: upload the changed files (WinSCP), then as user `sarhsoft` with
  `/opt/cpanel/ea-php83/root/usr/bin/php`: `composer install --no-dev -o`,
  `artisan migrate --force`, `artisan config:cache`, `artisan route:cache`.
