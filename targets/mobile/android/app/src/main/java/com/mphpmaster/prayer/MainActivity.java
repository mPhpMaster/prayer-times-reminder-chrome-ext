package com.mphpmaster.prayer;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PrayerLockPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
