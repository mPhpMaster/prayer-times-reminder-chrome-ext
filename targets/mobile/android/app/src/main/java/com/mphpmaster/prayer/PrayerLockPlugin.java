package com.mphpmaster.prayer;

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
 * start(): launch the full-screen LockActivity + foreground service, enable DND.
 * clear(): end the lock everywhere, restore DND.
 * showDhikr(): show the silent floating dhikr balloon (DhikrOverlay).
 * scheduleDhikr(): (re)arm the periodic dhikr alarms from stored settings.
 * ensureOverlayPermission(): request "display over other apps" if missing.
 * ensureBatteryExemption(): request battery-optimization exemption if missing.
 *
 * The full lock config (prayer name, localized strings, theme, duration) is sent
 * as JSON and forwarded to the LockActivity, which reuses overlay-lock.js.
 */
@CapacitorPlugin(name = "PrayerLock")
public class PrayerLockPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        JSObject cfg = call.getData();
        LockLauncher.launch(getContext(), cfg.toString());
        call.resolve();
    }

    /** Store the rolling prayer-lock schedule ({when, config} entries built by
     *  the web layer) and arm the next exact alarm — the lock then fires over
     *  ANY app, with this app closed. Pass an empty list to disarm. */
    @PluginMethod
    public void schedulePrayerLocks(PluginCall call) {
        com.getcapacitor.JSArray entries = call.getArray("entries");
        PrayerLockScheduler.setSchedule(
            getContext(), entries != null ? entries.toString() : "[]");
        call.resolve();
    }

    /** Do-Not-Disturb (silent during prayer) needs notification-policy access.
     *  Opens the system grant screen when missing. Returns the state BEFORE
     *  any prompt. */
    @PluginMethod
    public void ensureDndAccess(PluginCall call) {
        Context ctx = getContext();
        boolean granted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            android.app.NotificationManager nm =
                (android.app.NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            granted = nm != null && nm.isNotificationPolicyAccessGranted();
            if (!granted) {
                Intent i = new Intent(
                    android.provider.Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    ctx.startActivity(i);
                } catch (Exception ignored) {
                    // No grant screen on this OEM — DND stays a silent no-op.
                }
            }
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void clear(PluginCall call) {
        Context ctx = getContext();
        LockState.clear(ctx);
        ctx.stopService(new Intent(ctx, LockForegroundService.class));
        LockActivity.finishCurrent();
        Dnd.restore(ctx);
        call.resolve();
    }

    /** Show the floating dhikr balloon now. { shown: false } means the overlay
     *  permission is missing (or the screen is off) — the web side can fall
     *  back to the in-app balloon. */
    @PluginMethod
    public void showDhikr(PluginCall call) {
        boolean shown = DhikrOverlay.show(getContext());
        JSObject ret = new JSObject();
        ret.put("shown", shown);
        call.resolve(ret);
    }

    /** (Re)arm the periodic dhikr alarms from the stored settings. Call on
     *  launch/resume and whenever dhikr settings change. */
    @PluginMethod
    public void scheduleDhikr(PluginCall call) {
        DhikrScheduler.apply(getContext());
        call.resolve();
    }

    /** "Display over other apps" — required for the floating dhikr balloon.
     *  Opens the system grant screen when missing. Returns the state BEFORE
     *  any prompt. */
    @PluginMethod
    public void ensureOverlayPermission(PluginCall call) {
        Context ctx = getContext();
        boolean granted = DhikrOverlay.canShow(ctx);
        if (!granted) {
            Intent i = new Intent(
                android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                android.net.Uri.parse("package:" + ctx.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                ctx.startActivity(i);
            } catch (Exception ignored) {
                // No grant screen on this OEM — nothing else we can do.
            }
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    /**
     * Scheduled notifications only fire reliably when the app is exempt from
     * battery optimization (vivo/oppo/xiaomi kill alarms otherwise). If not yet
     * exempt, shows the system exemption dialog. Returns { exempt } as it was
     * BEFORE any prompt, so the web side can decide whether to nag again.
     */
    @PluginMethod
    public void ensureBatteryExemption(PluginCall call) {
        Context ctx = getContext();
        boolean exempt = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            android.os.PowerManager pm =
                (android.os.PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            exempt = pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
            if (!exempt) {
                Intent i = new Intent(
                    android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                i.setData(android.net.Uri.parse("package:" + ctx.getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    ctx.startActivity(i);
                } catch (Exception ignored) {
                    // Some OEMs hide this dialog; nothing else we can do here.
                }
            }
        }
        JSObject ret = new JSObject();
        ret.put("exempt", exempt);
        call.resolve(ret);
    }
}
