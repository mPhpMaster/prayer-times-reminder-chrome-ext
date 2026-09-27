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

    // Importance and sound are fixed when a channel is first created, so each
    // change needs a new id: "prayer-lock" was IMPORTANCE_LOW (too low for a
    // full-screen intent) and "prayer-lock-alarm" had the default sound (it
    // rang through "silent during prayer" and over the adhan). Both are deleted.
    private static final String CHANNEL_ID = "prayer-lock-alarm-silent";
    private static final String[] OLD_CHANNEL_IDS = { "prayer-lock", "prayer-lock-alarm" };
    private static final int NOTIF_ID = 4711;
    private static final int REQUEST_CODE = 4712;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String configJson = intent != null ? intent.getStringExtra(LockActivity.EXTRA_CONFIG) : null;
        // A START_STICKY restart (process killed mid-lock) arrives with a null
        // intent. Recover the config of a still-running real lock; otherwise
        // (test lock, or the lock already ended) there is nothing to show — a
        // full-screen intent with no config would open an empty black screen.
        if (configJson == null && LockState.until(this) > System.currentTimeMillis()) {
            configJson = LockState.config(this);
        }
        if (configJson == null) {
            // startForeground is still owed after startForegroundService().
            startForeground(NOTIF_ID, buildNotification(null));
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }
        startForeground(NOTIF_ID, buildNotification(configJson));
        return START_STICKY;
    }

    private Notification buildNotification(String configJson) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Prayer lock", NotificationManager.IMPORTANCE_HIGH);
            channel.setBypassDnd(true);
            // Silent: the lock screen plays its own adhan/chime, and "silent
            // during prayer" must not be broken by this notification.
            channel.setSound(null, null);
            channel.enableVibration(false);
            if (nm != null) {
                for (String old : OLD_CHANNEL_IDS) nm.deleteNotificationChannel(old);
                nm.createNotificationChannel(channel);
            }
        }

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Prayer time")
            .setContentText("It's time to pray.")
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setOngoing(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX);
        if (configJson != null) {
            Intent lockIntent = new Intent(this, LockActivity.class);
            lockIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            lockIntent.putExtra(LockActivity.EXTRA_CONFIG, configJson);
            PendingIntent fullScreenPi = PendingIntent.getActivity(
                this, REQUEST_CODE, lockIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            b.setFullScreenIntent(fullScreenPi, true).setContentIntent(fullScreenPi);
        }
        return b.build();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
