// rules.mjs — validation shared by every store. Point caps mirror the client's
// core/logic/game-score.js (WINDOW_POINTS, GIFT_POINTS); keep them in step.

export const WINDOW_POINTS = 300;
export const GIFT_POINTS = 100;
export const MAX_WINDOW_TOTAL = WINDOW_POINTS + GIFT_POINTS;

// Letters in any script (Arabic or Latin), digits and underscore.
const USERNAME = /^[\p{L}\p{N}_]{3,20}$/u;
const WINDOW_KEY = /^\d{4}-\d{2}-\d{2}:(Fajr|Dhuhr|Asr|Maghrib|Isha)$/;
const ITEM_ID = /^[a-z0-9-]{1,64}$/;
const MONTH = /^\d{4}-\d{2}$/;

export function normalizeUsername(raw) {
  const u = String(raw ?? "").trim().normalize("NFC");
  return USERNAME.test(u) ? u : null;
}

export function isMonth(m) {
  return MONTH.test(String(m));
}

// Completed items as sent by the client: { windowKey, itemId, kind, points,
// startedAt, doneAt }. Invalid rows are dropped, not fatal — the client keeps
// its local copy either way. A window's rows are capped at MAX_WINDOW_TOTAL.
export function cleanCompletions(rows, now) {
  const out = [];
  const perWindow = new Map();
  const future = now + 5 * 60 * 1000; // small clock skew allowance
  for (const r of Array.isArray(rows) ? rows.slice(0, 500) : []) {
    if (!r || !WINDOW_KEY.test(r.windowKey) || !ITEM_ID.test(r.itemId)) continue;
    const kind = r.kind === "gift" ? "gift" : "task";
    const cap = kind === "gift" ? GIFT_POINTS : WINDOW_POINTS;
    const points = Math.round(Number(r.points));
    const doneAt = Number(r.doneAt);
    const startedAt = Number(r.startedAt) || doneAt;
    if (!Number.isFinite(points) || points < 0 || points > cap) continue;
    if (!Number.isFinite(doneAt) || doneAt > future || startedAt > doneAt) continue;
    const sum = (perWindow.get(r.windowKey) || 0) + points;
    if (sum > MAX_WINDOW_TOTAL) continue;
    perWindow.set(r.windowKey, sum);
    out.push({ windowKey: r.windowKey, itemId: r.itemId, kind, points, startedAt, doneAt });
  }
  return out;
}
