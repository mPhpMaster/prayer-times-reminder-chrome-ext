package com.mphpmaster.prayer;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.List;

/**
 * A parent's family alerts: "Ahmad, Sara: the Asr adhkar aren't done", with
 * the app closed. The web layer plans the checks (core/logic/family-alerts.js
 * — when each prayer window closes, by the phone's prayer times) and hands
 * them over with ready-made, localized templates; this side stores them, arms
 * the next exact alarm, and at fire time asks the game server
 * (GET /v1/family/status) and fills the templates in, exactly as
 * fillFamilyAlert() does in JS. Re-armed on boot by BootReceiver.
 */
final class FamilyAlertScheduler {

    private static final String PREFS = "FamilyAlertSchedule";
    private static final String KEY_ENTRIES = "entries";
    private static final String KEY_API = "api";
    private static final String KEY_TOKEN = "token";
    private static final String CHANNEL_ID = "family-alerts";
    private static final int REQUEST_ALARM = 4730;
    private static final int REQUEST_OPEN = 4731;
    private static final int NOTIF_BASE = 4740;
    // The phone was off through the check: skip it rather than alert hours late.
    private static final long LATE_TOLERANCE_MS = 60 * 60_000;
    private static final int TIMEOUT_MS = 6000;

    private FamilyAlertScheduler() {}

