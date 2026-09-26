package com.mphpmaster.prayer;

import android.os.CancellationSignal;

import androidx.core.content.ContextCompat;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

/**
 * GoogleAuth — "Sign in with Google" through Android Credential Manager.
 *
 * signIn({ clientId }) -> { idToken }. clientId is the OAuth *web* client id,
 * fetched from the game server (/v1/auth/config), so nothing is baked into the
 * app; the server verifies the ID token was issued for it. No secret is used
 * anywhere on the device.
 *
 * Rejections carry a code the web layer maps to a message:
 *   "canceled"    the player closed the Google sheet
 *   "no-account"  no Google account on the device / none usable
 *   "failed"      anything else (Play services missing, misconfigured client, network)
 *
 * signOut() clears the Credential Manager state, so the next sign-in shows
 * the account picker again instead of silently reusing the last account.
 */
@CapacitorPlugin(name = "GoogleAuth")
public class GoogleAuthPlugin extends Plugin {

    @PluginMethod
    public void signIn(PluginCall call) {
        String clientId = call.getString("clientId");
        if (clientId == null || clientId.isEmpty()) {
            call.reject("Google sign-in is not configured", "failed");
            return;
        }
        if (getActivity() == null) {
            call.reject("No activity", "failed");
            return;
        }
        GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(clientId).build();
        GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
        CredentialManager cm = CredentialManager.create(getContext());
        cm.getCredentialAsync(getActivity(), request, new CancellationSignal(),
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse response) {
                    Credential c = response.getCredential();
                    if (c instanceof CustomCredential
                        && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(c.getType())) {
                        try {
                            GoogleIdTokenCredential g = GoogleIdTokenCredential.createFrom(c.getData());
                            JSObject ret = new JSObject();
                            ret.put("idToken", g.getIdToken());
                            call.resolve(ret);
                        } catch (Exception e) {
                            call.reject("Unreadable Google credential", "failed");
                        }
                    } else {
                        call.reject("Unexpected credential type", "failed");
                    }
                }

                @Override
                public void onError(GetCredentialException e) {
                    if (e instanceof GetCredentialCancellationException) {
                        call.reject("Canceled", "canceled");
                    } else if (e instanceof NoCredentialException) {
                        call.reject("No Google account", "no-account");
                    } else {
                        call.reject(String.valueOf(e.getMessage()), "failed");
                    }
                }
            });
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        CredentialManager cm = CredentialManager.create(getContext());
        cm.clearCredentialStateAsync(new ClearCredentialStateRequest(), new CancellationSignal(),
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<Void, ClearCredentialException>() {
                @Override
                public void onResult(Void unused) {
                    call.resolve();
                }

                @Override
                public void onError(ClearCredentialException e) {
                    call.resolve(); // nothing to clear is fine
                }
            });
    }
}
