package com.mphpmaster.prayer;

import android.content.Context;
import android.media.AudioManager;

/**
 * Detects an in-progress phone call (cellular or VoIP) or an incoming ring via
 * the audio mode — no READ_PHONE_STATE / call-log permission needed, which
 * keeps the Play listing clean. Used to postpone the prayer lock until the call
 * ends rather than covering it (and never to end the call — emergency-safe).
 */
final class CallState {

    private CallState() {}

    static boolean isInCall(Context ctx) {
        AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
        if (am == null) return false;
        int mode = am.getMode();
        return mode == AudioManager.MODE_IN_CALL          // cellular call
            || mode == AudioManager.MODE_IN_COMMUNICATION // VoIP / video call
            || mode == AudioManager.MODE_RINGTONE;        // incoming, ringing
    }
}
