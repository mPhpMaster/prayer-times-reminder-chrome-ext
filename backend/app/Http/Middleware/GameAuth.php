<?php

namespace App\Http\Middleware;

use App\Models\GameUser;
use App\Support\GameRules;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Bearer-token auth for the game API. Tokens are random 256-bit values, one
 * per signed-in device (game_tokens); only their SHA-256 is stored, so a
 * database leak does not leak usable tokens. Sets the request attributes
 * 'gameUser' and 'gameTokenId' (signing out revokes just that token).
 */
class GameAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $row = self::tokenRow($request->bearerToken());
        $user = $row ? GameUser::find($row->user_id) : null;
        if (! $user) {
            GameRules::fail(401, 'unauthorized');
        }
        if (! $row->last_used_at || now()->diffInMinutes($row->last_used_at, true) >= 60) {
            DB::table('game_tokens')->where('id', $row->id)->update(['last_used_at' => now()]);
        }
        $request->attributes->set('gameUser', $user);
        $request->attributes->set('gameTokenId', $row->id);

        return $next($request);
    }

    /** The user a raw token belongs to, or null (used to link a legacy account). */
    public static function userForToken(mixed $token): ?GameUser
    {
        $row = self::tokenRow($token);

        return $row ? GameUser::find($row->user_id) : null;
    }

    private static function tokenRow(mixed $token): ?object
    {
        if (! is_string($token) || ! preg_match('/^[a-f0-9]{64}$/', $token)) {
            return null;
        }

        return DB::table('game_tokens')->where('token_hash', hash('sha256', $token))->first(['id', 'user_id', 'last_used_at']);
    }
}
