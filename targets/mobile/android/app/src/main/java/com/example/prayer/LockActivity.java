package com.example.prayer;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Full-screen, show-when-locked lock screen. Hosts a WebView that loads the
 * shared lock.html (which reuses overlay-lock.js), so the lock UI is identical
 * across extension / desktop / mobile. Unlock routes back here via the
 * AndroidLock JS interface.
 */
public class LockActivity extends Activity {

    public static final String EXTRA_CONFIG = "config";
    private static LockActivity current;

    public static void finishCurrent() {
        LockActivity a = current;
        if (a != null) a.runOnUiThread(a::finish);
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

        final String configJson = getIntent().getStringExtra(EXTRA_CONFIG);

        WebView web = new WebView(this);
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
        if (current == this) current = null;
        super.onDestroy();
    }

    /** JS-callable bridge: lock.html calls AndroidLock.unlock() to end the lock. */
    public class Bridge {
        @JavascriptInterface
        public void unlock() {
            android.content.Intent i = new android.content.Intent(LockActivity.this, LockForegroundService.class);
            stopService(i);
            runOnUiThread(LockActivity.this::finish);
        }
    }
}
