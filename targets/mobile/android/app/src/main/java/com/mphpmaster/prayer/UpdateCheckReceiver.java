package com.mphpmaster.prayer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** The daily alarm from {@link UpdateChecker#schedule}: ask Play for a newer
 *  version (async, so keep the broadcast alive until it answers). */
public class UpdateCheckReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        final PendingResult pending = goAsync();
        UpdateChecker.check(context, pending::finish);
    }
}
