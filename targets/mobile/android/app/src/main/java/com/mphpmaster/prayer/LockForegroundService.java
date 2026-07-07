package com.mphpmaster.prayer;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

/**
 * Keeps the lock alive while the user is meant to be praying. A foreground
 * service with an ongoing notification resists the OS killing the process and
 * backs the full-screen LockActivity / overlay re-assertion.
 */
public class LockForegroundService extends Service {

    private static final String CHANNEL_ID = "prayer-lock";
    private static final int NOTIF_ID = 4711;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIF_ID, buildNotification());
        return START_STICKY;
    }

    private Notification buildNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Prayer lock", NotificationManager.IMPORTANCE_LOW);
            if (nm != null) nm.createNotificationChannel(channel);
        }
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Prayer time")
            .setContentText("It's time to pray.")
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
