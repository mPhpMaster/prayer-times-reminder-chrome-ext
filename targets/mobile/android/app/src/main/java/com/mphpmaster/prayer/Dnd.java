package com.mphpmaster.prayer;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * Do-Not-Disturb during the prayer lock. Every teardown path (plugin clear(),
 * the lock screen's own unlock/expiry, the watchdog, the restore alarm)
 * restores the filter the user had before the lock engaged. No-ops without
 * policy access.
 *
 * The pre-lock filter is persisted, not held in a static: the lock routinely
 * outlives the process (user swipes the app away, OEM battery kill), and a
 * fresh process that re-engaged the lock used to "remember" our own
 * ALARMS filter as the user's — so restore() put DND back on instead of off.
 */
final class Dnd {

    private static final String PREFS = "Dnd";
    private static final String KEY_PREVIOUS = "previous";
    private static final String KEY_RESTORE_AT = "restoreAt";
    private static final int REQUEST_CODE = 4715;
    // Slack after unlockAt before the safety-net alarm restores DND, so the
    // normal expiry/watchdog path gets first go.
    private static final long RESTORE_SLACK_MS = 5000;

    private Dnd() {}

    static void enable(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        // Already engaged — don't overwrite the saved pre-lock filter (the
        // watchdog may re-launch the lock repeatedly, possibly in a new process).
        if (previous(ctx) != -1) return;
        NotificationManager nm = manager(ctx);
        if (nm == null || !nm.isNotificationPolicyAccessGranted()) return;
        int current = nm.getCurrentInterruptionFilter();
        // ALARMS is what we set; finding it with no saved value means an earlier
        // lock never got restored — treat the user's filter as ALL, not ALARMS.
        if (current == NotificationManager.INTERRUPTION_FILTER_ALARMS) {
            current = NotificationManager.INTERRUPTION_FILTER_ALL;
        }
        prefs(ctx).edit().putInt(KEY_PREVIOUS, current).apply();
        // ALARMS, not NONE: "total silence" also mutes the media stream, which
        // killed the lock's own prayer-time sound (adhan / chime, played by the
        // lock WebView as media). Alarms-only still silences calls, ringtone and
        // notifications — the point of "silent during prayer".
        nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALARMS);
    }

    static void restore(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        int previous = previous(ctx);
        cancelRestoreAlarm(ctx);
        NotificationManager nm = manager(ctx);
        if (nm == null || !nm.isNotificationPolicyAccessGranted()) {
            prefs(ctx).edit().remove(KEY_PREVIOUS).remove(KEY_RESTORE_AT).apply();
            return;
        }
        int restore = previous > 0 ? previous : NotificationManager.INTERRUPTION_FILTER_ALL;
        nm.setInterruptionFilter(restore);
        prefs(ctx).edit().remove(KEY_PREVIOUS).remove(KEY_RESTORE_AT).apply();
    }

    /** Arm a one-shot safety net that restores DND shortly after {@code unlockAt}
     *  even if the process, the lock Activity and the watchdog are all gone. */
    static void scheduleRestore(Context ctx, long unlockAt) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        if (previous(ctx) == -1) return; // DND not engaged (no policy access / not silent)
        long when = unlockAt + RESTORE_SLACK_MS;
        prefs(ctx).edit().putLong(KEY_RESTORE_AT, when).apply();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = pending(ctx);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
        } else {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
        }
    }

    /** Restore if DND is still engaged from a lock whose window has passed —
     *  called on app resume, boot, the next scheduled fire and the safety-net
     *  alarm. Harmless when nothing is pending. */
    static void restoreIfStale(Context ctx) {
        if (previous(ctx) == -1) return;
        long now = System.currentTimeMillis();
        long lockUntil = LockState.until(ctx);
        long restoreAt = prefs(ctx).getLong(KEY_RESTORE_AT, 0);
        boolean lockRunning = lockUntil > now || LockActivity.isActive();
        boolean due = restoreAt > 0 ? now >= restoreAt : lockUntil <= now;
        if (!lockRunning && due) restore(ctx);
    }

    private static int previous(Context ctx) {
        return prefs(ctx).getInt(KEY_PREVIOUS, -1);
    }

    private static void cancelRestoreAlarm(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pending(ctx));
    }

    private static PendingIntent pending(Context ctx) {
        Intent i = new Intent(ctx, DndRestoreReceiver.class);
        return PendingIntent.getBroadcast(
            ctx, REQUEST_CODE, i,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static android.content.SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static NotificationManager manager(Context ctx) {
        return (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
    }
}
