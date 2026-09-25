// memory.mjs — in-process store for tests and local development. Same
// contract as postgres.mjs / mysql.mjs (see README "Store contract").

export function createMemoryStore() {
  const users = []; // { id, username, displayName, hideProgress, tokenHash, createdAt }
  const completions = []; // { userId, windowKey, itemId, kind, points, startedAt, doneAt }
  const follows = new Set(); // "a>b"
  let nextId = 1;
  const lower = (s) => s.toLocaleLowerCase();

  return {
    kind: "memory",
    async close() {},
    async migrate() {},

    async createUser({ username, tokenHash, now }) {
      if (users.some((u) => lower(u.username) === lower(username))) return null;
      const u = { id: nextId++, username, displayName: null, hideProgress: false, tokenHash, createdAt: now };
      users.push(u);
      return { ...u };
    },
    async userByTokenHash(h) {
      const u = users.find((x) => x.tokenHash === h);
      return u ? { ...u } : null;
    },
    async userByUsername(name) {
      const u = users.find((x) => lower(x.username) === lower(name));
      return u ? { ...u } : null;
    },
    async updateUser(id, patch) {
      const u = users.find((x) => x.id === id);
      Object.assign(u, patch);
      return { ...u };
    },
    async searchUsers(q, limit) {
      return users.filter((u) => lower(u.username).startsWith(lower(q))).slice(0, limit).map((u) => ({ ...u }));
    },

    async completionsForWindows(userId, keys) {
      const set = new Set(keys);
      return completions.filter((c) => c.userId === userId && set.has(c.windowKey)).map((c) => ({ ...c }));
    },
    async insertCompletions(userId, rows) {
      for (const r of rows) {
        if (!completions.some((c) => c.userId === userId && c.windowKey === r.windowKey && c.itemId === r.itemId)) {
          completions.push({ userId, ...r });
        }
      }
    },
    async completionsForMonth(userId, month) {
      return completions.filter((c) => c.userId === userId && c.windowKey.startsWith(month)).map(({ userId: _, ...c }) => c);
    },
    async monthPoints(userId, month) {
      return completions.filter((c) => c.userId === userId && c.windowKey.startsWith(month)).reduce((s, c) => s + c.points, 0);
    },

    async follow(a, b) {
      follows.add(`${a}>${b}`);
    },
    async unfollow(a, b) {
      follows.delete(`${a}>${b}`);
    },
    async isFollowing(a, b) {
      return follows.has(`${a}>${b}`);
    },
    async following(a) {
      return users.filter((u) => follows.has(`${a}>${u.id}`)).map((u) => ({ ...u }));
    },

    // Monthly totals, hidden players excluded; userIds limits to a set (following).
    async leaderboard(month, userIds, limit) {
      const allow = userIds && new Set(userIds);
      const sums = new Map();
      for (const c of completions) {
        if (!c.windowKey.startsWith(month) || (allow && !allow.has(c.userId))) continue;
        sums.set(c.userId, (sums.get(c.userId) || 0) + c.points);
      }
      return [...sums]
        .map(([id, points]) => ({ ...users.find((u) => u.id === id), points }))
        .filter((u) => !u.hideProgress)
        .sort((a, b) => b.points - a.points || a.username.localeCompare(b.username))
        .slice(0, limit);
    },
  };
}
