<?php

return [

    /*
     * The owner's email. A player signed in with this *verified* email is an
     * admin who can't be removed from inside the app (App\Support\GameAdmins).
     */
    'super_admin' => mb_strtolower((string) env('GAME_SUPER_ADMIN', 'mphpmaster@gmail.com')),

    /*
     * The app's UI languages — the keys a dedication name may be written in
     * (core/data/i18n.js SUPPORTED_LANGS). Keep in step.
     */
    'languages' => ['ar', 'en', 'ur', 'fr', 'es', 'hi', 'id', 'de', 'ru', 'kk', 'uz'],

];
