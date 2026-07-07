package com.mphpmaster.prayer;

import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONObject;

/**
 * Single entry point for engaging the prayer lock, shared by the plugin
 * (in-app / test) and PrayerAlarmReceiver (scheduled fire with the app closed
 * or another app in front). Starting an Activity from the background is
 * permitted for this app because it holds the SYSTEM_ALERT_WINDOW grant.
 */
final class LockLauncher {

    private LockLauncher() {}

    /** Full engagement: keep-alive service + DND (if silent) + full-screen
     *  Activity + a watchdog (for real locks) that resists app-kill. */
    static void launch(Context ctx, String configJson) {
        boolean silent = true;
        boolean test = false;
        long unlockAt = 0;
        try {
            JSONObject c = new JSONObject(configJson);
            silent = c.optBoolean("silent", true);
            test = c.optBoolean("test", false);
            unlockAt = c.optLong("unlockAt", 0);
        } catch (Exception ignored) {}

        Intent svc = new Intent(ctx, LockForegroundService.class);
        svc.putExtra(LockActivity.EXTRA_CONFIG, configJson);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(svc);
        } else {
            ctx.startService(svc);
        }
        // Silent (Do Not Disturb) only when the setting is on.
        if (silent) Dnd.enable(ctx);
        bringToFront(ctx, configJson);

        // Real (non-test) locks get the anti-escape watchdog; the 5 s test lock
        // doesn't need it.
        if (!test && unlockAt > 0) {
            LockState.setActive(ctx, configJson, unlockAt);
        }
    }

    /** (Re)launch just the lock Activity — also used to re-assert the lock when
     *  the user tries to escape via home / recents. singleTask + CLEAR_TOP means
     *  an existing instance is simply brought back to the front. */
    static void bringToFront(Context ctx, String configJson) {
        Intent act = new Intent(ctx, LockActivity.class);
        act.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        act.putExtra(LockActivity.EXTRA_CONFIG, configJson);
        try {
            ctx.startActivity(act);
        } catch (Exception ignored) {
            // Background-start denied by an OEM despite the SAW grant — the
            // scheduled notification path still lets the user open the lock.
        }
    }
}
