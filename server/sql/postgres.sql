-- Game schema for PostgreSQL (Neon, Supabase, or any Postgres 12+).
-- Applied by `npm run migrate` with DB_KIND=postgres. Idempotent.

CREATE TABLE IF NOT EXISTS game_users (
  id            BIGSERIAL PRIMARY KEY,
  username      VARCHAR(20) NOT NULL,
  display_name  VARCHAR(40),
  hide_progress BOOLEAN NOT NULL DEFAULT FALSE,
  token_hash    CHAR(64) NOT NULL UNIQUE,
  created_at    BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS game_users_username_lower ON game_users (lower(username));

CREATE TABLE IF NOT EXISTS game_completions (
  user_id    BIGINT NOT NULL REFERENCES game_users(id) ON DELETE CASCADE,
  window_key VARCHAR(24) NOT NULL,
  item_id    VARCHAR(64) NOT NULL,
  kind       VARCHAR(8)  NOT NULL,
  points     INTEGER     NOT NULL,
  started_at BIGINT      NOT NULL,
  done_at    BIGINT      NOT NULL,
  PRIMARY KEY (user_id, window_key, item_id)
);
CREATE INDEX IF NOT EXISTS game_completions_window ON game_completions (window_key);

CREATE TABLE IF NOT EXISTS game_follows (
  follower_id BIGINT NOT NULL REFERENCES game_users(id) ON DELETE CASCADE,
  followee_id BIGINT NOT NULL REFERENCES game_users(id) ON DELETE CASCADE,
  created_at  BIGINT NOT NULL,
  PRIMARY KEY (follower_id, followee_id)
);
