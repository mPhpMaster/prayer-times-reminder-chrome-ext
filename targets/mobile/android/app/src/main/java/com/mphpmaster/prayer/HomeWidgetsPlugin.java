package com.mphpmaster.prayer;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * HomeWidgets — the web layer's side of the home-screen widgets
 * (Capacitor.Plugins.HomeWidgets, see adapter.js publishWidgets).
 *
 * update({ json }): store the widget snapshot and re-render every widget.
 * placed(): { count } of widgets on the home screen.
 * takeLaunch(): the screen a widget tap asked for ({ route: "game" } from the
 *   adhkar widget), once — for a cold start, where the page loads after it.
 * "launch" event: the same while the app is already running.
 */
@CapacitorPlugin(name = "HomeWidgets")
public class HomeWidgetsPlugin extends Plugin {

    private String pendingRoute;

    @Override
    public void load() {
        pendingRoute = takeRoute(getActivity() != null ? getActivity().getIntent() : null);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        String route = takeRoute(intent);
        if (route == null) return;
        if (hasListeners("launch")) {
            JSObject ev = new JSObject();
            ev.put("route", route);
            notifyListeners("launch", ev);
        } else {
            pendingRoute = route;
        }
    }

    // Read once: a later re-creation of the activity must not replay it.
    private static String takeRoute(Intent intent) {
        if (intent == null) return null;
        String route = intent.getStringExtra(HomeWidgets.EXTRA_ROUTE);
        intent.removeExtra(HomeWidgets.EXTRA_ROUTE);
        return route;
    }

    @PluginMethod
    public void update(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("json is required");
            return;
        }
        HomeWidgets.save(getContext(), json);
        call.resolve();
    }

    /** { count }: widgets on the home screen — the web layer skips
     *  publishing (and loading the game scripts) while there are none. */
    @PluginMethod
    public void placed(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("count", HomeWidgets.placedCount(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void takeLaunch(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("route", pendingRoute);
        pendingRoute = null;
        call.resolve(ret);
    }
}
