<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Real sign-in for the game: email + password or a Google account, replacing
 * the name-only registration. The public `username` stays as the player's
 * handle on the leaderboard; it is never a login credential.
 *
 * - game_users: email (stored lowercase), password (bcrypt via Hash::make),
 *   google_sub (Google's stable account id). All nullable: a player has
 *   email+password, Google, or both. Legacy name-only rows have neither until
 *   the app links them.
 * - game_tokens: one bearer token per signed-in device (SHA-256 only), so
 *   signing in on a second phone doesn't sign the first one out, and
 *   signing out revokes just that device. Existing tokens are carried over.
 * - game_password_resets: a short emailed code (hashed), with an attempt cap.
 *
 * Every step checks what is already there, so a run that stopped half way
 * can simply be run again. On SQLite the old token column is removed by
 * rebuilding the table in plain SQL: the production host runs SQLite 3.7.17,
 * too old for Laravel's own column drop (it needs pragma_table_xinfo, 3.26+).
 * Hence no wrapping transaction: foreign keys must be switched off outside one.
 */
return new class extends Migration
{
    public $withinTransaction = false;

    public function up(): void
    {
        if (! in_array('email', $this->columns('game_users'), true)) {
            Schema::table('game_users', function (Blueprint $t) {
                $t->string('email', 191)->nullable()->unique();
                $t->string('password')->nullable();
                $t->string('google_sub', 64)->nullable()->unique();
            });
        }

        if (! $this->hasTable('game_tokens')) {
            Schema::create('game_tokens', function (Blueprint $t) {
                $t->id();
                $t->foreignId('user_id')->constrained('game_users')->cascadeOnDelete();
                $t->char('token_hash', 64)->unique();
                $t->timestamp('last_used_at')->nullable();
                $t->timestamps();
            });
        }

        if (! $this->hasTable('game_password_resets')) {
            Schema::create('game_password_resets', function (Blueprint $t) {
                $t->string('email', 191)->primary();
                $t->string('code_hash');
                $t->unsignedTinyInteger('attempts')->default(0);
                $t->timestamp('expires_at');
            });
        }

        if (in_array('token_hash', $this->columns('game_users'), true)) {
            // Carry every existing session over, so no tester is signed out.
            $now = now();
            foreach (DB::table('game_users')->whereNotNull('token_hash')->get(['id', 'token_hash']) as $u) {
                DB::table('game_tokens')->insertOrIgnore([
                    'user_id' => $u->id, 'token_hash' => $u->token_hash, 'created_at' => $now, 'updated_at' => $now,
                ]);
            }
            $this->dropUserTokenColumn();
        }
    }

    public function down(): void
    {
        if (! in_array('token_hash', $this->columns('game_users'), true)) {
            Schema::table('game_users', function (Blueprint $t) {
                $t->char('token_hash', 64)->nullable()->unique();
            });
            foreach (DB::table('game_tokens')->orderBy('id')->get() as $tok) {
                DB::table('game_users')->where('id', $tok->user_id)->update(['token_hash' => $tok->token_hash]);
            }
        }
        Schema::dropIfExists('game_password_resets');
        Schema::dropIfExists('game_tokens');
        // email / password / google_sub are left in place: dropping them needs
        // the same SQLite rebuild, and they are harmless to the old code.
    }

    private function dropUserTokenColumn(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            Schema::table('game_users', function (Blueprint $t) {
                $t->dropUnique(['token_hash']);
                $t->dropColumn('token_hash');
            });

            return;
        }

        $keep = array_values(array_diff($this->columns('game_users'), ['token_hash']));
        $cols = implode(', ', array_map(fn ($c) => '"'.$c.'"', $keep));
        DB::statement('PRAGMA foreign_keys = OFF');
        try {
            DB::transaction(function () use ($cols) {
                DB::statement('CREATE TABLE "game_users__new" ('
                    .'"id" integer primary key autoincrement not null, '
                    .'"username" varchar not null, "username_lower" varchar not null, '
                    .'"display_name" varchar, "hide_progress" tinyint(1) not null default \'0\', '
                    .'"created_at" datetime, "updated_at" datetime, '
                    .'"email" varchar, "password" varchar, "google_sub" varchar)');
                DB::statement("INSERT INTO \"game_users__new\" ($cols) SELECT $cols FROM \"game_users\"");
                DB::statement('DROP TABLE "game_users"');
                DB::statement('ALTER TABLE "game_users__new" RENAME TO "game_users"');
                DB::statement('CREATE UNIQUE INDEX "game_users_username_lower_unique" ON "game_users" ("username_lower")');
                DB::statement('CREATE UNIQUE INDEX "game_users_email_unique" ON "game_users" ("email")');
                DB::statement('CREATE UNIQUE INDEX "game_users_google_sub_unique" ON "game_users" ("google_sub")');
            });
        } finally {
            DB::statement('PRAGMA foreign_keys = ON');
        }
    }

    /** Column names, via PRAGMA table_info on SQLite (works on 3.7). */
    private function columns(string $table): array
    {
        if (DB::getDriverName() === 'sqlite') {
            return array_map(fn ($c) => $c->name, DB::select('PRAGMA table_info("'.$table.'")'));
        }

        return Schema::getColumnListing($table);
    }

    private function hasTable(string $table): bool
    {
        if (DB::getDriverName() === 'sqlite') {
            return (bool) DB::selectOne("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = ?", [$table]);
        }

        return Schema::hasTable($table);
    }
};
