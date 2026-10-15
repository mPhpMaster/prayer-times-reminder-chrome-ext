package com.mphpmaster.prayer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Re-renders the home-screen widgets at their next boundary (HomeWidgets'
 *  own non-wakeup alarm) and when the clock, timezone or phone language
 *  changes. Off the main thread; does nothing when no widget is placed. */
public class HomeWidgetsReceiver extends BroadcastReceiver {
    static final String ACTION_TICK = "com.mphpmaster.prayer.WIDGETS_TICK";

    @Override
    public void onReceive(Context context, Intent intent) {
        HomeWidgets.refreshAsync(this, context);
    }
}
