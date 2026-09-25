// sql.mjs — the store contract on top of a tiny SQL dialect, shared by the
// postgres (Neon / Supabase) and mysql stores. A dialect supplies:
//   q(sql, params) -> rows      "?" placeholders (postgres rewrites to $n)
//   insertIgnore(body, keys)    "insert unless the key already exists"
//   likePrefix(col)             "col starts with ?"
//   bool(v)                     SQL literal for a boolean
//   isUniqueViolation(err)
// Queries stay within the portable subset of both dialects.

const USER_COLS = ["id", "username", "display_name", "hide_progress", "token_hash", "created_at"];

function toUser(r) {
  return (
    r && {
      id: Number(r.id),
      username: r.username,
      displayName: r.display_name,
      hideProgress: !!r.hide_progress,
      tokenHash: r.token_hash,
      createdAt: Number(r.created_at),
    }
  );
}

const toCompletion = (r) => ({
  windowKey: r.window_key,
  itemId: r.item_id,
  kind: r.kind,
  points: Number(r.points),
  startedAt: Number(r.started_at),
  doneAt: Number(r.done_at),
});

export function sqlStore(d) {
  const { q } = d;
  const one = async (sql, p) => (await q(sql, p))[0] || null;
  const marks = (n) => Array.from({ length: n }, () => "?").join(", ");
  const cols = USER_COLS.join(", ");
  const uCols = USER_COLS.map((c) => "u." + c).join(", ");

  return {
    kind: d.kind,
    close: d.close,
    migrate: d.migrate,

    async createUser({ username, tokenHash, now }) {
      try {
        await q("INSERT INTO game_users (username, token_hash, created_at) VALUES (?, ?, ?)", [username, tokenHash, now]);
      } catch (e) {
        if (d.isUniqueViolation(e)) return null;
        throw e;
      }
      return toUser(await one(`SELECT ${cols} FROM game_users WHERE token_hash = ?`, [tokenHash]));
    },
    async userByTokenHash(h) {
      return toUser(await one(`SELECT ${cols} FROM game_users WHERE token_hash = ?`, [h]));
    },
    async userByUsername(name) {
      return toUser(await one(`SELECT ${cols} FROM game_users WHERE lower(username) = lower(?)`, [name]));
    },
    async updateUser(id, patch) {
      if ("displayName" in patch) await q("UPDATE game_users SET display_name = ? WHERE id = ?", [patch.displayName, id]);
      if ("hideProgress" in patch) await q(`UPDATE game_users SET hide_progress = ${d.bool(patch.hideProgress)} WHERE id = ?`, [id]);
      return toUser(await one(`SELECT ${cols} FROM game_users WHERE id = ?`, [id]));
    },
    async searchUsers(prefix, limit) {
      const rows = await q(
        `SELECT ${cols} FROM game_users WHERE ${d.likePrefix("lower(username)")} ORDER BY username LIMIT ${Number(limit)}`,
        [prefix.toLocaleLowerCase()]
      );
      return rows.map(toUser);
    },

    async completionsForWindows(userId, keys) {
      if (!keys.length) return [];
      const rows = await q(`SELECT * FROM game_completions WHERE user_id = ? AND window_key IN (${marks(keys.length)})`, [
        userId,
        ...keys,
      ]);
      return rows.map(toCompletion);
    },
    async insertCompletions(userId, rows) {
      const sql = d.insertIgnore(
        "game_completions (user_id, window_key, item_id, kind, points, started_at, done_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        "user_id, window_key, item_id"
      );
      for (const r of rows) await q(sql, [userId, r.windowKey, r.itemId, r.kind, r.points, r.startedAt, r.doneAt]);
    },
    async completionsForMonth(userId, month) {
      const rows = await q(
        `SELECT * FROM game_completions WHERE user_id = ? AND ${d.likePrefix("window_key")} ORDER BY window_key`,
        [userId, month]
      );
      return rows.map(toCompletion);
    },
    async monthPoints(userId, month) {
      const r = await one(
        `SELECT COALESCE(SUM(points), 0) AS points FROM game_completions WHERE user_id = ? AND ${d.likePrefix("window_key")}`,
        [userId, month]
      );
      return Number(r.points);
    },

    async follow(a, b, now) {
      await q(d.insertIgnore("game_follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)", "follower_id, followee_id"), [
        a,
        b,
        now,
      ]);
    },
    async unfollow(a, b) {
      await q("DELETE FROM game_follows WHERE follower_id = ? AND followee_id = ?", [a, b]);
    },
    async isFollowing(a, b) {
      return !!(await one("SELECT 1 AS x FROM game_follows WHERE follower_id = ? AND followee_id = ?", [a, b]));
    },
    async following(a) {
      const rows = await q(
        `SELECT ${uCols} FROM game_follows f JOIN game_users u ON u.id = f.followee_id WHERE f.follower_id = ? ORDER BY u.username`,
        [a]
      );
      return rows.map(toUser);
    },

    // Monthly totals; hidden players excluded; userIds limits to a set (following).
    async leaderboard(month, userIds, limit) {
      if (userIds && !userIds.length) return [];
      const params = [month];
      let only = "";
      if (userIds) {
        only = ` AND c.user_id IN (${marks(userIds.length)})`;
        params.push(...userIds);
      }
      const rows = await q(
        `SELECT u.id, u.username, u.display_name, u.hide_progress, SUM(c.points) AS points
         FROM game_completions c JOIN game_users u ON u.id = c.user_id
         WHERE ${d.likePrefix("c.window_key")} AND u.hide_progress = ${d.bool(false)}${only}
         GROUP BY u.id, u.username, u.display_name, u.hide_progress
         ORDER BY points DESC, u.username LIMIT ${Number(limit)}`,
        params
      );
      return rows.map((r) => ({ ...toUser(r), points: Number(r.points) }));
    },
  };
}
