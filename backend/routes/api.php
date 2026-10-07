<?php

use App\Http\Controllers\Game\AccountController;
use App\Http\Controllers\Game\AdminController;
use App\Http\Controllers\Game\AuthController;
use App\Http\Controllers\Game\DedicationController;
use App\Http\Controllers\Game\ProgressController;
use App\Http\Controllers\Game\SocialController;
use App\Http\Middleware\GameAdmin;
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

    // The About page's dedication names (public).
    Route::get('dedications', [DedicationController::class, 'index']);

    Route::middleware([GameAuth::class, 'throttle:120,1'])->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::post('auth/verify-email/send', [AuthController::class, 'sendVerification'])->middleware('throttle:3,10');
        Route::post('auth/verify-email', [AuthController::class, 'verifyEmail'])->middleware('throttle:10,1');
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

        Route::get('dedications/requests', [DedicationController::class, 'mine']);
        Route::post('dedications/requests', [DedicationController::class, 'store'])->middleware('throttle:5,60');

        // The in-app Admin page; GameAdmin checks the verified admin email on every call.
        Route::middleware(GameAdmin::class)->prefix('admin')->group(function () {
            Route::get('overview', [AdminController::class, 'overview']);
            Route::get('admins', [AdminController::class, 'admins']);
            Route::post('admins', [AdminController::class, 'addAdmin']);
            Route::delete('admins/{email}', [AdminController::class, 'removeAdmin']);
            Route::get('users', [AdminController::class, 'users']);
            Route::delete('users/{id}', [AdminController::class, 'deleteUser'])->whereNumber('id');
            Route::post('users/{id}/reset', [AdminController::class, 'resetUser'])->whereNumber('id');
            Route::get('requests', [AdminController::class, 'requests']);
            Route::patch('requests/{id}', [AdminController::class, 'updateRequest'])->whereNumber('id');
            Route::post('requests/{id}/approve', [AdminController::class, 'approve'])->whereNumber('id');
            Route::post('requests/{id}/reject', [AdminController::class, 'reject'])->whereNumber('id');
            Route::get('dedications', [AdminController::class, 'dedications']);
            Route::post('dedications', [AdminController::class, 'addDedication']);
            Route::post('dedications/order', [AdminController::class, 'reorder']);
            Route::patch('dedications/{id}', [AdminController::class, 'updateDedication'])->whereNumber('id');
            Route::delete('dedications/{id}', [AdminController::class, 'deleteDedication'])->whereNumber('id');
            Route::get('log', [AdminController::class, 'log']);
        });
    });

    Route::fallback(fn () => GameRules::fail(404, 'not-found'));
});
