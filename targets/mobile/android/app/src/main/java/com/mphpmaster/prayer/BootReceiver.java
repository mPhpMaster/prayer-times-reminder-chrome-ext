package com.mphpmaster.prayer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Alarms don't survive a reboot — re-arm the dhikr schedule, the
 *  prayer-lock schedule and the upcoming prayer notifications (without
 *  replaying the ones missed while the phone was off). */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        PrayerNotificationRestore.run(context);
        DhikrScheduler.apply(context);
        PrayerLockScheduler.armNext(context);
        // If a lock was still in its window when the device rebooted, resume it.
        LockState.rearmIfActive(context);
    }
}
