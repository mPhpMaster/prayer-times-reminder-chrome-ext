package com.mphpmaster.prayer;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;

/**
 * Shared provider for the home-screen widgets: every system callback (placed,
 * update, resized, removed) re-renders all of them from the stored snapshot,
 * off the main thread, and re-arms — or, with none left, cancels — the next
 * refresh. See HomeWidgets.
 */
public abstract class HomeWidgetProvider extends AppWidgetProvider {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        if (AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action)
                || AppWidgetManager.ACTION_APPWIDGET_OPTIONS_CHANGED.equals(action)
                || AppWidgetManager.ACTION_APPWIDGET_DELETED.equals(action)
                || AppWidgetManager.ACTION_APPWIDGET_DISABLED.equals(action)
                || AppWidgetManager.ACTION_APPWIDGET_ENABLED.equals(action)) {
            HomeWidgets.refreshAsync(this, context);
            return;
        }
        super.onReceive(context, intent);
    }
}
