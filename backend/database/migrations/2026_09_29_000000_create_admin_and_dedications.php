<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Admins and the About page's dedication (sadaqah jariyah) names.
 *
 * - game_users.email_verified_at: set when the email is proven — Google sign-in
 *   (Google verifies it), an emailed verification code, or a password reset
 *   code. Admin rights follow a *verified* email only (App\Support\GameAdmins).
 *   Google accounts are backfilled as verified.
 * - game_admins: emails granted admin by another admin. The super admin
 *   (config game.super_admin) is not stored here and can't be removed.
 * - game_email_verifications: one short emailed code per player (hashed).
 * - dedications: the approved names, each `names` a JSON map lang => text,
 *   seeded with the names that used to be hard-coded in core/ui/about.js.
 * - dedication_requests: names players ask to add; an admin approves (maybe
 *   after editing), rejects, or edits them. The player sees the status.
 * - game_admin_log: every admin action, for accountability.
 *
 * Like the earlier migrations, every step checks what is already there, so a
 * run that stopped half way can be run again on the production SQLite 3.7.
 */
return new class extends Migration
{
    public $withinTransaction = false;

    private const SEED = [
        ['ar' => 'ام بلال - باشية حجازي', 'en' => 'Umm Bilal – Bashiyah Hijazi'],
        ['ar' => 'عبدالله الشرمي', 'en' => 'Abdullah al-Sharmi'],
        ['ar' => 'ام عبدو صراميجو', 'en' => 'Umm Abdo Sarameejo'],
        ['ar' => 'أم فجر جونيرتي', 'en' => 'Umm Fajar Juniarti'],
        ['ar' => 'سوهيرمان', 'en' => 'Suherman'],
    ];

    public function up(): void
    {
        if (! in_array('email_verified_at', $this->columns('game_users'), true)) {
            Schema::table('game_users', function (Blueprint $t) {
                $t->timestamp('email_verified_at')->nullable();
            });
            DB::table('game_users')->whereNotNull('google_sub')->whereNotNull('email')
                ->update(['email_verified_at' => now()]);
        }

        if (! $this->hasTable('game_admins')) {
            Schema::create('game_admins', function (Blueprint $t) {
                $t->string('email', 191)->primary();
                $t->string('added_by', 191)->nullable();
                $t->timestamp('created_at')->nullable();
            });
        }

        if (! $this->hasTable('game_email_verifications')) {
            Schema::create('game_email_verifications', function (Blueprint $t) {
                $t->unsignedBigInteger('user_id')->primary();
                $t->string('email', 191);
                $t->string('code_hash');
                $t->unsignedTinyInteger('attempts')->default(0);
                $t->timestamp('expires_at');
            });
        }

        if (! $this->hasTable('dedications')) {
            Schema::create('dedications', function (Blueprint $t) {
                $t->id();
                $t->text('names'); // JSON {lang: text}
                $t->integer('sort_order')->default(0);
                $t->boolean('hidden')->default(false);
                $t->unsignedBigInteger('request_id')->nullable();
                $t->timestamps();
            });
            $now = now();
            foreach (self::SEED as $i => $names) {
                DB::table('dedications')->insert([
                    'names' => json_encode($names, JSON_UNESCAPED_UNICODE),
                    'sort_order' => ($i + 1) * 10,
                    'hidden' => false,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }

        if (! $this->hasTable('dedication_requests')) {
            Schema::create('dedication_requests', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('user_id')->nullable()->index();
                $t->text('names'); // JSON {lang: text}, as the player sent it
                $t->string('note', 300)->nullable();
                $t->string('status', 10)->default('pending')->index(); // pending | approved | rejected
                $t->string('reason', 300)->nullable(); // shown to the player when rejected
                $t->unsignedBigInteger('dedication_id')->nullable();
                $t->string('reviewed_by', 191)->nullable();
                $t->timestamp('reviewed_at')->nullable();
                $t->timestamps();
            });
        }

        if (! $this->hasTable('game_admin_log')) {
            Schema::create('game_admin_log', function (Blueprint $t) {
                $t->id();
                $t->string('admin_email', 191);
                $t->string('action', 40);
                $t->string('target', 191)->nullable();
                $t->text('details')->nullable();
                $t->timestamp('created_at')->nullable()->index();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('game_admin_log');
        Schema::dropIfExists('dedication_requests');
        Schema::dropIfExists('dedications');
        Schema::dropIfExists('game_email_verifications');
        Schema::dropIfExists('game_admins');
        if (in_array('email_verified_at', $this->columns('game_users'), true)) {
            Schema::table('game_users', function (Blueprint $t) {
                $t->dropColumn('email_verified_at');
            });
        }
    }

    /** Column names; PRAGMA table_info on SQLite (Laravel's own listing needs 3.26+). */
    private function columns(string $table): array
    {
        if (DB::getDriverName() === 'sqlite') {
            return array_map(fn ($c) => $c->name, DB::select('PRAGMA table_info("'.$table.'")'));
        }

        return Schema::getColumnListing($table);
    }

    private function hasTable(string $name): bool
    {
        return DB::getDriverName() === 'sqlite'
            ? (bool) DB::selectOne("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = ?", [$name])
            : Schema::hasTable($name);
    }
};
