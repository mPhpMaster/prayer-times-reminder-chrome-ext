package com.mphpmaster.prayer;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PrayerLockPlugin.class);
        registerPlugin(SpeechPlugin.class);
        registerPlugin(GoogleAuthPlugin.class);
        super.onCreate(savedInstanceState);
        // New-version notice: daily background check + one now.
        UpdateChecker.schedule(this);
        UpdateChecker.check(this, null);
        handleUpdateIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleUpdateIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        // Play's recommended check: finish an immediate update the user
        // already started if the app was sent to the background mid-flow.
        UpdateChecker.startFlow(this, true);
    }

    // Opened from the "update available" notification: start the update.
    private void handleUpdateIntent(Intent intent) {
        if (intent != null && intent.getBooleanExtra(UpdateChecker.EXTRA_START_UPDATE, false)) {
            intent.removeExtra(UpdateChecker.EXTRA_START_UPDATE);
            UpdateChecker.startFlow(this, false);
        }
    }
}
