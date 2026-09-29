<?php

namespace App\Http\Middleware;

use App\Support\GameAdmins;
use App\Support\GameRules;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Admin-only endpoints. Runs after GameAuth; the decision is made here on the
 * server for every request — the app's admin screen is only a view.
 */
class GameAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->attributes->get('gameUser');
        if (! $user || ! GameAdmins::isAdmin($user)) {
            GameRules::fail(403, 'not-admin');
        }

        return $next($request);
    }
}
