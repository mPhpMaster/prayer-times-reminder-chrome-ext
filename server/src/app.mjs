// app.mjs — the game API as a plain Node request handler, independent of the
// database: every read/write goes through a `store` (src/stores/*), so the
// same API runs on Neon or Supabase (postgres) or MySQL by configuration only.
//
// Auth is our own, not the database provider's: registering a username returns
// a random bearer token; only its SHA-256 is stored. (Google sign-in can later
// attach to the same user row.)
//
//   POST /v1/register        { username }                 -> { user, token }
//   GET  /v1/me                                           -> { user }
//   PATCH /v1/me             { displayName?, hideProgress? } -> { user }
//   POST /v1/progress        { completions: [...] }        -> { accepted }
//   GET  /v1/progress?month=YYYY-MM                        -> { completions }
//   GET  /v1/users?q=                                      -> { users }
//   GET  /v1/users/:username?month=                        -> { user, points, following }
//   PUT  /v1/follows/:username  /  DELETE                   -> { ok }
//   GET  /v1/follows                                       -> { users }
//   GET  /v1/leaderboard?month=&scope=all|following        -> { rows, me }

import crypto from "node:crypto";
import { normalizeUsername, isMonth, cleanCompletions, MAX_WINDOW_TOTAL } from "./rules.mjs";

const json = (res, status, body) => {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  });
  res.end(body === undefined ? "" : JSON.stringify(body));
};

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const currentMonth = (now) => new Date(now).toISOString().slice(0, 7);

// What other players may see about a user.
function publicUser(u) {
  return { username: u.username, displayName: u.displayName || u.username, hideProgress: !!u.hideProgress };
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 256 * 1024) throw new HttpError(413, "body-too-large");
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "bad-json");
  }
}

export function createApp(store, { now = () => Date.now() } = {}) {
  async function auth(req) {
    const m = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || "");
    const user = m && (await store.userByTokenHash(sha256(m[1])));
    if (!user) throw new HttpError(401, "unauthorized");
    return user;
  }

  async function target(username) {
    const u = await store.userByUsername(String(username));
    if (!u) throw new HttpError(404, "no-such-user");
    return u;
  }

  const routes = [
    ["POST", /^\/v1\/register$/, async (req) => {
      const { username } = await readBody(req);
      const name = normalizeUsername(username);
      if (!name) throw new HttpError(400, "bad-username");
      const token = crypto.randomBytes(32).toString("hex");
      const user = await store.createUser({ username: name, tokenHash: sha256(token), now: now() });
      if (!user) throw new HttpError(409, "username-taken");
      return [201, { user: publicUser(user), token }];
    }],

    ["GET", /^\/v1\/me$/, async (req) => [200, { user: publicUser(await auth(req)) }]],

    ["PATCH", /^\/v1\/me$/, async (req) => {
      const me = await auth(req);
      const body = await readBody(req);
      const patch = {};
      if (typeof body.displayName === "string") patch.displayName = body.displayName.trim().slice(0, 40) || null;
      if (typeof body.hideProgress === "boolean") patch.hideProgress = body.hideProgress;
      return [200, { user: publicUser(await store.updateUser(me.id, patch)) }];
    }],

    ["POST", /^\/v1\/progress$/, async (req) => {
      const me = await auth(req);
      const rows = cleanCompletions((await readBody(req)).completions, now());
      // Cap each window across requests too, counting what is already stored.
      const keys = [...new Set(rows.map((r) => r.windowKey))];
      const stored = await store.completionsForWindows(me.id, keys);
      const have = new Set(stored.map((r) => `${r.windowKey}|${r.itemId}`));
      const totals = new Map();
      for (const r of stored) totals.set(r.windowKey, (totals.get(r.windowKey) || 0) + r.points);
      const fresh = [];
      for (const r of rows) {
        if (have.has(`${r.windowKey}|${r.itemId}`)) continue; // first write wins
        const t = (totals.get(r.windowKey) || 0) + r.points;
        if (t > MAX_WINDOW_TOTAL) continue;
        totals.set(r.windowKey, t);
        fresh.push(r);
      }
      if (fresh.length) await store.insertCompletions(me.id, fresh);
      return [200, { accepted: fresh.length }];
    }],

    ["GET", /^\/v1\/progress$/, async (req, url) => {
      const me = await auth(req);
      const month = url.searchParams.get("month") || currentMonth(now());
      if (!isMonth(month)) throw new HttpError(400, "bad-month");
      return [200, { completions: await store.completionsForMonth(me.id, month) }];
    }],

    ["GET", /^\/v1\/users$/, async (req, url) => {
      await auth(req);
      const q = String(url.searchParams.get("q") || "").trim().slice(0, 20);
      if (q.length < 2) return [200, { users: [] }];
      return [200, { users: (await store.searchUsers(q, 20)).map(publicUser) }];
    }],

    ["GET", /^\/v1\/users\/([^/]+)$/, async (req, url, m) => {
      const me = await auth(req);
      const u = await target(decodeURIComponent(m[1]));
      const month = url.searchParams.get("month") || currentMonth(now());
      if (!isMonth(month)) throw new HttpError(400, "bad-month");
      const self = u.id === me.id;
      // "Hide my progress": nobody else sees the points, followers included.
      const points = self || !u.hideProgress ? await store.monthPoints(u.id, month) : null;
      return [200, { user: publicUser(u), points, following: self ? false : await store.isFollowing(me.id, u.id) }];
    }],

    ["PUT", /^\/v1\/follows\/([^/]+)$/, async (req, _url, m) => {
      const me = await auth(req);
      const u = await target(decodeURIComponent(m[1]));
      if (u.id === me.id) throw new HttpError(400, "cannot-follow-self");
      await store.follow(me.id, u.id, now());
      return [200, { ok: true }];
    }],

    ["DELETE", /^\/v1\/follows\/([^/]+)$/, async (req, _url, m) => {
      const me = await auth(req);
      const u = await target(decodeURIComponent(m[1]));
      await store.unfollow(me.id, u.id);
      return [200, { ok: true }];
    }],

    ["GET", /^\/v1\/follows$/, async (req) => {
      const me = await auth(req);
      return [200, { users: (await store.following(me.id)).map(publicUser) }];
    }],

    ["GET", /^\/v1\/leaderboard$/, async (req, url) => {
      const me = await auth(req);
      const month = url.searchParams.get("month") || currentMonth(now());
      if (!isMonth(month)) throw new HttpError(400, "bad-month");
      const scope = url.searchParams.get("scope") === "following" ? "following" : "all";
      let userIds = null;
      if (scope === "following") userIds = [me.id, ...(await store.following(me.id)).map((u) => u.id)];
      const rows = await store.leaderboard(month, userIds, 100);
      return [200, {
        month,
        scope,
        rows: rows.map((r, i) => ({ rank: i + 1, ...publicUser(r), points: r.points })),
        me: { ...publicUser(me), points: await store.monthPoints(me.id, month) },
      }];
    }],
  ];

  return async function handler(req, res) {
    if (req.method === "OPTIONS") return json(res, 204);
    const url = new URL(req.url, "http://x");
    try {
      for (const [method, re, fn] of routes) {
        const m = re.exec(url.pathname);
        if (m && req.method === method) {
          const [status, body] = await fn(req, url, m);
          return json(res, status, body);
        }
      }
      throw new HttpError(404, "not-found");
    } catch (e) {
      if (e instanceof HttpError) return json(res, e.status, { error: e.code });
      console.error(e);
      return json(res, 500, { error: "server-error" });
    }
  };
}
