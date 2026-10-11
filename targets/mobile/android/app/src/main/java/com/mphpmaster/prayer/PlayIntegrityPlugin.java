package com.mphpmaster.prayer;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.integrity.IntegrityManagerFactory;
import com.google.android.play.core.integrity.StandardIntegrityManager;
import com.google.android.play.core.integrity.StandardIntegrityManager.PrepareIntegrityTokenRequest;
import com.google.android.play.core.integrity.StandardIntegrityManager.StandardIntegrityTokenProvider;
import com.google.android.play.core.integrity.StandardIntegrityManager.StandardIntegrityTokenRequest;

/**
 * PlayIntegrity — Google Play Integrity (standard requests).
 *
 * token({ requestHash, projectNumber }) -> { token }. requestHash is the
 * game server's one-time nonce and projectNumber its Google Cloud project
 * (both from GET /v1/integrity/challenge, so nothing is baked into the app).
 * The server sends the token to Google to decode and judges the verdict;
 * the app never sees or trusts the result itself.
 *
 * The token provider is prepared once (a slow call) and reused; it is dropped
 * after a failed request so the next call prepares a fresh one.
 * Rejections carry code "failed" (no Play services, not installed from Play,
 * network, misconfigured project).
 */
@CapacitorPlugin(name = "PlayIntegrity")
public class PlayIntegrityPlugin extends Plugin {

    private StandardIntegrityTokenProvider provider;
    private long providerProject;

    @PluginMethod
    public void token(PluginCall call) {
        String hash = call.getString("requestHash");
        long project;
        try {
            project = Long.parseLong(call.getString("projectNumber", ""));
        } catch (NumberFormatException e) {
            call.reject("No Google Cloud project number", "failed");
            return;
        }
        if (hash == null || hash.isEmpty() || hash.length() > 500) {
            call.reject("Bad request hash", "failed");
            return;
        }
        if (provider != null && providerProject == project) {
            request(call, hash);
            return;
        }
        StandardIntegrityManager manager = IntegrityManagerFactory.createStandard(getContext());
        manager.prepareIntegrityToken(
                PrepareIntegrityTokenRequest.builder().setCloudProjectNumber(project).build())
            .addOnSuccessListener(p -> {
                provider = p;
                providerProject = project;
                request(call, hash);
            })
            .addOnFailureListener(e -> call.reject(String.valueOf(e.getMessage()), "failed"));
    }

    private void request(PluginCall call, String hash) {
        provider.request(StandardIntegrityTokenRequest.builder().setRequestHash(hash).build())
            .addOnSuccessListener(r -> {
                JSObject ret = new JSObject();
                ret.put("token", r.token());
                call.resolve(ret);
            })
            .addOnFailureListener(e -> {
                provider = null;
                call.reject(String.valueOf(e.getMessage()), "failed");
            });
    }
}
