package com.mphpmaster.prayer;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.SystemClock;

import androidx.core.app.NotificationCompat;

import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;

import java.util.HashMap;
import java.util.Map;

/**
 * "A new version is ready" for Play installs. A daily inexact alarm (and every
 * app launch) asks Google Play's In-App Updates API whether a newer version is
 * out; if so, a notification is posted once per version. Tapping it opens the
 * app, which starts Play's IMMEDIATE update flow (full-screen; the app restarts
 * on the new version when it finishes). Sideloaded/debug builds simply never
 * see an update from Play.
 */
final class UpdateChecker {

    static final String EXTRA_START_UPDATE = "startUpdate";
    private static final String CHANNEL_ID = "app-updates";
    private static final int NOTIF_ID = 4720;
    private static final int REQUEST_ALARM = 4721;
    private static final int REQUEST_OPEN = 4722;
    static final int REQUEST_UPDATE_FLOW = 4723;
    private static final String PREFS = "UpdateChecker";
    private static final String KEY_NOTIFIED = "notifiedVersionCode";

    // [title, body] per app language — same wording as updateTitle/updateBody
    // in core/data/i18n.js.
    private static final Map<String, String[]> TEXT = new HashMap<>();
    static {
        TEXT.put("en", new String[] { "Update available", "A new version is ready. Tap to update." });
        TEXT.put("ar", new String[] { "تحديث جديد متوفر", "إصدار جديد جاهز. اضغط للتحديث." });
        TEXT.put("ur", new String[] { "نیا اپ ڈیٹ دستیاب ہے", "نیا ورژن تیار ہے۔ اپ ڈیٹ کرنے کے لیے ٹیپ کریں۔" });
        TEXT.put("hi", new String[] { "नया अपडेट उपलब्ध है", "नया संस्करण तैयार है। अपडेट करने के लिए टैप करें।" });
        TEXT.put("id", new String[] { "Pembaruan tersedia", "Versi baru sudah siap. Ketuk untuk memperbarui." });
        TEXT.put("fr", new String[] { "Mise à jour disponible", "Une nouvelle version est prête. Touchez pour mettre à jour." });
        TEXT.put("es", new String[] { "Actualización disponible", "Hay una nueva versión lista. Toca para actualizar." });
        TEXT.put("de", new String[] { "Update verfügbar", "Eine neue Version ist bereit. Tippen zum Aktualisieren." });
        TEXT.put("ru", new String[] { "Доступно обновление", "Новая версия готова. Нажмите, чтобы обновить." });
        TEXT.put("kk", new String[] { "Жаңарту қолжетімді", "Жаңа нұсқа дайын. Жаңарту үшін басыңыз." });
        TEXT.put("uz", new String[] { "Yangilanish mavjud", "Yangi versiya tayyor. Yangilash uchun bosing." });
    }

    private UpdateChecker() {}

    /** Arm the daily background check (idempotent: same PendingIntent). */
    static void schedule(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = PendingIntent.getBroadcast(
            ctx, REQUEST_ALARM, new Intent(ctx, UpdateCheckReceiver.class),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.setInexactRepeating(AlarmManager.ELAPSED_REALTIME,
            SystemClock.elapsedRealtime() + AlarmManager.INTERVAL_HOUR,
            AlarmManager.INTERVAL_DAY, pi);
    }

    /** Ask Play; notify once per available versionCode. `done` may be null. */
    static void check(Context ctx, Runnable done) {
        final Context app = ctx.getApplicationContext();
        AppUpdateManager mgr = AppUpdateManagerFactory.create(app);
        mgr.getAppUpdateInfo()
            .addOnSuccessListener(info -> {
                if (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                        && info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
                    notifyOnce(app, info.availableVersionCode());
                }
                if (done != null) done.run();
            })
            .addOnFailureListener(e -> {
                // Not installed from Play, offline, no Play Store: nothing to do.
                if (done != null) done.run();
            });
    }

    private static void notifyOnce(Context ctx, int versionCode) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (sp.getInt(KEY_NOTIFIED, 0) == versionCode) return;

        String lang = DhikrScheduler.prefString(ctx, "lang", "ar");
        String[] t = TEXT.containsKey(lang) ? TEXT.get(lang) : TEXT.get("en");

        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(new NotificationChannel(
                CHANNEL_ID, t[0], NotificationManager.IMPORTANCE_DEFAULT));
        }
        Intent open = new Intent(ctx, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra(EXTRA_START_UPDATE, true);
        PendingIntent pi = PendingIntent.getActivity(ctx, REQUEST_OPEN, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        nm.notify(NOTIF_ID, new NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle(t[0])
            .setContentText(t[1])
            .setStyle(new NotificationCompat.BigTextStyle().bigText(t[1]))
            .setContentIntent(pi)
            .setAutoCancel(true)
            .build());
        sp.edit().putInt(KEY_NOTIFIED, versionCode).apply();
    }

    /**
     * From the activity: start (or resume) Play's immediate update flow.
     * `onlyIfInProgress` resumes an update the user already started (the
     * recommended onResume check) without starting a new one.
     */
    static void startFlow(Activity activity, boolean onlyIfInProgress) {
        AppUpdateManager mgr = AppUpdateManagerFactory.create(activity);
        mgr.getAppUpdateInfo().addOnSuccessListener(info -> {
            int a = info.updateAvailability();
            boolean inProgress = a == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS;
            boolean available = a == UpdateAvailability.UPDATE_AVAILABLE
                && info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE);
            if (inProgress || (!onlyIfInProgress && available)) start(mgr, info, activity);
        });
    }

    private static void start(AppUpdateManager mgr, AppUpdateInfo info, Activity activity) {
        try {
            mgr.startUpdateFlowForResult(info, activity,
                AppUpdateOptions.defaultOptions(AppUpdateType.IMMEDIATE), REQUEST_UPDATE_FLOW);
            NotificationManager nm = (NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancel(NOTIF_ID);
        } catch (Exception ignored) {
            // Play couldn't show the flow (e.g. the Play Store app is missing).
        }
    }
}
