package com.mphpmaster.prayer;

import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

/**
 * Do-Not-Disturb during the prayer lock. Static so every teardown path
 * (plugin clear(), the lock screen's own unlock/expiry) restores the filter
 * the user had before the lock engaged. No-ops without policy access.
 */
final class Dnd {

    private static int previousFilter = -1;

    private Dnd() {}

    static void enable(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        // Already engaged — don't overwrite the saved pre-lock filter (the
        // watchdog may re-launch the lock repeatedly).
        if (previousFilter != -1) return;
        NotificationManager nm = manager(ctx);
        if (nm == null || !nm.isNotificationPolicyAccessGranted()) return;
        previousFilter = nm.getCurrentInterruptionFilter();
        nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_NONE);
    }

    static void restore(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        NotificationManager nm = manager(ctx);
        if (nm == null || !nm.isNotificationPolicyAccessGranted()) return;
        int restore = previousFilter > 0 ? previousFilter : NotificationManager.INTERRUPTION_FILTER_ALL;
        nm.setInterruptionFilter(restore);
        previousFilter = -1;
    }

    private static NotificationManager manager(Context ctx) {
        return (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
    }
}
