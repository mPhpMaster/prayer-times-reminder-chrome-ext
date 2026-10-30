package com.mphpmaster.prayer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Alarms don't survive a reboot — re-arm the dhikr schedule, the
 *  prayer-lock schedule and the upcoming prayer notifications (without
 *  replaying the ones missed while the phone was off), and re-render the
 *  home-screen widgets. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        PrayerNotificationRestore.run(context);
        DhikrScheduler.apply(context);
        PrayerLockScheduler.armNext(context);
        // If a lock was still in its window when the device rebooted, resume it.
        LockState.rearmIfActive(context);
        // ...or if it ended while the phone was off, lift the DND it left behind.
        Dnd.restoreIfStale(context);
        // The daily "new version" check.
        UpdateChecker.schedule(context);
        // A parent's family checks.
        FamilyAlertScheduler.armNext(context);
        // Home-screen widgets: fresh countdowns and their next refresh alarm.
        HomeWidgets.requestRefresh(context, this);
    }
}
