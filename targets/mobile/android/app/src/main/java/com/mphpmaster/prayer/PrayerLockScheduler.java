package com.mphpmaster.prayer;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Fires the full-screen prayer lock at the exact prayer times — over any app,
 * with the app closed — via AlarmManager. The web layer computes the rolling
 * 7-day plan (offline prayer engine) and hands over ready-made lock configs
 * (localized strings, theme, duration); this side just stores them, arms the
 * next exact alarm, and at fire time stamps a fresh unlockAt and launches.
 * Re-armed on boot by BootReceiver.
 */
final class PrayerLockScheduler {

    private static final String PREFS = "PrayerLockSchedule";
    private static final String KEY = "entries";
    private static final int REQUEST_CODE = 4713;
    // A lock that's overdue by more than this (phone off through the prayer)
    // is dropped, not fired hours late.
    private static final long LATE_TOLERANCE_MS = 10 * 60_000;
    // While a call is in progress the due lock is re-queued this far out and
    // re-checked, so it fires once the call ends (never mid-call).
    private static final long CALL_RETRY_MS = 20_000;

    // Original prayer (adhan) time of an entry that was re-queued for a call.
    private static final String KEY_START = "start";
    // Don't bother engaging a lock with less than this left of its window.
    private static final long MIN_REMAINING_MS = 15_000;

    private PrayerLockScheduler() {}

    /** End of an entry's lock window: prayer start + configured duration. */
    static long windowEnd(JSONObject entry) {
        long start = entry.optLong(KEY_START, entry.optLong("when", 0));
        JSONObject cfg = entry.optJSONObject("config");
        long durationMs = (cfg != null ? cfg.optLong("durationSecs", 300) : 300) * 1000;
        return start + durationMs;
    }

    /** Replace the whole schedule (JSON array of {when, config}) and re-arm. */
    static void setSchedule(Context ctx, String entriesJson) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY, entriesJson).apply();
        armNext(ctx);
    }

    static void armNext(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        am.cancel(pending(ctx));

        long now = System.currentTimeMillis();
        long next = Long.MAX_VALUE;
        JSONArray arr = load(ctx);
        for (int i = 0; i < arr.length(); i++) {
            long when = arr.optJSONObject(i) != null ? arr.optJSONObject(i).optLong("when", 0) : 0;
            if (when > now && when < next) next = when;
        }
        if (next == Long.MAX_VALUE) return;

        PendingIntent pi = pending(ctx);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi);
        } else {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi);
        }
    }

    /** Alarm fired: launch the freshest due lock, drop stale ones, re-arm. */
    static void onFire(Context ctx) {
        long now = System.currentTimeMillis();
        // Lift DND left over from a previous lock before (possibly) engaging it again.
        Dnd.restoreIfStale(ctx);
        JSONArray arr = load(ctx);
        JSONObject due = null;
        long dueWhen = 0;
        JSONArray keep = new JSONArray();
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o == null) continue;
            long when = o.optLong("when", 0);
            if (when > now) {
                keep.put(o);
            } else if (now - when <= LATE_TOLERANCE_MS && when > dueWhen
                    && windowEnd(o) - now >= MIN_REMAINING_MS) {
                // Still inside the prayer's lock window (measured from the
                // adhan, not from now) — otherwise it's dropped: a call that
                // outlasted the whole window must not lock the phone afterwards.
                due = o;
                dueWhen = when;
            }
        }
        // Don't lock over an active call — re-queue the due lock a short time
        // out and re-check, so it fires the moment the call ends. The original
        // prayer time is kept in "start", so the lock then only covers what is
        // left of the window (or nothing, if the call outlasted it).
        if (due != null && CallState.isInCall(ctx)) {
            try {
                if (!due.has(KEY_START)) due.put(KEY_START, due.optLong("when", now));
                due.put("when", now + CALL_RETRY_MS);
                keep.put(due);
            } catch (Exception ignored) {}
            due = null;
        }

        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY, keep.toString()).apply();

        if (due != null) {
            try {
                JSONObject cfg = due.getJSONObject("config");
                long unlockAt = windowEnd(due);
                cfg.put("unlockAt", unlockAt);
                // Native fallbacks (DND restore, etc.) read durationSecs as the
                // remaining time, so keep it consistent with unlockAt.
                cfg.put("durationSecs", Math.max(1, (unlockAt - now + 999) / 1000));
                LockLauncher.launch(ctx, cfg.toString());
            } catch (Exception ignored) {
                // Malformed entry — skip; the next schedule sync replaces it.
            }
        }
        armNext(ctx);
    }

    private static JSONArray load(Context ctx) {
        String raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]");
        try {
            return new JSONArray(raw);
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    private static PendingIntent pending(Context ctx) {
        Intent i = new Intent(ctx, PrayerAlarmReceiver.class);
        return PendingIntent.getBroadcast(
            ctx, REQUEST_CODE, i,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
