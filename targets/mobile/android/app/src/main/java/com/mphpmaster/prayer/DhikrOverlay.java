package com.mphpmaster.prayer;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

/**
 * The floating dhikr balloon — silent, over whatever the user is doing: a
 * TYPE_APPLICATION_OVERLAY WebView loading the shared dhikr.html
 * (overlay-tasbih.js). No notification, no sound. The window is only a small
 * corner region (anchored per the tasbihPosition setting) so it can be
 * touchable without blocking the rest of the screen: a tap on the balloon (or
 * anywhere in the region) dismisses it via the AndroidDhikr bridge; otherwise
 * it auto-dismisses. Needs the "display over other apps" grant.
 */
final class DhikrOverlay {

    // Safety net just past the balloon's own 10s auto-dismiss (which also
    // closes the window through the AndroidDhikr bridge).
    private static final long SHOW_MS = 12_000;
    // Region large enough for the widest/tallest card (max-width 320px + 24px
    // margins; long Hisn phrases wrap to several lines).
    private static final int REGION_W_DP = 380;
    private static final int REGION_H_DP = 340;

    private static WebView current;

    private DhikrOverlay() {}

    static boolean canShow(Context ctx) {
        return Settings.canDrawOverlays(ctx);
    }

    /** Show the balloon. Returns false when it can't (no permission / screen off). */
    @SuppressLint("SetJavaScriptEnabled")
    static boolean show(Context context) {
        final Context ctx = context.getApplicationContext();
        if (!canShow(ctx)) return false;
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        if (pm != null && !pm.isInteractive()) return false; // screen off — skip quietly

        new Handler(Looper.getMainLooper()).post(() -> {
            WindowManager wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);
            if (wm == null) return;
            removeCurrent(ctx);

            WebView web = new WebView(ctx);
            web.setBackgroundColor(Color.TRANSPARENT);
            web.getSettings().setJavaScriptEnabled(true);
            web.addJavascriptInterface(new Bridge(ctx), "AndroidDhikr");
            web.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView v, String url) {
                    JSONObject cfg = new JSONObject();
                    try {
                        cfg.put("lang", DhikrScheduler.prefString(ctx, "lang", "en"));
                        cfg.put("theme", DhikrScheduler.prefString(ctx, "theme", ""));
                        cfg.put("position", DhikrScheduler.prefString(ctx, "tasbihPosition", "bottom-center"));
                    } catch (Exception ignored) {}
                    v.evaluateJavascript("window.__ptShowDhikr(" + cfg + ");", null);
                }
            });

            int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;
            DisplayMetrics dm = ctx.getResources().getDisplayMetrics();
            int w = Math.min(dm.widthPixels, (int) (REGION_W_DP * dm.density));
            int h = Math.min(dm.heightPixels, (int) (REGION_H_DP * dm.density));
            WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                w, h, type,
                // Touchable (tap to dismiss) but never focusable, and touches
                // outside the region go straight to the app underneath.
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                    | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                    | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT);
            lp.gravity = gravityFor(DhikrScheduler.prefString(ctx, "tasbihPosition", "bottom-center"));

            try {
                wm.addView(web, lp);
                current = web;
                web.loadUrl("file:///android_asset/public/dhikr.html");
                new Handler(Looper.getMainLooper()).postDelayed(() -> removeCurrent(ctx), SHOW_MS);
            } catch (Exception ignored) {
                // OEM refused the overlay at add time — nothing more we can do.
                web.destroy();
            }
        });
        return true;
    }

    // The balloon anchors to the same corner inside the region (24px margins),
    // so region corner == screen corner keeps it exactly where Settings says.
    private static int gravityFor(String position) {
        switch (position) {
            case "top-left": return Gravity.TOP | Gravity.LEFT;
            case "top-right": return Gravity.TOP | Gravity.RIGHT;
            case "top-center": return Gravity.TOP | Gravity.CENTER_HORIZONTAL;
            case "bottom-left": return Gravity.BOTTOM | Gravity.LEFT;
            case "bottom-right": return Gravity.BOTTOM | Gravity.RIGHT;
            default: return Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
        }
    }

    private static void removeCurrent(Context ctx) {
        WebView w = current;
        current = null;
        if (w == null) return;
        WindowManager wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);
        if (wm != null) {
            try { wm.removeView(w); } catch (Exception ignored) {}
        }
        w.destroy();
    }

    /** JS bridge: the balloon calls AndroidDhikr.dismiss() on tap / auto-dismiss. */
    static final class Bridge {
        private final Context ctx;
        Bridge(Context ctx) { this.ctx = ctx; }

        @JavascriptInterface
        public void dismiss() {
            new Handler(Looper.getMainLooper()).post(() -> removeCurrent(ctx));
        }
    }
}
