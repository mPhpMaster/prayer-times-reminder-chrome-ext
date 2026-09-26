<?php

namespace App\Support;

use App\Models\GameUser;
use Illuminate\Support\Facades\DB;

/**
 * Account plumbing shared by the auth endpoints: device tokens, and folding a
 * legacy (name-only) account into a real one without losing or doubling points.
 */
final class GameAccounts
{
    /** A new device token for the user; only its hash is stored. Returned once. */
    public static function issueToken(GameUser $user): string
    {
        $token = bin2hex(random_bytes(32));
        DB::table('game_tokens')->insert([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $token),
            'last_used_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $token;
    }

    public static function revokeAll(GameUser $user): void
    {
        DB::table('game_tokens')->where('user_id', $user->id)->delete();
    }

    /**
     * Move everything of $from into $into, then delete $from. Completions are
     * keyed by (window, item), so an item both accounts finished is kept once
     * (the earlier finish wins) and no points are doubled. Follows are
     * re-pointed; self-follows and duplicates are dropped.
     */
    public static function absorb(GameUser $into, GameUser $from): void
    {
        if ($into->id === $from->id) {
            return;
        }
        DB::transaction(function () use ($into, $from) {
            $mine = DB::table('game_completions')->where('user_id', $into->id)->get()
                ->keyBy(fn ($r) => $r->window_key.'|'.$r->item_id);
            foreach (DB::table('game_completions')->where('user_id', $from->id)->get() as $c) {
                $k = $c->window_key.'|'.$c->item_id;
                $row = ['kind' => $c->kind, 'points' => $c->points, 'started_at' => $c->started_at, 'done_at' => $c->done_at];
                if (! isset($mine[$k])) {
                    DB::table('game_completions')->insert($row + ['user_id' => $into->id, 'window_key' => $c->window_key, 'item_id' => $c->item_id]);
                } elseif ($c->done_at < $mine[$k]->done_at) {
                    DB::table('game_completions')
                        ->where(['user_id' => $into->id, 'window_key' => $c->window_key, 'item_id' => $c->item_id])
                        ->update($row);
                }
            }
            foreach (DB::table('game_follows')->where('follower_id', $from->id)->pluck('followee_id') as $f) {
                if ((int) $f !== $into->id) {
                    DB::table('game_follows')->insertOrIgnore(['follower_id' => $into->id, 'followee_id' => $f, 'created_at' => now()]);
                }
            }
            foreach (DB::table('game_follows')->where('followee_id', $from->id)->pluck('follower_id') as $f) {
                if ((int) $f !== $into->id) {
                    DB::table('game_follows')->insertOrIgnore(['follower_id' => $f, 'followee_id' => $into->id, 'created_at' => now()]);
                }
            }
            self::deleteUser($from);
        });
    }

    /** Delete an account and everything tied to it (explicitly: SQLite may not cascade). */
    public static function deleteUser(GameUser $user): void
    {
        DB::transaction(function () use ($user) {
            DB::table('game_completions')->where('user_id', $user->id)->delete();
            DB::table('game_follows')->where('follower_id', $user->id)->orWhere('followee_id', $user->id)->delete();
            DB::table('game_tokens')->where('user_id', $user->id)->delete();
            if ($user->email) {
                DB::table('game_password_resets')->where('email', $user->email)->delete();
            }
            $user->delete();
        });
    }
}
