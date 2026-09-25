// API tests against the in-memory store (no database needed): npm test
// The same suite runs against a real database with DB_KIND/DATABASE_URL set
// (TEST_DB=1), which is how postgres/mysql parity is checked.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApp } from "../src/app.mjs";
import { createStore } from "../src/stores/index.mjs";

let server, base, store;
let clock = Date.UTC(2026, 8, 25, 12, 0);

before(async () => {
  store = await createStore(process.env.TEST_DB === "1" ? process.env : { DB_KIND: "memory" });
  await store.migrate();
  server = http.createServer(createApp(store, { now: () => clock }));
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server.close();
  await store.close();
});

const uniq = (p) => `${p}${Math.random().toString(36).slice(2, 8)}`;
async function call(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
async function register(name) {
  const r = await call("POST", "/v1/register", { body: { username: name } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.token;
}
const done = (windowKey, itemId, points, kind = "task") => ({ windowKey, itemId, kind, points, startedAt: clock - 60000, doneAt: clock - 1000 });

test("register: valid Arabic username, duplicate (case-insensitive) rejected", async () => {
  const name = uniq("أحمد_");
  const token = await register(name);
  assert.match(token, /^[a-f0-9]{64}$/);
  const dup = await call("POST", "/v1/register", { body: { username: name.toUpperCase() } });
  assert.equal(dup.status, 409);
  assert.equal((await call("POST", "/v1/register", { body: { username: "a b" } })).status, 400);
  assert.equal((await call("POST", "/v1/register", { body: { username: "ab" } })).status, 400);
});

test("auth: missing or wrong token is 401", async () => {
  assert.equal((await call("GET", "/v1/me")).status, 401);
  assert.equal((await call("GET", "/v1/me", { token: "0".repeat(64) })).status, 401);
});

test("progress: sync is idempotent, first write wins, caps enforced", async () => {
  const token = await register(uniq("sync_"));
  const rows = [done("2026-09-25:Dhuhr", "tasbih-33", 27), done("2026-09-25:Dhuhr", "istighfar-salam", 27)];
  assert.equal((await call("POST", "/v1/progress", { token, body: { completions: rows } })).body.accepted, 2);
  assert.equal((await call("POST", "/v1/progress", { token, body: { completions: rows } })).body.accepted, 0);
  // A different points value for the same item doesn't overwrite.
  await call("POST", "/v1/progress", { token, body: { completions: [done("2026-09-25:Dhuhr", "tasbih-33", 300)] } });
  const bad = [
    done("2026-09-25:Dhuhr", "x1", 301), // above the task cap
    done("2026-09-25:Dhuhr", "g1", 101, "gift"), // above the gift cap
    { ...done("2026-09-25:Dhuhr", "x2", 5), doneAt: clock + 3600000 }, // future
    done("2026-09-25:Lunch", "x3", 5), // bad window
  ];
  assert.equal((await call("POST", "/v1/progress", { token, body: { completions: bad } })).body.accepted, 0);
  // Window total never exceeds 300 + 100 across requests.
  const flood = Array.from({ length: 20 }, (_, i) => done("2026-09-25:Asr", `t${i}`, 100));
  await call("POST", "/v1/progress", { token, body: { completions: flood.slice(0, 3) } });
  await call("POST", "/v1/progress", { token, body: { completions: flood.slice(3) } });
  const mine = await call("GET", "/v1/progress?month=2026-09", { token });
  const asr = mine.body.completions.filter((c) => c.windowKey === "2026-09-25:Asr");
  assert.equal(asr.reduce((s, c) => s + c.points, 0), 400);
  const dhuhr = mine.body.completions.find((c) => c.itemId === "tasbih-33");
  assert.equal(dhuhr.points, 27);
});

test("leaderboard: monthly, following scope, hide-progress respected", async () => {
  const a = uniq("a_"), b = uniq("b_"), c = uniq("c_");
  const ta = await register(a), tb = await register(b), tc = await register(c);
  const month = "2026-10";
  const key = "2026-10-01:Fajr";
  clock = Date.UTC(2026, 9, 1, 6, 0);
  await call("POST", "/v1/progress", { token: ta, body: { completions: [done(key, "t1", 50)] } });
  await call("POST", "/v1/progress", { token: tb, body: { completions: [done(key, "t1", 80)] } });
  await call("POST", "/v1/progress", { token: tc, body: { completions: [done(key, "t1", 99)] } });

  const all = await call("GET", `/v1/leaderboard?month=${month}`, { token: ta });
  const names = all.body.rows.map((r) => r.username);
  assert.ok(names.indexOf(c) < names.indexOf(b) && names.indexOf(b) < names.indexOf(a));
  assert.equal(all.body.me.points, 50);

  assert.equal((await call("PUT", `/v1/follows/${b}`, { token: ta })).status, 200);
  const fol = await call("GET", `/v1/leaderboard?month=${month}&scope=following`, { token: ta });
  assert.deepEqual(fol.body.rows.map((r) => r.username), [b, a]);

  // b hides progress: gone from boards, profile points hidden from others.
  await call("PATCH", "/v1/me", { token: tb, body: { hideProgress: true } });
  const after = await call("GET", `/v1/leaderboard?month=${month}&scope=following`, { token: ta });
  assert.deepEqual(after.body.rows.map((r) => r.username), [a]);
  const prof = await call("GET", `/v1/users/${b}?month=${month}`, { token: ta });
  assert.equal(prof.body.points, null);
  assert.equal(prof.body.following, true);
  const own = await call("GET", `/v1/users/${b}?month=${month}`, { token: tb });
  assert.equal(own.body.points, 80, "you still see your own points");

  assert.equal((await call("PUT", `/v1/follows/${a}`, { token: ta })).status, 400, "no self-follow");
  await call("DELETE", `/v1/follows/${b}`, { token: ta });
  assert.deepEqual((await call("GET", "/v1/follows", { token: ta })).body.users, []);
});

test("users search by prefix", async () => {
  const name = uniq("zz_");
  const token = await register(name);
  const r = await call("GET", `/v1/users?q=${encodeURIComponent(name.slice(0, 5))}`, { token });
  assert.ok(r.body.users.some((u) => u.username === name));
});
