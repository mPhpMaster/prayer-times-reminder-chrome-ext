package com.mphpmaster.prayer;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

/**
 * Schedules the periodic dhikr overlay with AlarmManager — one-shot alarms,
 * re-armed after each fire (random mode changes the gap every time) and on
 * boot. Settings are read straight from the Capacitor Preferences store
 * ("CapacitorStorage") so the native side always follows the popup's settings
 * without a separate sync channel. No notifications involved: the alarm shows
 * the silent floating balloon (DhikrOverlay).
 */
final class DhikrScheduler {

    private static final String PREFS = "CapacitorStorage";
    private static final int REQUEST_CODE = 4712;
    private static final long MIN_GAP_MS = 60_000;

    private DhikrScheduler() {}

    /** Re-derive everything from settings: cancel, then arm if enabled. */
    static void apply(Context ctx) {
        cancel(ctx);
        if (enabled(ctx)) scheduleNext(ctx);
    }

    static boolean enabled(Context ctx) {
        return "true".equals(pref(ctx, "tasbihEnabled"));
    }

    static void scheduleNext(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        long at = System.currentTimeMillis() + nextGapMs(ctx);
        PendingIntent pi = pending(ctx);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        } else {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    static void cancel(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pending(ctx));
    }

    private static PendingIntent pending(Context ctx) {
        Intent i = new Intent(ctx, DhikrAlarmReceiver.class);
        return PendingIntent.getBroadcast(
            ctx, REQUEST_CODE, i,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static long nextGapMs(Context ctx) {
        int minutes = prefInt(ctx, "tasbihIntervalMinutes", 15);
        if ("random".equals(prefString(ctx, "tasbihIntervalMode", "fixed"))) {
            int min = prefInt(ctx, "tasbihRandomMin", 5);
            int max = prefInt(ctx, "tasbihRandomMax", 15);
            if (min > max) { int t = min; min = max; max = t; }
            minutes = min + (int) (Math.random() * (max - min + 1));
        }
        return Math.max(MIN_GAP_MS, minutes * 60_000L);
    }

    // --- Capacitor Preferences access (values are JSON-encoded strings) --------

    static String pref(Context ctx, String key) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return sp.getString(key, null);
    }

    static int prefInt(Context ctx, String key, int fallback) {
        String v = pref(ctx, key);
        if (v == null) return fallback;
        try {
            return (int) Double.parseDouble(v.replace("\"", "").trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    /** JSON string values keep their quotes in the store ("\"ar\""). */
    static String prefString(Context ctx, String key, String fallback) {
        String v = pref(ctx, key);
        if (v == null) return fallback;
        v = v.trim();
        if (v.length() >= 2 && v.startsWith("\"") && v.endsWith("\"")) {
            v = v.substring(1, v.length() - 1);
        }
        return v.isEmpty() ? fallback : v;
    }
}
