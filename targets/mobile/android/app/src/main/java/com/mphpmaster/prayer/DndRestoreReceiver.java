package com.mphpmaster.prayer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Safety net: restores Do-Not-Disturb after the lock window if every other
 *  teardown path was lost with the process (see Dnd.scheduleRestore). */
public class DndRestoreReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Dnd.restoreIfStale(context.getApplicationContext());
    }
}
