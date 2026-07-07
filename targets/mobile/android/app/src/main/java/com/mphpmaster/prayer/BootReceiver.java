package com.mphpmaster.prayer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Alarms don't survive a reboot — re-arm the dhikr schedule and the
 *  prayer-lock schedule. (Prayer notifications are restored by the
 *  local-notifications plugin's own boot receiver.) */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        DhikrScheduler.apply(context);
        PrayerLockScheduler.armNext(context);
        // If a lock was still in its window when the device rebooted, resume it.
        LockState.rearmIfActive(context);
    }
}
