<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The game's own options (task alerts, the day's journey, the soft sound)
 * saved with the account, so signing in on another device brings them along
 * (GameUser::SETTINGS). A plain nullable ADD COLUMN, checked first, so it
 * runs on the production SQLite 3.7 and can be run again.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! in_array('settings', $this->columns(), true)) {
            Schema::table('game_users', function (Blueprint $t) {
                $t->text('settings')->nullable();
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
