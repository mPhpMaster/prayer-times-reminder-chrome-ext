package com.mphpmaster.prayer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Exact prayer-time alarm: engage the full-screen lock over whatever the
 *  user is doing, then arm the next prayer. */
public class PrayerAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        PrayerLockScheduler.onFire(context);
    }
}
