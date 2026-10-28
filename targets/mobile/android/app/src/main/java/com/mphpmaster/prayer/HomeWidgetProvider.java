package com.mphpmaster.prayer;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;

/**
 * Shared provider for the home-screen widgets. Nothing runs on the main
 * thread beyond queueing work for HomeWidgets' background thread:
 *  - placed / system update / removed: one coalesced re-render of all widgets
 *    (which also re-arms — or, with none left, cancels — the next refresh);
 *  - resized / moved ("options changed", sent in bursts while dragging): no
 *    work on Android 12+ (each widget carries its layouts per size), else a
 *    debounced re-render of that widget only if its layout changes.
 */
public abstract class HomeWidgetProvider extends AppWidgetProvider {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        if (AppWidgetManager.ACTION_APPWIDGET_OPTIONS_CHANGED.equals(action)) {
            HomeWidgets.onResized(context,
                intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID));
            return;
        }
        if (AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action)
                || AppWidgetManager.ACTION_APPWIDGET_DELETED.equals(action)
                || AppWidgetManager.ACTION_APPWIDGET_DISABLED.equals(action)
                || AppWidgetManager.ACTION_APPWIDGET_ENABLED.equals(action)) {
            HomeWidgets.requestRefresh(context, this);
            return;
        }
        super.onReceive(context, intent);
    }
}
