package com.mphpmaster.prayer;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.text.format.DateUtils;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Home-screen widgets: "Next prayer", "Prayer times", "Prayer adhkar" and the
 * "Prayer countdown" card.
 *
 * The prayer engine is JS, so the web layer (adapter.js publishWidgets)
 * publishes a snapshot whenever something shown changes — ready-formatted
 * times for yesterday + the next 7 days, the game's task summary, labels in
 * the app's language — through HomeWidgetsPlugin, and only while a widget is
 * placed. Everything here only reads that snapshot: the next prayer and the
 * current task window are picked by the clock.
 *
 * Cost, by design (the owner's rule: widgets must not slow the phone):
 *  - Countdowns show hours:minutes only, no seconds. They are Chronometers the
 *    launcher ticks itself; a format precision cuts "H:MM:SS" to "H:MM" (or
 *    "MM" for the countdown card's minutes box), so the app does no per-minute
 *    or per-second work at all.
 *  - One alarm, always RTC (non-wakeup: it never wakes a sleeping phone; one
 *    that comes due while asleep is delivered once at the next wake), re-armed
 *    for the next moment something changes: a prayer time, a window's tasks
 *    opening, local midnight, and — for the countdowns' "H:MM" format and the
 *    hours box — the hour boundaries of the remaining time. With every widget
 *    placed that is ~12 + ~24 renders a day; the countdown card adds a
 *    progress-bar step every 15 minutes, only while the phone is awake.
 *  - Nothing is armed when no widget is placed; no service, no
 *    updatePeriodMillis. Receivers render off the main thread (goAsync).
 * Re-rendered on boot and time / timezone / locale changes too. When the
 * snapshot runs out (app not opened for a week) — or the clock jumps outside
 * it — the widgets ask for the app.
 */
final class HomeWidgets {

    static final String EXTRA_ROUTE = "widgetRoute";
    static final String ROUTE_GAME = "game";
    private static final String PREFS = "HomeWidgets";
    private static final String KEY_SNAPSHOT = "snapshot";
    private static final int REQUEST_TICK = 4740;
    private static final int REQUEST_OPEN_HOME = 4741;
    private static final int REQUEST_OPEN_GAME = 4742;
    private static final long MIN = 60_000;
    private static final long HOUR = 60 * MIN;
    // Countdowns round up to the minute (2:54:30 left shows "2:55").
    private static final long ROUND_UP = MIN - 1000;
    // No prayer is ever this far from the previous one: a "next" prayer
    // further away means the clock is outside the snapshot.
    private static final long MAX_GAP = 30 * HOUR;
    private static final long PROGRESS_STEP = 15 * MIN;

    private static final int[] CELL = { R.id.cell_0, R.id.cell_1, R.id.cell_2, R.id.cell_3, R.id.cell_4, R.id.cell_5 };
    private static final int[] CELL_NAME = { R.id.name_0, R.id.name_1, R.id.name_2, R.id.name_3, R.id.name_4, R.id.name_5 };
    private static final int[] CELL_TIME = { R.id.time_0, R.id.time_1, R.id.time_2, R.id.time_3, R.id.time_4, R.id.time_5 };
    private static final Class<?>[] PROVIDERS = {
        NextPrayerWidget.class, PrayerTimesWidget.class, TasksWidget.class, CountdownWidget.class,
    };

    private static final ExecutorService WORKER = Executors.newSingleThreadExecutor();

    private HomeWidgets() {}

    // ---- snapshot ---------------------------------------------------------

    /** Store the web layer's snapshot and re-render every placed widget. */
    static void save(Context ctx, String json) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_SNAPSHOT, json).apply();
        refreshAll(ctx);
    }

    /** How many of the app's widgets are on the home screen(s). */
    static int placedCount(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        if (mgr == null) return 0;
        int n = 0;
        for (Class<?> p : PROVIDERS) n += ids(ctx, mgr, p).length;
        return n;
    }

    static final class Prayer {
        String key, name, time, opens, dayKey;
        long at;
    }

    static final class Snapshot {
        String lang = "", theme = "", digits = "latn", place = "";
        boolean rtl, hasLocation;
        JSONObject labels = new JSONObject();
        JSONObject game;
        final List<String> dayKeys = new ArrayList<>();
        final List<String> dayTitles = new ArrayList<>();
        final List<Prayer[]> days = new ArrayList<>(); // per day: Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha
        final List<Prayer> timeline = new ArrayList<>(); // the five prayers, in order (no Sunrise)

        String label(String key) {
            return labels.optString(key, "");
        }

        /** Western digits in a template value -> the app's digit style. */
        String num(String s) {
            char zero;
            if ("arab".equals(digits)) zero = '٠';
            else if ("deva".equals(digits)) zero = '०';
            else return s;
            StringBuilder b = new StringBuilder(s.length());
            for (char c : s.toCharArray()) b.append(c >= '0' && c <= '9' ? (char) (zero + (c - '0')) : c);
            return b.toString();
        }

        boolean arabicScript() {
            return "ar".equals(lang) || "ur".equals(lang);
        }

        /** Index in the timeline of the first prayer after now, or -1 when the
         *  clock is outside the snapshot (ran out, or set back before it). */
        int nextIndex(long now) {
            for (int i = 0; i < timeline.size(); i++) {
                Prayer p = timeline.get(i);
                if (p.at > now) return p.at - now <= MAX_GAP && i > 0 ? i : -1;
            }
            return -1;
        }

        Prayer next(long now) {
            int i = nextIndex(now);
            return i >= 0 ? timeline.get(i) : null;
        }
    }

    static Snapshot load(Context ctx) {
        String raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_SNAPSHOT, null);
        if (raw == null) return null;
        try {
            JSONObject o = new JSONObject(raw);
            Snapshot s = new Snapshot();
            s.lang = o.optString("lang", "");
            s.rtl = o.optBoolean("rtl", false);
            s.theme = o.optString("theme", "");
            s.digits = o.optString("digits", "latn");
            s.place = o.optString("place", "");
            s.hasLocation = o.optBoolean("hasLocation", false);
            JSONObject labels = o.optJSONObject("labels");
            if (labels != null) s.labels = labels;
            s.game = o.optJSONObject("game");
            JSONArray days = o.optJSONArray("days");
            for (int d = 0; days != null && d < days.length(); d++) {
                JSONObject day = days.getJSONObject(d);
                JSONArray ps = day.getJSONArray("prayers");
                Prayer[] row = new Prayer[ps.length()];
                for (int i = 0; i < ps.length(); i++) {
                    JSONObject j = ps.getJSONObject(i);
                    Prayer p = new Prayer();
                    p.key = j.optString("k");
                    p.name = j.optString("n");
                    p.time = j.optString("s");
                    p.opens = j.optString("o", "");
                    p.at = j.optLong("t", 0);
                    p.dayKey = day.optString("key");
                    row[i] = p;
                    if (!"Sunrise".equals(p.key) && p.at > 0) s.timeline.add(p);
                }
                s.dayKeys.add(day.optString("key"));
                s.dayTitles.add(day.optString("title"));
                s.days.add(row);
            }
            return s;
        } catch (Exception e) {
            return null; // malformed: treated as "not set up yet"; the next publish replaces it
        }
    }

    // ---- refresh + the next re-render ---------------------------------------

    /** From a BroadcastReceiver / provider: render off the main thread. */
    static void refreshAsync(BroadcastReceiver receiver, Context ctx) {
        final BroadcastReceiver.PendingResult pending = receiver.goAsync();
        final Context app = ctx.getApplicationContext();
        WORKER.execute(() -> {
            try {
                refreshAll(app);
            } finally {
                pending.finish();
            }
        });
    }

    static synchronized void refreshAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        if (mgr == null) return;
        int[] next = ids(ctx, mgr, NextPrayerWidget.class);
        int[] times = ids(ctx, mgr, PrayerTimesWidget.class);
        int[] tasks = ids(ctx, mgr, TasksWidget.class);
        int[] cards = ids(ctx, mgr, CountdownWidget.class);
        boolean any = next.length + times.length + tasks.length + cards.length > 0;
        Snapshot snap = any ? load(ctx) : null;
        long now = System.currentTimeMillis();
        for (int id : next) safeUpdate(mgr, id, renderNext(ctx, options(mgr, id), snap, now));
        for (int id : times) safeUpdate(mgr, id, renderTimes(ctx, options(mgr, id), snap, now));
        for (int id : tasks) safeUpdate(mgr, id, renderTasks(ctx, snap, now));
        for (int id : cards) safeUpdate(mgr, id, renderCountdown(ctx, snap, now));
        armNext(ctx, snap, now, any, cards.length > 0);
    }

    private static void safeUpdate(AppWidgetManager mgr, int id, RemoteViews rv) {
        try {
            mgr.updateAppWidget(id, rv);
        } catch (Exception ignored) {
            // A host that went away mid-update; the next refresh retries.
        }
    }

    private static int[] ids(Context ctx, AppWidgetManager mgr, Class<?> provider) {
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, provider));
        return ids != null ? ids : new int[0];
    }

    private static Bundle options(AppWidgetManager mgr, int id) {
        Bundle b = mgr.getAppWidgetOptions(id);
        return b != null ? b : new Bundle();
    }

    /** The next moment any countdown's hour digit changes (its "H:MM" format
     *  and the hours box are set per hour), or MAX when under an hour. */
    private static long hourBoundary(long target, long now) {
        long t = target + ROUND_UP;
        long h = (t - now) / HOUR;
        return h >= 1 ? t - h * HOUR : Long.MAX_VALUE;
    }

    private static void armNext(Context ctx, Snapshot snap, long now, boolean any, boolean cards) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = tickIntent(ctx);
        am.cancel(pi);
        if (!any || snap == null) return;
        int ni = snap.nextIndex(now);
        if (ni < 0) return; // out of data: nothing changes until the app republishes

        long delay = delayMin(snap) * MIN;
        long next = nextMidnight(now);
        for (Prayer p : snap.timeline) {
            if (p.at > now && p.at < next) next = p.at;
            if (p.at + delay > now && p.at + delay < next) next = p.at + delay;
        }
        // Hour boundaries of the countdowns: to the next prayer, and the
        // adhkar widget's chip (to its window's opening or end).
        Prayer np = snap.timeline.get(ni);
        next = Math.min(next, hourBoundary(np.at, now));
        Prayer cur = snap.timeline.get(ni - 1);
        long opens = cur.at + delay;
        next = Math.min(next, hourBoundary(now < opens && opens < np.at ? opens : np.at, now));
        if (cards) next = Math.min(next, (now / PROGRESS_STEP + 1) * PROGRESS_STEP);

        long at = next + 1000; // just past the boundary
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
            am.setWindow(AlarmManager.RTC, at, MIN, pi);
        } else {
            am.setExact(AlarmManager.RTC, at, pi);
        }
    }

    private static PendingIntent tickIntent(Context ctx) {
        Intent i = new Intent(ctx, HomeWidgetsReceiver.class).setAction(HomeWidgetsReceiver.ACTION_TICK);
        return PendingIntent.getBroadcast(ctx, REQUEST_TICK, i,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static long nextMidnight(long now) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(now);
        c.add(Calendar.DAY_OF_YEAR, 1);
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    private static String localDayKey(long ms) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(ms);
        return String.format(Locale.ROOT, "%04d-%02d-%02d",
            c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    private static int delayMin(Snapshot snap) {
        return snap.game != null ? snap.game.optInt("delayMin", 30) : 30;
    }

    // ---- shared view helpers ------------------------------------------------

    private static PendingIntent openApp(Context ctx, String route) {
        Intent i = new Intent(ctx, MainActivity.class)
            .setAction(route != null ? "com.mphpmaster.prayer.WIDGET_" + route : Intent.ACTION_MAIN)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (route != null) i.putExtra(EXTRA_ROUTE, route);
        return PendingIntent.getActivity(ctx, route != null ? REQUEST_OPEN_GAME : REQUEST_OPEN_HOME, i,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Background (theme), direction (app language) and tap target. */
    private static void frame(Context ctx, RemoteViews rv, Snapshot snap, String route, int background) {
        int root = android.R.id.background;
        if (snap != null) {
            if (background != 0) {
                rv.setInt(root, "setBackgroundResource",
                    "classic".equals(snap.theme) ? R.drawable.widget_bg_classic : background);
            }
            rv.setInt(root, "setLayoutDirection",
                snap.rtl ? View.LAYOUT_DIRECTION_RTL : View.LAYOUT_DIRECTION_LTR);
        }
        rv.setOnClickPendingIntent(root, openApp(ctx, route));
    }

    /** Show only the message (set-up / no city / out of date). */
    private static void message(RemoteViews rv, String text) {
        rv.setViewVisibility(R.id.content, View.GONE);
        rv.setViewVisibility(R.id.message, View.VISIBLE);
        rv.setTextViewText(R.id.message, text);
    }

    /** Show the data. Launchers re-apply an update onto the views already
     *  there when the layout is the same, so every visibility a message state
     *  may have changed is set back explicitly. */
    private static void content(RemoteViews rv, int... alsoShow) {
        rv.setViewVisibility(R.id.content, View.VISIBLE);
        rv.setViewVisibility(R.id.message, View.GONE);
        for (int id : alsoShow) rv.setViewVisibility(id, View.VISIBLE);
    }

    /** null when the widget can show data, else the message to show instead. */
    private static String problem(Context ctx, Snapshot snap, long now) {
        if (snap == null) return ctx.getString(R.string.widget_open_app);
        if (!snap.hasLocation) return snap.label("noLocation");
        if (snap.next(now) == null) return snap.label("stale");
        return null;
    }

    /** The prayer name, in Amiri for Arabic script (second TextView). */
    private static void name(RemoteViews rv, int plain, int amiri, String text, boolean arabic) {
        rv.setViewVisibility(plain, arabic ? View.GONE : View.VISIBLE);
        rv.setViewVisibility(amiri, arabic ? View.VISIBLE : View.GONE);
        rv.setTextViewText(arabic ? amiri : plain, text);
    }

    /** A text colour from a resource: resolved by the launcher on Android 12+
     *  (so it follows light/dark), at render time before that. */
    private static void textColor(Context ctx, RemoteViews rv, int id, int colorRes) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            rv.setColorStateList(id, "setTextColor", colorRes);
        } else {
            rv.setTextColor(id, ctx.getColor(colorRes));
        }
    }

    /** The system's digits and separator, as the Chronometer shows them. */
    private static String[] elapsedChars() {
        String zero = DateUtils.formatElapsedTime(0); // "00:00"
        return new String[] { zero.substring(0, 1), zero.length() > 2 ? zero.substring(2, 3) : ":" };
    }

    /**
     * Hours:minutes to `target`, ticked by the launcher. The Chronometer's
     * own text is "H:MM:SS" (or "MM:SS" under an hour); the format's
     * precision keeps "H:MM", and a "0:" prefix under an hour. The hour count
     * is fixed per render, so armNext re-renders at each hour boundary.
     * `wrap` puts it in a phrase ("in {c}"), or null.
     */
    private static void countdownHM(RemoteViews rv, int id, long target, long now, String wrap) {
        long t = target + ROUND_UP;
        long h = Math.max(0, (t - now) / HOUR);
        String core;
        if (h >= 10) core = "%.5s";
        else if (h >= 1) core = "%.4s";
        else {
            String[] c = elapsedChars();
            core = c[0].replace("%", "%%") + c[1].replace("%", "%%") + "%.2s";
        }
        String fmt = wrap == null || !wrap.contains("{c}") ? core : wrap.replace("%", "%%").replace("{c}", core);
        rv.setChronometer(id, SystemClock.elapsedRealtime() + (t - now), fmt, true);
        rv.setChronometerCountDown(id, true);
    }

    // ---- "Next prayer" ------------------------------------------------------

    private static RemoteViews renderNext(Context ctx, Bundle opts, Snapshot snap, long now) {
        // One cell high (2x1): the compact row. Portrait height = MAX_HEIGHT.
        int h = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        boolean compact = h > 0 && h < 100;
        RemoteViews rv = new RemoteViews(ctx.getPackageName(),
            compact ? R.layout.widget_next_prayer_compact : R.layout.widget_next_prayer);
        frame(ctx, rv, snap, null, R.drawable.widget_bg);
        String problem = problem(ctx, snap, now);
        if (problem != null) {
            message(rv, problem);
            return rv;
        }
        content(rv);
        Prayer p = snap.next(now);
        if (!compact) rv.setTextViewText(R.id.label, snap.label("nextPrayer"));
        name(rv, R.id.name, R.id.name_ar, p.name, snap.arabicScript());
        rv.setTextViewText(R.id.time, p.time);
        countdownHM(rv, R.id.countdown, p.at, now, compact ? null : snap.label("in"));
        return rv;
    }

    // ---- "Prayer times" -----------------------------------------------------

    private static RemoteViews renderTimes(Context ctx, Bundle opts, Snapshot snap, long now) {
        int w = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int h = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        int layout;
        if (h > 0 && h < 150) layout = R.layout.widget_prayer_times;           // short: one row of six
        else if (w > 0 && w < 250) layout = R.layout.widget_prayer_times_list; // narrow: a list
        else layout = R.layout.widget_prayer_times_grid;                       // 4x2: two rows of three
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), layout);
        frame(ctx, rv, snap, null, R.drawable.widget_bg);
        String problem = problem(ctx, snap, now);
        if (problem != null) {
            rv.setTextViewText(R.id.title, "");
            rv.setTextViewText(R.id.place, "");
            rv.setViewVisibility(R.id.next_box, View.GONE);
            message(rv, problem);
            return rv;
        }
        content(rv, R.id.next_box);
        // The day of the next prayer: after Isha, tomorrow's times.
        Prayer next = snap.next(now);
        int day = Math.max(0, snap.dayKeys.indexOf(next.dayKey));
        String title = snap.dayTitles.get(day);
        String key = snap.dayKeys.get(day);
        if (!key.equals(localDayKey(now)) && key.equals(localDayKey(now + 86_400_000L))) {
            title = snap.label("tomorrow") + " · " + title;
        }
        rv.setTextViewText(R.id.title, title);
        rv.setTextViewText(R.id.place, snap.place);
        rv.setViewVisibility(R.id.place, snap.place.isEmpty() ? View.GONE : View.VISIBLE);
        rv.setTextViewText(R.id.next_name, next.name);
        countdownHM(rv, R.id.countdown, next.at, now, snap.label("in"));

        Prayer[] row = snap.days.get(day);
        for (int i = 0; i < CELL.length; i++) {
            Prayer p = i < row.length ? row[i] : null;
            rv.setViewVisibility(CELL[i], p != null ? View.VISIBLE : View.GONE);
            if (p == null) continue;
            boolean isNext = p == next;
            rv.setTextViewText(CELL_NAME[i], p.name);
            rv.setTextViewText(CELL_TIME[i], p.time);
            rv.setInt(CELL[i], "setBackgroundResource", isNext ? R.drawable.widget_pill : 0);
            textColor(ctx, rv, CELL_NAME[i], isNext ? R.color.widget_accent : R.color.widget_muted);
        }
        return rv;
    }

    // ---- "Prayer adhkar" (game tasks) -------------------------------------------

    private static RemoteViews renderTasks(Context ctx, Snapshot snap, long now) {
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_tasks);
        frame(ctx, rv, snap, ROUTE_GAME, R.drawable.widget_bg);
        String problem = problem(ctx, snap, now);
        if (problem == null && snap.game == null) problem = ctx.getString(R.string.widget_open_app);
        if (problem != null) {
            rv.setViewVisibility(R.id.points, View.GONE);
            rv.setViewVisibility(R.id.footer, View.GONE);
            message(rv, problem);
            return rv;
        }
        content(rv, R.id.points, R.id.footer);
        JSONObject game = snap.game;
        rv.setTextViewText(R.id.label, game.optString("title"));

        // The window "now" is in: from the last prayer reached to the next one.
        int ni = snap.nextIndex(now);
        Prayer cur = snap.timeline.get(ni - 1), end = snap.timeline.get(ni);
        JSONObject per = game.optJSONObject("perPrayer");
        JSONObject info = per != null ? per.optJSONObject(cur.key) : null;
        int total = info != null ? info.optInt("total", 0) : 0;
        JSONObject progress = game.optJSONObject("progress");
        JSONObject prog = progress != null ? progress.optJSONObject(cur.dayKey + ":" + cur.key) : null;
        int done = prog != null ? prog.optInt("done", 0) : 0;
        int points = prog != null ? prog.optInt("points", 0) : 0;
        String nextTitle = prog != null ? prog.optString("next", "")
            : info != null ? info.optString("first", "") : "";
        boolean allDone = total > 0 && done >= total;
        long opensAt = cur.at + delayMin(snap) * MIN;
        boolean locked = now < opensAt && opensAt < end.at;

        name(rv, R.id.prayer, R.id.prayer_ar, cur.name, snap.arabicScript());
        rv.setTextViewText(R.id.points,
            snap.num(game.optString("points", "{n}").replace("{n}", String.valueOf(points))));
        rv.setProgressBar(R.id.progress, Math.max(total, 1), Math.min(done, total), false);
        String doneOf = snap.num(snap.label("doneOf")
            .replace("{d}", String.valueOf(done)).replace("{n}", String.valueOf(total)));
        if (allDone) {
            boolean gift = prog != null && prog.optBoolean("gift", false);
            rv.setTextViewText(R.id.status, "✓ " + doneOf);
            rv.setTextViewText(R.id.next, snap.label(gift ? "allDone" : "giftReady"));
        } else {
            rv.setTextViewText(R.id.status, doneOf);
            rv.setTextViewText(R.id.next, nextTitle.isEmpty() ? "" : snap.label("next").replace("{t}", nextTitle));
        }
        // Footer: a clock time ("open at 12:09", "until Asr · 2:58") and the
        // countdown to it in a timer chip, so neither reads as the other.
        String footer = locked
            ? snap.label("opensAt").replace("{t}", cur.opens)
            : snap.label("openUntil").replace("{p}", end.name).replace("{t}", end.time);
        rv.setTextViewText(R.id.footer_label, footer);
        countdownHM(rv, R.id.footer_timer, locked ? opensAt : end.at, now, null);
        return rv;
    }

    // ---- "Prayer countdown" (the app's next-prayer card) ----------------------

    private static RemoteViews renderCountdown(Context ctx, Snapshot snap, long now) {
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_countdown);
        frame(ctx, rv, snap, null, R.drawable.widget_card_next);
        if (snap != null) rv.setTextViewText(R.id.label, snap.label("nextPrayer"));
        String problem = problem(ctx, snap, now);
        if (problem != null) {
            message(rv, problem);
            return rv;
        }
        content(rv);
        int ni = snap.nextIndex(now);
        Prayer prev = snap.timeline.get(ni - 1), p = snap.timeline.get(ni);
        name(rv, R.id.name, R.id.name_ar, p.name, snap.arabicScript());
        rv.setTextViewText(R.id.unit_h, snap.label("hours"));
        rv.setTextViewText(R.id.unit_m, snap.label("min"));

        // Hours: fixed until the next hour boundary (armNext re-renders then).
        // Minutes: a Chronometer counting to the target minus those hours —
        // always under an hour, so its "MM:SS" cut to "%.2s" is the minutes.
        long t = p.at + ROUND_UP;
        long h = Math.max(0, (t - now) / HOUR);
        String[] c = elapsedChars();
        String hh = String.format(Locale.ROOT, "%02d", h);
        StringBuilder local = new StringBuilder();
        for (char ch : hh.toCharArray()) local.append((char) (c[0].charAt(0) + (ch - '0')));
        rv.setTextViewText(R.id.hours, local.toString());
        rv.setChronometer(R.id.minutes, SystemClock.elapsedRealtime() + (t - h * HOUR - now), "%.2s", true);
        rv.setChronometerCountDown(R.id.minutes, true);

        // Progress since the previous prayer (as the app's card), per 15 minutes.
        long span = Math.max(1, p.at - prev.at);
        rv.setProgressBar(R.id.progress, 1000, (int) Math.max(0, Math.min(1000, (now - prev.at) * 1000 / span)), false);
        return rv;
    }
}
