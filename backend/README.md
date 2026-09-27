# Prayer game API (Laravel)

The backend for the dhikr game (docs/GAME-DESIGN-2026-09-25.md, phases 2–3):
accounts, progress sync, follows and the monthly leaderboard.

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

| Method | Path | |
|---|---|---|
| POST | `/v1/register` `{username}` | → `{user, token}`; token shown once, only its SHA-256 stored; throttled 10/min |
| GET / PATCH | `/v1/me` `{displayName?, hideProgress?}` | own account |
| POST | `/v1/progress` `{completions:[…]}` | idempotent, first write wins; caps: 300/task, 100/gift, 400/window; no future timestamps. → `{accepted, newAchievements}` (ids earned by THIS call only) |
| GET | `/v1/progress?month=YYYY-MM` | own completions |
| GET | `/v1/users?q=` | prefix search (≥ 2 chars) |
| GET | `/v1/users/{username}?month=&today=YYYY-MM-DD` | profile: `followers`, `followingCount`, `joined`, `points`, `stats`, `achievements`; the last three are `null` if the player hides progress (they still see their own) |

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
completions. `WINDOW_TASK_COUNT` mirrors `WINDOW_TASKS` in
`core/data/game-tasks.js` (checked by `tools/test/game.js`). Deploy needs
`php artisan migrate --force` for the new table.
| PUT / DELETE | `/v1/follows/{username}` | follow / unfollow (one-way) |
| GET | `/v1/follows` | players I follow |
| GET | `/v1/leaderboard?month=&scope=all\|following` | monthly totals; hidden players excluded |

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
