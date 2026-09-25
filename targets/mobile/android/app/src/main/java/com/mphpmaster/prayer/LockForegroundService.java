package com.mphpmaster.prayer;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

/**
 * Keeps the lock alive while the user is meant to be praying. A foreground
 * service with an ongoing, full-screen-intent notification resists the OS
 * killing the process AND is what actually gets LockActivity on screen when
 * the alarm fires with the app backgrounded: a plain startActivity() from a
 * receiver/service context is blocked on Android 10+ by many OEMs even with
 * SYSTEM_ALERT_WINDOW granted (see LockLauncher.bringToFront), so
 * setFullScreenIntent — the same mechanism alarm-clock/calling apps rely on —
 * is the reliable path. The notification is also tappable as a manual
 * fallback if the OS still suppresses the full-screen launch.
 */
public class LockForegroundService extends Service {

    // New channel id: importance is fixed at first creation, so a previously
    // installed IMPORTANCE_LOW "prayer-lock" channel would otherwise never be
    // upgraded to the HIGH importance a full-screen intent requires.
    private static final String CHANNEL_ID = "prayer-lock-alarm";
    private static final int NOTIF_ID = 4711;
    private static final int REQUEST_CODE = 4712;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String configJson = intent != null ? intent.getStringExtra(LockActivity.EXTRA_CONFIG) : null;
        startForeground(NOTIF_ID, buildNotification(configJson));
        return START_STICKY;
    }

    private Notification buildNotification(String configJson) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Prayer lock", NotificationManager.IMPORTANCE_HIGH);
            channel.setBypassDnd(true);
            if (nm != null) nm.createNotificationChannel(channel);
        }

        Intent lockIntent = new Intent(this, LockActivity.class);
        lockIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        lockIntent.putExtra(LockActivity.EXTRA_CONFIG, configJson);
        PendingIntent fullScreenPi = PendingIntent.getActivity(
            this, REQUEST_CODE, lockIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Prayer time")
            .setContentText("It's time to pray.")
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setFullScreenIntent(fullScreenPi, true)
            .setContentIntent(fullScreenPi)
            .build();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
