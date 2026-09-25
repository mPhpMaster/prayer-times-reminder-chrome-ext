<?php

namespace App\Http\Middleware;

use App\Models\GameUser;
use App\Support\GameRules;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Bearer-token auth for the game API. Tokens are random 256-bit values handed
 * out at registration; only their SHA-256 is stored, so a database leak does
 * not leak usable tokens. The user is available as $request->attributes 'gameUser'.
 */
class GameAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();
        $user = $token && preg_match('/^[a-f0-9]{64}$/', $token)
            ? GameUser::where('token_hash', hash('sha256', $token))->first()
            : null;
        if (! $user) {
            GameRules::fail(401, 'unauthorized');
        }
        $request->attributes->set('gameUser', $user);

        return $next($request);
    }
}
