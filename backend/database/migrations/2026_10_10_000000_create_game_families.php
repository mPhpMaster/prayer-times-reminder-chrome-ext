<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Families (App\Http\Controllers\Game\FamilyController): parents follow
 * their children's adhkar — a whole year of it — and can be alerted when a
 * child leaves a prayer's tasks unfinished.
 *
 * game_families        one row per family.
 * game_family_members  one row per member (a player is in at most one
 *                      family): role parent|child; notify (parents) is
 *                      off|window|daily.
 * game_family_invites  pending invitations; joining needs the invitee's yes.
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
        if (! $this->exists('game_families')) {
            Schema::create('game_families', function (Blueprint $t) {
                $t->id();
                $t->timestamp('created_at')->nullable();
            });
        }

        if (! $this->exists('game_family_members')) {
            Schema::create('game_family_members', function (Blueprint $t) {
                $t->foreignId('user_id')->primary()->constrained('game_users')->cascadeOnDelete();
                $t->foreignId('family_id')->index()->constrained('game_families')->cascadeOnDelete();
                $t->string('role', 8);                    // parent | child
                $t->string('notify', 8)->default('window'); // parents: off | window | daily
                $t->timestamp('created_at')->nullable();
            });
        }

        if (! $this->exists('game_family_invites')) {
            Schema::create('game_family_invites', function (Blueprint $t) {
                $t->id();
                $t->foreignId('family_id')->constrained('game_families')->cascadeOnDelete();
                $t->foreignId('user_id')->index()->constrained('game_users')->cascadeOnDelete(); // the invitee
                $t->string('role', 8);
                $t->foreignId('invited_by')->constrained('game_users')->cascadeOnDelete();
                $t->timestamp('created_at')->nullable();
                $t->unique(['family_id', 'user_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('game_family_invites');
        Schema::dropIfExists('game_family_members');
        Schema::dropIfExists('game_families');
    }
};
