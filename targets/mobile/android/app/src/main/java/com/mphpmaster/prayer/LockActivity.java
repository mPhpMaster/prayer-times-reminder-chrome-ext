package com.mphpmaster.prayer;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

/**
 * Full-screen, show-when-locked lock screen. Hosts a WebView that loads the
 * shared lock.html (which reuses overlay-lock.js), so the lock UI is identical
 * across extension / desktop / mobile. Unlock routes back here via the
 * AndroidLock JS interface; countdown expiry does too (__prayerLockOnExpire),
 * with a native fallback timer in case the WebView never delivers it.
 */
public class LockActivity extends Activity {

    public static final String EXTRA_CONFIG = "config";
    private static LockActivity current;
    // Lock-in-progress flag + its config, for re-asserting the screen when the
    // user tries to escape via home / recents while the countdown runs.
    private static volatile boolean active;
    private static volatile String activeConfig;

    private final Handler expiryHandler = new Handler(Looper.getMainLooper());
    private final Runnable expiryFallback = this::endLock;

    public static void finishCurrent() {
        active = false;
        LockActivity a = current;
        if (a != null) a.runOnUiThread(a::finish);
    }

    /** True while the lock is showing in this process — lets the watchdog skip
     *  a needless re-launch when the lock is already up. */
    static boolean isActive() {
        return active;
    }

    // Hide the status + navigation bars (call after setContentView — the insets
    // controller needs the decor view). Re-applied on focus so a transient
    // swipe-in of the bars re-hides.
    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            android.view.WindowInsetsController ic = getWindow().getDecorView().getWindowInsetsController();
            if (ic != null) {
                ic.hide(android.view.WindowInsets.Type.systemBars());
                ic.setSystemBarsBehavior(
                    android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
                    | android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && active) hideSystemBars();
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        current = this;

        // Show over the lock screen and keep the display on.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Cover the ENTIRE screen: draw edge-to-edge behind the system bars and
        // a dark window background (removes the white flash while lock.html
        // loads). The bars themselves are hidden in hideSystemBars(), AFTER
        // setContentView — the insets controller needs the decor view to exist.
        getWindow().setBackgroundDrawable(
            new android.graphics.drawable.ColorDrawable(0xFF0C1C1C));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
        }

        final String configJson = getIntent().getStringExtra(EXTRA_CONFIG);
        active = true;
        activeConfig = configJson;
        scheduleExpiryFallback(configJson);

        WebView web = new WebView(this);
        web.setBackgroundColor(0xFF0C1C1C); // no white flash before overlay-lock paints
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.addJavascriptInterface(new Bridge(), "AndroidLock");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                if (configJson != null) {
                    String js = "window.__ptActivate(" + jsString(configJson) + ");";
                    view.evaluateJavascript(js, null);
                }
            }
        });
        web.loadUrl("file:///android_asset/public/lock.html");
        setContentView(web);
        hideSystemBars();
    }

    // Native safety net: finish at unlockAt even if the WebView side dies or
    // the expiry hook never fires. The JS path normally beats this by ~2s.
    private void scheduleExpiryFallback(String configJson) {
        if (configJson == null) return;
        try {
            long unlockAt = new JSONObject(configJson).optLong("unlockAt", 0);
            long remaining = unlockAt - System.currentTimeMillis();
            if (unlockAt > 0) {
                expiryHandler.postDelayed(expiryFallback, Math.max(0, remaining) + 2000);
            }
        } catch (Exception ignored) {
            // Unparseable config — leave teardown to unlock / plugin clear().
        }
    }

    // Single teardown path: stop the keep-alive service, cancel the watchdog,
    // lift DND, close.
    private void endLock() {
        active = false;
        LockState.clear(getApplicationContext());
        stopService(new Intent(this, LockForegroundService.class));
        Dnd.restore(this);
        finish();
    }

    // --- Escape resistance ------------------------------------------------------
    // Home / recents can't be intercepted by a normal app, but we can make
    // leaving pointless: the moment the lock loses the foreground while still
    // active, it relaunches itself on top. Turning the screen OFF is allowed
    // (that's not using the phone) — showWhenLocked keeps us there on wake.

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        reassertSoon();
    }

    @Override
    protected void onStop() {
        super.onStop();
        reassertSoon();
    }

    private void reassertSoon() {
        if (!active || isFinishing()) return;
        final android.content.Context app = getApplicationContext();
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (!active) return;
            android.os.PowerManager pm =
                (android.os.PowerManager) app.getSystemService(POWER_SERVICE);
            if (pm != null && !pm.isInteractive()) return; // screen off — fine
            LockLauncher.bringToFront(app, activeConfig);
        }, 500);
    }

    // Wrap a JSON string as a JS string literal argument.
    private static String jsString(String s) {
        return "'" + s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n") + "'";
    }

    @Override
    public void onBackPressed() {
        // Swallow back so the lock can't be dismissed with the system button.
    }

    @Override
    protected void onDestroy() {
        expiryHandler.removeCallbacks(expiryFallback);
        if (current == this) current = null;
        super.onDestroy();
    }

    /** JS-callable bridge: lock.html calls AndroidLock.unlock() on manual unlock
     *  and on countdown expiry — both fully tear the lock down. */
    public class Bridge {
        @JavascriptInterface
        public void unlock() {
            runOnUiThread(LockActivity.this::endLock);
        }
    }
}
