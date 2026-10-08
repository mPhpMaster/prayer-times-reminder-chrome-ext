<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Admins can ban a player (AdminController::ban). A banned player is signed
 * out everywhere, can't sign in, and disappears from search, profiles,
 * follows, the leaderboard and prizes; unbanning brings everything back
 * (nothing is deleted).
 *
 * Plain ADD COLUMNs (nullable), checked first, so it runs on the production
 * SQLite 3.7 and can be run again.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! in_array('banned_at', $this->columns(), true)) {
            Schema::table('game_users', function (Blueprint $t) {
                $t->timestamp('banned_at')->nullable();
                $t->string('ban_reason', 200)->nullable();
                $t->string('banned_by', 191)->nullable();
            });
        }
    }

    public function down(): void
    {
        // Left in place: dropping columns needs SQLite 3.26+ (production runs 3.7).
    }

    private function columns(): array
    {
        if (DB::getDriverName() === 'sqlite') {
            return array_map(fn ($c) => $c->name, DB::select('PRAGMA table_info("game_users")'));
        }

        return Schema::getColumnListing('game_users');
    }
};
