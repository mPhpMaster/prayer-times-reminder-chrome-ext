package com.mphpmaster.prayer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** A family check is due ({@link FamilyAlertScheduler}): ask the server (async,
 *  so keep the broadcast alive until it answers). */
public class FamilyAlertReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        final PendingResult pending = goAsync();
        FamilyAlertScheduler.onFire(context, pending::finish);
    }
}
