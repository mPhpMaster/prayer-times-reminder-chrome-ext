<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The player's latest Google Play Integrity check (IntegrityController):
 * 'ok' or 'fail', why it failed, and when. A recent 'ok' shows the
 * "verified" mark; a 'fail' is listed for the admins. Plain nullable ADD
 * COLUMNs, checked first, so it runs on the production SQLite 3.7 and can
 * be run again.
 */
return new class extends Migration
{
    public function up(): void
    {
        $have = $this->columns();
        Schema::table('game_users', function (Blueprint $t) use ($have) {
            if (! in_array('integrity_status', $have, true)) {
                $t->string('integrity_status', 8)->nullable();
            }
            if (! in_array('integrity_detail', $have, true)) {
                $t->string('integrity_detail', 160)->nullable();
            }
            if (! in_array('integrity_checked_at', $have, true)) {
                $t->timestamp('integrity_checked_at')->nullable();
            }
        });
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
