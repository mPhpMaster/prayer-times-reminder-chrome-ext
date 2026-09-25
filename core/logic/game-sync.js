// game-sync.js — the app's client for the game API (server/). The API hides
// the database (Neon / Supabase / MySQL), so nothing here knows which one runs.
//
// Offline-first: progress is always saved locally first (game-state.js); sync
// sends finished items not yet acknowledged, and the server dedupes, so a
// retry after a network failure is harmless.
//
//   gameApi(baseUrl, token)            -> { register, me, updateMe, pushProgress, users, profile,
//                                           follow, unfollow, following, leaderboard }
//   pendingCompletions(state)          -> rows for POST /v1/progress
//   markSynced(state, rows)

const GAME_ACCOUNT_KEY = "gameAccount"; // { username, token }
const GAME_API_KEY = "gameApiUrl"; // override of GAME_API_DEFAULT (dev / self-hosting)
const GAME_API_DEFAULT = ""; // set when the API is deployed; empty = local-only game

class GameApiError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function gameApi(baseUrl, token) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  async function call(method, path, body) {
    if (!base) throw new GameApiError(0, "no-server");
    let res;
    try {
      res = await fetch(base + path, {
        method,
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new GameApiError(0, "offline");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new GameApiError(res.status, data.error || "http-" + res.status);
    return data;
  }
  const u = (name) => encodeURIComponent(name);
  return {
    register: (username) => call("POST", "/v1/register", { username }),
    me: () => call("GET", "/v1/me"),
    updateMe: (patch) => call("PATCH", "/v1/me", patch),
    pushProgress: (completions) => call("POST", "/v1/progress", { completions }),
    users: (q) => call("GET", `/v1/users?q=${u(q)}`),
    profile: (name, month) => call("GET", `/v1/users/${u(name)}?month=${month}`),
    follow: (name) => call("PUT", `/v1/follows/${u(name)}`),
    unfollow: (name) => call("DELETE", `/v1/follows/${u(name)}`),
    following: () => call("GET", "/v1/follows"),
    leaderboard: (month, scope) => call("GET", `/v1/leaderboard?month=${month}&scope=${scope}`),
  };
}

// Finished tasks/gifts the server hasn't acknowledged yet.
function pendingCompletions(state) {
  const rows = [];
  for (const [windowKey, w] of Object.entries(state.windows)) {
    for (const [itemId, t] of Object.entries(w.tasks || {})) {
      if (t.doneAt && !t.synced) rows.push({ windowKey, itemId, kind: "task", points: t.points, startedAt: t.startedAt, doneAt: t.doneAt });
    }
    const g = w.gift;
    if (g && g.doneAt && !g.synced) rows.push({ windowKey, itemId: g.id, kind: "gift", points: g.points, startedAt: g.startedAt, doneAt: g.doneAt });
  }
  return rows;
}

function markSynced(state, rows) {
  for (const r of rows) {
    const w = state.windows[r.windowKey];
    if (!w) continue;
    const item = r.kind === "gift" ? w.gift : w.tasks[r.itemId];
    if (item) item.synced = true;
  }
}
