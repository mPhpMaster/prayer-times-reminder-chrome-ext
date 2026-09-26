<?php

use App\Http\Controllers\Game\AccountController;
use App\Http\Controllers\Game\AuthController;
use App\Http\Controllers\Game\ProgressController;
use App\Http\Controllers\Game\SocialController;
use App\Http\Middleware\GameAuth;
use App\Support\GameRules;
use Illuminate\Support\Facades\Route;

// Game API, served at /v1/* (apiPrefix is empty in bootstrap/app.php). The
// app talks only to these endpoints — never to the database.

Route::prefix('v1')->group(function () {
    // Sign-in: email + password or Google. The name-only /v1/register is gone;
    // old name-only accounts keep working and are linked via legacyToken.
    Route::get('auth/config', [AuthController::class, 'config']);
    Route::middleware('throttle:10,1')->group(function () {
        Route::post('auth/register', [AuthController::class, 'register']);
        Route::post('auth/login', [AuthController::class, 'login']);
        Route::post('auth/google', [AuthController::class, 'google']);
        Route::post('auth/reset', [AuthController::class, 'reset']);
    });
    Route::post('auth/forgot', [AuthController::class, 'forgot'])->middleware('throttle:3,10');

    Route::middleware(GameAuth::class)->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::get('me', [AccountController::class, 'show']);
        Route::patch('me', [AccountController::class, 'update']);
        Route::delete('me', [AccountController::class, 'destroy']);

        Route::post('progress', [ProgressController::class, 'store'])->middleware('throttle:60,1');
        Route::get('progress', [ProgressController::class, 'index']);

        Route::get('users', [SocialController::class, 'search']);
        Route::get('users/{username}', [SocialController::class, 'show']);
        Route::put('follows/{username}', [SocialController::class, 'follow']);
        Route::delete('follows/{username}', [SocialController::class, 'unfollow']);
        Route::get('follows', [SocialController::class, 'following']);
        Route::get('leaderboard', [SocialController::class, 'leaderboard']);
    });

    Route::fallback(fn () => GameRules::fail(404, 'not-found'));
});
