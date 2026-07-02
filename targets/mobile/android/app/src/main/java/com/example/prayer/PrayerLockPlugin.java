package com.example.prayer;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * PrayerLock — native enforcement bridge called from the web layer via
 * Capacitor.Plugins.PrayerLock (see targets/mobile/web/adapter.js).
 *
 * start():   launch the full-screen LockActivity + foreground service, enable DND.
 * clear():   end the lock everywhere, restore DND.
 * showDhikr(): (placeholder) show a dhikr card.
 *
 * The full lock config (prayer name, localized strings, theme, duration) is sent
 * as JSON and forwarded to the LockActivity, which reuses overlay-lock.js.
 */
@CapacitorPlugin(name = "PrayerLock")
public class PrayerLockPlugin extends Plugin {

    private int previousFilter = -1;

    @PluginMethod
    public void start(PluginCall call) {
        JSObject cfg = call.getData();
        String configJson = cfg.toString();

        Context ctx = getContext();

        // Start the foreground service that keeps the lock alive.
        Intent svc = new Intent(ctx, LockForegroundService.class);
        svc.putExtra(LockActivity.EXTRA_CONFIG, configJson);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(svc);
        } else {
            ctx.startService(svc);
        }

        // Launch the full-screen lock activity.
        Intent act = new Intent(ctx, LockActivity.class);
        act.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        act.putExtra(LockActivity.EXTRA_CONFIG, configJson);
        ctx.startActivity(act);

        enableDnd();
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        Context ctx = getContext();
        ctx.stopService(new Intent(ctx, LockForegroundService.class));
        LockActivity.finishCurrent();
        restoreDnd();
        call.resolve();
    }

    @PluginMethod
    public void showDhikr(PluginCall call) {
        // TODO: lightweight dhikr card (reuse overlay-tasbih.js in a small window).
        call.resolve();
    }

    // --- Do Not Disturb (silent) ------------------------------------------------

    private NotificationManager nm() {
        return (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
    }

    private void enableDnd() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        NotificationManager nm = nm();
        if (nm == null || !nm.isNotificationPolicyAccessGranted()) return;
        previousFilter = nm.getCurrentInterruptionFilter();
        nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_NONE);
    }

    private void restoreDnd() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        NotificationManager nm = nm();
        if (nm == null || !nm.isNotificationPolicyAccessGranted()) return;
        int restore = previousFilter > 0 ? previousFilter : NotificationManager.INTERRUPTION_FILTER_ALL;
        nm.setInterruptionFilter(restore);
        previousFilter = -1;
    }
}
