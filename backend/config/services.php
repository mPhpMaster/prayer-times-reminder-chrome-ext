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
