<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Game tables. Portable across MySQL, PostgreSQL (Neon, Supabase) and SQLite:
 * case-insensitive usernames use a stored lowercase column rather than a
 * database-specific collation or functional index.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_users', function (Blueprint $t) {
            $t->id();
            $t->string('username', 20);
            $t->string('username_lower', 20)->unique();
            $t->string('display_name', 40)->nullable();
            $t->boolean('hide_progress')->default(false);
            $t->char('token_hash', 64)->unique(); // SHA-256 of the bearer token
            $t->timestamps();
        });

        Schema::create('game_completions', function (Blueprint $t) {
            $t->foreignId('user_id')->constrained('game_users')->cascadeOnDelete();
            $t->string('window_key', 24);  // "2026-09-25:Dhuhr"
            $t->string('item_id', 64);     // task id or gift id
            $t->string('kind', 8);         // task | gift
            $t->integer('points');
            $t->bigInteger('started_at');  // ms since epoch, from the device
            $t->bigInteger('done_at');
            $t->primary(['user_id', 'window_key', 'item_id']);
            $t->index('window_key');
        });

        Schema::create('game_follows', function (Blueprint $t) {
            $t->foreignId('follower_id')->constrained('game_users')->cascadeOnDelete();
            $t->foreignId('followee_id')->constrained('game_users')->cascadeOnDelete();
            $t->timestamp('created_at')->nullable();
            $t->primary(['follower_id', 'followee_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_follows');
        Schema::dropIfExists('game_completions');
        Schema::dropIfExists('game_users');
    }
};
