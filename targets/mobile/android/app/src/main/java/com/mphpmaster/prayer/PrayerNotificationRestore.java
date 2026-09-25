package com.mphpmaster.prayer;

import android.content.Context;

import com.capacitorjs.plugins.localnotifications.LocalNotification;
import com.capacitorjs.plugins.localnotifications.LocalNotificationManager;
import com.capacitorjs.plugins.localnotifications.LocalNotificationSchedule;
import com.capacitorjs.plugins.localnotifications.NotificationStorage;
import com.getcapacitor.CapConfig;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
 * Re-arms the stored prayer notifications after a reboot, replacing the
 * local-notifications plugin's LocalNotificationRestoreReceiver (removed in
 * the manifest). The plugin moves every missed notification to "now + 15 s",
 * so a phone that was off for a day showed a flood of stale prayer alerts.
 *
 * Here: upcoming notifications are re-armed as scheduled; missed ones are
 * dropped, except the most recent one if it is under GRACE_MS old (the phone
 * was only briefly off around a prayer time), which is shown once.
 */
final class PrayerNotificationRestore {
    static final long GRACE_MS = 10 * 60 * 1000;

    private PrayerNotificationRestore() {}

    static void run(Context context) {
        NotificationStorage storage = new NotificationStorage(context);
        long now = System.currentTimeMillis();
        List<LocalNotification> upcoming = new ArrayList<>();
        LocalNotification latestMissed = null;
        long latestMissedAt = Long.MIN_VALUE;

        for (String id : storage.getSavedNotificationIds()) {
            LocalNotification n = storage.getSavedNotification(id);
            if (n == null) continue;
            LocalNotificationSchedule schedule = n.getSchedule();
            Date at = schedule != null ? schedule.getAt() : null;
            if (at == null || schedule.isRepeating() || at.getTime() > now) {
                upcoming.add(n);
                continue;
            }
            storage.deleteNotification(id); // missed: never replay it
            if (at.getTime() > latestMissedAt) {
                latestMissedAt = at.getTime();
                latestMissed = n;
            }
        }

        if (latestMissed != null && now - latestMissedAt <= GRACE_MS) {
            latestMissed.getSchedule().setAt(new Date(now + 15 * 1000));
            List<LocalNotification> one = new ArrayList<>();
            one.add(latestMissed);
            storage.appendNotifications(one);
            upcoming.add(latestMissed);
        }

        if (upcoming.isEmpty()) return;
        new LocalNotificationManager(storage, null, context, CapConfig.loadDefault(context))
            .schedule(null, upcoming);
    }
}
