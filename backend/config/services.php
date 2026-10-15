<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    // Google sign-in for the game: the OAuth *web* client id the app requests
    // ID tokens for (a public id, not a secret). Unset = Google sign-in off.
    'google' => [
        'client_id' => env('GOOGLE_WEB_CLIENT_ID'),
    ],

    // Sign in with Apple (App\Support\AppleSignIn, docs/APPLE-SIGNIN.md).
    // Everything stays off while client_ids and services_id are both empty.
    // - client_ids: identity-token audiences accepted from native apps (the
    //   iOS bundle id, e.g. com.mphpmaster.prayer), comma separated.
    // - services_id: the web Services ID used by Chrome, the website, Windows
    //   and Android (Apple's web flow); also accepted as an audience.
    // - redirect_uri: the Return URL registered for the Services ID (default
    //   APP_URL/v1/auth/apple/callback).
    // - team_id / key_id / private_key_path: the "Sign in with Apple" key
    //   (.p8, outside the web root). Optional: with it the server keeps a
    //   refresh token so it can revoke Apple access on unlink / account delete.
    // - extension_ids / web_return: where the callback may send players back.
    'apple' => [
        'client_ids' => array_values(array_filter(array_map('trim', explode(',', (string) env('APPLE_CLIENT_IDS', ''))))),
        'services_id' => env('APPLE_SERVICES_ID'),
        'redirect_uri' => env('APPLE_REDIRECT_URI'),
        'team_id' => env('APPLE_TEAM_ID'),
        'key_id' => env('APPLE_KEY_ID'),
        'private_key_path' => env('APPLE_PRIVATE_KEY_PATH'),
        'extension_ids' => array_values(array_filter(array_map('trim', explode(',', (string) env('APPLE_EXTENSION_IDS', 'knahkbkmbjghaiillhngjbhoinmeegoc'))))),
        'web_return' => env('APPLE_WEB_RETURN', 'https://mphpmaster.github.io/prayer-times-reminder-chrome-ext/app/apple-callback.html'),
    ],

    // Google Play Integrity (Android app only). credentials = path to the
    // service-account JSON key (kept outside the web root) allowed to call
    // decodeIntegrityToken; project_number = the Google Cloud project linked
    // in Play Console. Either unset = integrity checks off.
    'play_integrity' => [
        'credentials' => env('PLAY_INTEGRITY_CREDENTIALS'),
        'project_number' => env('PLAY_INTEGRITY_PROJECT_NUMBER'),
        'package' => env('PLAY_INTEGRITY_PACKAGE', 'com.mphpmaster.prayer'),
    ],

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
