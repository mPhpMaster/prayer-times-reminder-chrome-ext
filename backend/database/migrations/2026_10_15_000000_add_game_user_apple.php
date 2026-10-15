<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Sign in with Apple (App\Support\AppleIdToken):
 * - apple_sub: Apple's stable user id for our team, unique like google_sub.
 * - apple_refresh_token: encrypted {client id, refresh token}, kept only so
 *   the token can be revoked with Apple when the player unlinks Apple or
 *   deletes the account (App Store rule). Null when the server has no Apple
 *   key configured.
 *
 * Plain nullable ADD COLUMNs plus a separate CREATE UNIQUE INDEX, each checked
 * first, so it runs on the production SQLite 3.7 and can simply be run again.
 */
return new class extends Migration
{
    public function up(): void
    {
        $have = $this->columns();
        Schema::table('game_users', function (Blueprint $t) use ($have) {
            if (! in_array('apple_sub', $have, true)) {
                $t->string('apple_sub', 64)->nullable();
            }
            if (! in_array('apple_refresh_token', $have, true)) {
                $t->text('apple_refresh_token')->nullable();
            }
        });
        if (! $this->hasIndex('game_users_apple_sub_unique')) {
            Schema::table('game_users', function (Blueprint $t) {
                $t->unique('apple_sub');
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

    private function hasIndex(string $name): bool
    {
        if (DB::getDriverName() === 'sqlite') {
            return (bool) DB::selectOne("SELECT 1 AS x FROM sqlite_master WHERE type = 'index' AND name = ?", [$name]);
        }

        return in_array($name, array_column(Schema::getIndexes('game_users'), 'name'), true);
    }
};
