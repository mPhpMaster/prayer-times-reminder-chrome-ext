# Game API server

Accounts, progress sync, follows and the monthly leaderboard for the dhikr
game (docs/GAME-DESIGN-2026-09-25.md, phases 2–3). The app talks only to
this API, never to a database directly, so **the database can be swapped
by configuration**:

| `DB_KIND` | `DATABASE_URL` | Driver (optional dep) |
|---|---|---|
| `memory` (default) | — | none; data is lost on restart |
| `postgres` (aliases `neon`, `supabase`) | `postgres://…` pooled connection string | `pg` |
| `mysql` (alias `mariadb`) | `mysql://user:pass@host:3306/db` | `mysql2` |

```bash
npm install            # pulls pg + mysql2 (optional deps)
DB_KIND=postgres DATABASE_URL=postgres://... npm run migrate
DB_KIND=postgres DATABASE_URL=postgres://... PORT=8787 npm start
npm test               # memory store; TEST_DB=1 + DB_KIND/DATABASE_URL runs it on a real DB
```

Schemas: `sql/postgres.sql`, `sql/mysql.sql` (idempotent; `npm run migrate`).

## Auth

Our own, not the database provider's: `POST /v1/register {username}` returns a
random 256-bit bearer token; only its SHA-256 is stored. Losing the token (app
data wiped) loses the account — Google sign-in can later attach to the same
user row for recovery.

## Endpoints

See the header of `src/app.mjs`. Progress sync is idempotent and first-write-
wins per `(window, item)`; points are capped per task (300), per gift (100)
and per window (400), timestamps may not be in the future. Location is never
sent: the client computes prayer windows locally.

## Store contract

`src/stores/memory.mjs` is the reference; `sql.mjs` implements the same
methods for both SQL dialects:
`createUser, userByTokenHash, userByUsername, updateUser, searchUsers,
completionsForWindows, insertCompletions, completionsForMonth, monthPoints,
follow, unfollow, isFollowing, following, leaderboard, migrate, close`.