    /** Replace the schedule (JSON array of {when, kind, keys, tpl}) and re-arm. */
    static void setSchedule(Context ctx, String entriesJson, String api, String token) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_ENTRIES, entriesJson)
            .putString(KEY_API, api == null ? "" : api)
            .putString(KEY_TOKEN, token == null ? "" : token)
            .apply();
        armNext(ctx);
    }

    static void armNext(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        am.cancel(pending(ctx));
        long now = System.currentTimeMillis();
        long next = Long.MAX_VALUE;
        JSONArray arr = load(ctx);
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            long when = o != null ? o.optLong("when", 0) : 0;
            if (when > now && when < next) next = when;
        }
        if (next == Long.MAX_VALUE) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pending(ctx));
        } else {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pending(ctx));
        }
    }

    /** Alarm fired: take the due checks off the schedule, re-arm, then ask the server. */
    static void onFire(Context ctx, Runnable done) {
        final Context app = ctx.getApplicationContext();
        long now = System.currentTimeMillis();
        JSONArray arr = load(app);
        JSONArray keep = new JSONArray();
        final List<JSONObject> due = new ArrayList<>();
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o == null) continue;
            long when = o.optLong("when", 0);
            if (when > now) keep.put(o);
            else if (now - when <= LATE_TOLERANCE_MS) due.add(o);
        }
        SharedPreferences sp = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        sp.edit().putString(KEY_ENTRIES, keep.toString()).apply();
        armNext(app);

        final String api = sp.getString(KEY_API, "");
        final String token = sp.getString(KEY_TOKEN, "");
        if (due.isEmpty() || api.isEmpty() || token.isEmpty()) {
            if (done != null) done.run();
            return;
        }
        new Thread(() -> {
            try {
                for (JSONObject check : due) {
                    try {
                        String[] msg = message(check, fetchStatus(api, token, check.optJSONArray("keys")));
                        if (msg != null) notify(app, msg[0], msg[1]);
                    } catch (Exception ignored) {
                        // offline / signed out / not a parent anymore: nothing to say
                    }
                }
            } finally {
                if (done != null) done.run();
            }
        }).start();
    }

    private static JSONObject fetchStatus(String api, String token, JSONArray keys) throws Exception {
        StringBuilder joined = new StringBuilder();
        for (int i = 0; keys != null && i < keys.length(); i++) {
            if (i > 0) joined.append(',');
            joined.append(keys.optString(i));
        }
        String base = api.replaceAll("/+$", "");
        URL url = new URL(base + "/v1/family/status?keys=" + URLEncoder.encode(joined.toString(), "UTF-8"));
        HttpURLConnection c = (HttpURLConnection) url.openConnection();
        try {
            c.setConnectTimeout(TIMEOUT_MS);
            c.setReadTimeout(TIMEOUT_MS);
            c.setRequestProperty("Authorization", "Bearer " + token);
            c.setRequestProperty("Accept", "application/json");
            if (c.getResponseCode() != 200) return null;
            try (InputStream in = c.getInputStream()) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[4096];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                return new JSONObject(out.toString("UTF-8"));
            }
        } finally {
            c.disconnect();
        }
    }

    /** [title, body] for a check, or null when there's nothing to say. Mirrors fillFamilyAlert(). */
    static String[] message(JSONObject check, JSONObject status) {
        if (status == null) return null;
        String kind = check.optString("kind");
        if (!kind.equals(status.optString("notify"))) return null; // the setting changed since planning
        JSONObject tpl = check.optJSONObject("tpl");
        JSONArray children = status.optJSONArray("children");
        JSONArray keys = check.optJSONArray("keys");
        if (tpl == null || children == null || children.length() == 0 || keys == null || keys.length() == 0) return null;
        String sep = tpl.optString("sep", ", ");

        if ("window".equals(kind)) {
            String key = keys.optString(0);
            List<String> late = new ArrayList<>();
            for (int i = 0; i < children.length(); i++) {
                JSONObject c = children.optJSONObject(i);
                if (c == null) continue;
                JSONObject w = c.optJSONObject("windows") != null ? c.optJSONObject("windows").optJSONObject(key) : null;
                if (w != null && !w.optBoolean("complete")) late.add(name(c));
            }
            if (late.isEmpty()) return null;
            return new String[] { tpl.optString("title").replace("{names}", join(late, sep)), tpl.optString("body") };
        }

        JSONObject prayers = tpl.optJSONObject("prayers");
        List<String> lines = new ArrayList<>();
        for (int i = 0; i < children.length(); i++) {
            JSONObject c = children.optJSONObject(i);
            if (c == null) continue;
            JSONObject windows = c.optJSONObject("windows");
            List<String> missed = new ArrayList<>();
            for (int k = 0; k < keys.length(); k++) {
                String key = keys.optString(k);
                JSONObject w = windows != null ? windows.optJSONObject(key) : null;
                if (w != null && !w.optBoolean("complete")) {
                    String prayer = key.length() > 11 ? key.substring(11) : key;
                    missed.add(prayers != null ? prayers.optString(prayer, prayer) : prayer);
                }
            }
            if (!missed.isEmpty()) {
                lines.add(tpl.optString("line").replace("{name}", name(c)).replace("{prayers}", join(missed, sep)));
            }
        }
        return new String[] { tpl.optString("title"), lines.isEmpty() ? tpl.optString("allDone") : join(lines, "\n") };
    }

    private static String name(JSONObject c) {
        String n = c.optString("displayName", "");
        return n.isEmpty() ? c.optString("username", "") : n;
    }

    private static String join(List<String> parts, String sep) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < parts.size(); i++) {
            if (i > 0) b.append(sep);
            b.append(parts.get(i));
        }
        return b.toString();
    }

    private static void notify(Context ctx, String title, String body) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        String lang = DhikrScheduler.prefString(ctx, "lang", "ar");
        boolean rtl = "ar".equals(lang) || "ur".equals(lang);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(new NotificationChannel(
                CHANNEL_ID, rtl ? "تنبيهات العائلة" : "Family alerts", NotificationManager.IMPORTANCE_DEFAULT));
        }
        Intent open = new Intent(ctx, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, REQUEST_OPEN, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        int id = NOTIF_BASE + (int) ((System.currentTimeMillis() / 1000) % 1000);
        nm.notify(id, new NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(pi)
            .setAutoCancel(true)
            .build());
    }

    private static JSONArray load(Context ctx) {
        String raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_ENTRIES, "[]");
        try {
            return new JSONArray(raw);
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    private static PendingIntent pending(Context ctx) {
        return PendingIntent.getBroadcast(ctx, REQUEST_ALARM, new Intent(ctx, FamilyAlertReceiver.class),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
