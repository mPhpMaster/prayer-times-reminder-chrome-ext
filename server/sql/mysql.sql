-- Game schema for MySQL 8+ / MariaDB 10.5+. Applied by `npm run migrate`
-- with DB_KIND=mysql. Idempotent. utf8mb4 for Arabic usernames; the _ci
-- collation makes the username key case-insensitive.

CREATE TABLE IF NOT EXISTS game_users (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(20) NOT NULL,
  display_name  VARCHAR(40),
  hide_progress TINYINT(1) NOT NULL DEFAULT 0,
  token_hash    CHAR(64) NOT NULL UNIQUE,
  created_at    BIGINT NOT NULL,
  UNIQUE KEY game_users_username (username)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_completions (
  user_id    BIGINT NOT NULL,
  window_key VARCHAR(24) NOT NULL,
  item_id    VARCHAR(64) NOT NULL,
  kind       VARCHAR(8)  NOT NULL,
  points     INT         NOT NULL,
  started_at BIGINT      NOT NULL,
  done_at    BIGINT      NOT NULL,
  PRIMARY KEY (user_id, window_key, item_id),
  KEY game_completions_window (window_key),
  FOREIGN KEY (user_id) REFERENCES game_users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_follows (
  follower_id BIGINT NOT NULL,
  followee_id BIGINT NOT NULL,
  created_at  BIGINT NOT NULL,
  PRIMARY KEY (follower_id, followee_id),
  FOREIGN KEY (follower_id) REFERENCES game_users(id) ON DELETE CASCADE,
  FOREIGN KEY (followee_id) REFERENCES game_users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
