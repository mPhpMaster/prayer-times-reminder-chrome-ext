package com.mphpmaster.prayer;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * Persistent record of an in-progress lock + its AlarmManager watchdog. The
 * watchdog is what makes the lock un-escapable by killing the app: alarms live
 * in the system, not the app process, so swiping the app from recents or
 * stopping the foreground service does NOT stop them. Every tick re-launches
 * the lock if it isn't showing, until unlockAt; then it tears the lock down
 * (covering the case where the process died and the normal expiry never ran).
 *
 * The one thing this can't survive is Settings > App info > Force stop, which
 * the OS uses to cancel all of an app's alarms — no normal app can resist that.
 */
final class LockState {

    private static final String PREFS = "LockState";
    private static final String KEY_UNTIL = "until";
    private static final String KEY_CONFIG = "config";
    private static final int REQUEST_CODE = 4714;
    // Re-check cadence. Short enough that an escape only flashes another app for
    // a moment; long enough not to churn the battery during the lock window.
    static final long TICK_MS = 4000;

    private LockState() {}

    static void setActive(Context ctx, String configJson, long unlockAt) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putLong(KEY_UNTIL, unlockAt)
            .putString(KEY_CONFIG, configJson)
            .apply();
        scheduleTick(ctx, System.currentTimeMillis() + TICK_MS);
    }

    static void clear(Context ctx) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putLong(KEY_UNTIL, 0).remove(KEY_CONFIG).apply();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pending(ctx));
    }

    static long until(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(KEY_UNTIL, 0);
    }

    static String config(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_CONFIG, null);
    }

    /** Re-arm the watchdog if a lock is still due (used on boot). */
    static void rearmIfActive(Context ctx) {
        if (until(ctx) > System.currentTimeMillis()) {
            scheduleTick(ctx, System.currentTimeMillis() + TICK_MS);
        }
    }

    static void scheduleTick(Context ctx, long when) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = pending(ctx);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
        } else {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
        }
    }

    private static PendingIntent pending(Context ctx) {
        Intent i = new Intent(ctx, LockWatchdogReceiver.class);
        return PendingIntent.getBroadcast(
            ctx, REQUEST_CODE, i,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
