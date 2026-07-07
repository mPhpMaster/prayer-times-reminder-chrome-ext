package com.mphpmaster.prayer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Watchdog tick: keeps the prayer lock in front until unlockAt, even after the
 * user kills the app (see LockState). Re-launches the lock if it isn't showing,
 * then re-arms the next tick; tears everything down once the window has passed.
 */
public class LockWatchdogReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Context ctx = context.getApplicationContext();
        long until = LockState.until(ctx);
        if (until <= 0) return; // no active lock

        long now = System.currentTimeMillis();
        if (now >= until) {
            // Window elapsed. If the process had died, the Activity's own expiry
            // never ran — finish the teardown here.
            LockActivity.finishCurrent();
            ctx.stopService(new Intent(ctx, LockForegroundService.class));
            Dnd.restore(ctx);
            LockState.clear(ctx);
            return;
        }

        // Still within the window: make sure the lock is up, then tick again.
        String config = LockState.config(ctx);
        if (config != null && !LockActivity.isActive()) {
            LockLauncher.bringToFront(ctx, config);
        }
        LockState.scheduleTick(ctx, now + LockState.TICK_MS);
    }
}
