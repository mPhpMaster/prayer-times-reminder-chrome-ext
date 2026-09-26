// game-sync.js — the app's client for the game API (server/). The API hides
// the database (Neon / Supabase / MySQL), so nothing here knows which one runs.
//
// Offline-first: progress is always saved locally first (game-state.js); sync
// sends finished items not yet acknowledged, and the server dedupes, so a
// retry after a network failure is harmless.
//
//   gameApi(baseUrl, token)            -> { authConfig, signUp, signIn, google, forgot, reset, logout,
//                                           me, updateMe, deleteMe, pushProgress, users, profile,
//                                           follow, unfollow, following, leaderboard }
//   pendingCompletions(state)          -> rows for POST /v1/progress
//   markSynced(state, rows)
//   syncBatches(rows)                  -> rows in POST-sized batches
//   adoptSyncAccount(state, username)  -> true when local progress must be re-sent

const GAME_ACCOUNT_KEY = "gameAccount"; // { username, token, email, legacy }
const GAME_API_KEY = "gameApiUrl"; // override of GAME_API_DEFAULT (dev / self-hosting)
const GAME_API_DEFAULT = "https://prayer-times.sarhsoft.com"; // Laravel backend (backend/); override with gameApiUrl

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
    authConfig: () => call("GET", "/v1/auth/config"),
    signUp: (email, password, username, legacyToken) => call("POST", "/v1/auth/register", { email, password, username, legacyToken }),
    signIn: (email, password, legacyToken) => call("POST", "/v1/auth/login", { email, password, legacyToken }),
    google: (idToken, username, legacyToken) => call("POST", "/v1/auth/google", { idToken, username, legacyToken }),
    forgot: (email) => call("POST", "/v1/auth/forgot", { email }),
    reset: (email, code, password) => call("POST", "/v1/auth/reset", { email, code, password }),
    logout: () => call("POST", "/v1/auth/logout"),
    me: () => call("GET", "/v1/me"),
    updateMe: (patch) => call("PATCH", "/v1/me", patch),
    deleteMe: () => call("DELETE", "/v1/me"),
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

// The server reads at most 500 rows per request; stay well under it so a
// long offline queue (or a full re-send after signing in) is never cut short
// and then wrongly marked as synced.
const SYNC_BATCH = 200;
function syncBatches(rows) {
  const out = [];
  for (let i = 0; i < rows.length; i += SYNC_BATCH) out.push(rows.slice(i, i + SYNC_BATCH));
  return out;
}

// Signing in to a different account than the one this device last synced to:
// clear every `synced` flag so the whole local history is sent to the new
// account. The server keeps one row per (window, item), so anything it
// already has is ignored — progress moves over without being counted twice.
function adoptSyncAccount(state, username) {
  if (state.syncAccount === username) return false;
  for (const w of Object.values(state.windows)) {
    for (const t of Object.values(w.tasks || {})) delete t.synced;
    if (w.gift) delete w.gift.synced;
  }
  state.syncAccount = username;
  return true;
}
