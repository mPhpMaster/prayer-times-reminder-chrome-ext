<?php

use Illuminate\Support\Facades\Route;

// The website (the app in a browser, plus download links) lives on GitHub
// Pages (targets/web, .github/workflows/pages.yml). This server is the game
// API only (/v1); its root sends visitors to the website.
Route::redirect('/', 'https://mphpmaster.github.io/prayer-times-reminder-chrome-ext/app/', 302);
