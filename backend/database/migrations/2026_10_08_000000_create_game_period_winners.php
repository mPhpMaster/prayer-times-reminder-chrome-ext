<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Period prizes (App\Support\GameWinners). Points are never reset; instead,
 * once a month / quarter / half-year / year has ended, the player(s) with the
 * most points earned inside it are recorded as its winners — ties all win.
 *
 * game_period_winners  one row per (period, winner).
 * game_settled_periods one row per decided period, also when nobody played,
 *                      so a period is never decided twice.
 *
 * Each table is checked for first, like the earlier migrations, so a
 * half-finished run can be run again on the production SQLite 3.7.
 */
return new class extends Migration
{
    private function exists(string $table): bool
    {
        return DB::getDriverName() === 'sqlite'
            ? (bool) DB::selectOne("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = ?", [$table])
            : Schema::hasTable($table);
    }

    public function up(): void
    {
        if (! $this->exists('game_period_winners')) {
            Schema::create('game_period_winners', function (Blueprint $t) {
                $t->string('period_type', 8);   // month | quarter | half | year
                $t->string('period_key', 8);    // 2026-10 | 2026-Q4 | 2026-H2 | 2026
                $t->foreignId('user_id')->constrained('game_users')->cascadeOnDelete();
                $t->bigInteger('points');
                $t->bigInteger('decided_at');   // ms
                $t->primary(['period_type', 'period_key', 'user_id']);
                $t->index('user_id');
            });
        }
        if (! $this->exists('game_settled_periods')) {
            Schema::create('game_settled_periods', function (Blueprint $t) {
                $t->string('period_type', 8);
                $t->string('period_key', 8);
                $t->bigInteger('settled_at');   // ms
                $t->primary(['period_type', 'period_key']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('game_period_winners');
        Schema::dropIfExists('game_settled_periods');
    }
};
