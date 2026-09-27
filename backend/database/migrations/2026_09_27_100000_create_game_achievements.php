<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Achievements a player has earned (App\Support\GameStats). One row per
 * (player, achievement): the primary key is what makes awarding idempotent —
 * a resent sync, a recompute or an account merge can never add a second row.
 * `earned_at` is the finish time of the completion that earned it (ms, from
 * the device), not the time the server noticed, so recomputing never moves it.
 *
 * Checks for the table first, like the auth migration, so a half-finished run
 * can be run again on the production SQLite 3.7.
 */
return new class extends Migration
{
    public function up(): void
    {
        $exists = DB::getDriverName() === 'sqlite'
            ? (bool) DB::selectOne("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = 'game_achievements'")
            : Schema::hasTable('game_achievements');
        if ($exists) {
            return;
        }
        Schema::create('game_achievements', function (Blueprint $t) {
            $t->foreignId('user_id')->constrained('game_users')->cascadeOnDelete();
            $t->string('achievement_id', 32);
            $t->bigInteger('earned_at');
            $t->primary(['user_id', 'achievement_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_achievements');
    }
};
