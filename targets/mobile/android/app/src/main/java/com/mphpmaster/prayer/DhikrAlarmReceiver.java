package com.mphpmaster.prayer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Each dhikr alarm: show the silent floating balloon, then arm the next one
 *  (one-shot alarms — random mode needs a fresh gap every time). */
public class DhikrAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!DhikrScheduler.enabled(context)) return;
        DhikrOverlay.show(context);
        DhikrScheduler.scheduleNext(context);
    }
}
