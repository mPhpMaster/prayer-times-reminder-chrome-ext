<?php

namespace App\Http\Controllers\Game;

use App\Http\Controllers\Controller;
use App\Models\GameUser;
use App\Support\GameRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Players, follows (one-way, no approval) and the monthly leaderboard.
 * "Hide my progress" is enforced here, not in the app: a hidden player never
 * appears on a board and nobody else sees their points, followers included.
 */
class SocialController extends Controller
{
    private function me(Request $request): GameUser
    {
        return $request->attributes->get('gameUser');
    }

    private function target(string $username): GameUser
    {
        return GameUser::findByUsername($username) ?? GameRules::fail(404, 'no-such-user');
    }

    private static function monthPoints(int $userId, string $month): int
    {
        return (int) DB::table('game_completions')->where('user_id', $userId)
            ->where('window_key', 'like', $month.'%')->sum('points');
    }

    private static function isFollowing(int $a, int $b): bool
    {
        return DB::table('game_follows')->where('follower_id', $a)->where('followee_id', $b)->exists();
    }

    /** GET /v1/users?q= — prefix search, at least 2 characters. */
    public function search(Request $request): JsonResponse
    {
        $q = mb_strtolower(mb_substr(trim((string) $request->query('q')), 0, 20));
        if (mb_strlen($q) < 2) {
            return response()->json(['users' => []]);
        }
        // No LIKE escaping: SQLite has no default escape char, and a stray "_"
        // wildcard only widens a prefix search slightly.
        $users = GameUser::where('username_lower', 'like', $q.'%')->orderBy('username')->limit(20)->get();

        return response()->json(['users' => $users->map->toPublic()]);
    }

    /** GET /v1/users/{username}?month= -> {user, points|null, following} */
    public function show(Request $request, string $username): JsonResponse
    {
        $me = $this->me($request);
        $u = $this->target($username);
        $month = GameRules::month($request->query('month'), (int) now()->getTimestampMs());
        $self = $u->id === $me->id;

        return response()->json([
            'user' => $u->toPublic(),
            'points' => $self || ! $u->hide_progress ? self::monthPoints($u->id, $month) : null,
            'following' => $self ? false : self::isFollowing($me->id, $u->id),
        ]);
    }

    /** PUT /v1/follows/{username} */
    public function follow(Request $request, string $username): JsonResponse
    {
        $me = $this->me($request);
        $u = $this->target($username);
        if ($u->id === $me->id) {
            GameRules::fail(400, 'cannot-follow-self');
        }
        DB::table('game_follows')->insertOrIgnore([
            'follower_id' => $me->id, 'followee_id' => $u->id, 'created_at' => now(),
        ]);

        return response()->json(['ok' => true]);
    }

    /** DELETE /v1/follows/{username} */
    public function unfollow(Request $request, string $username): JsonResponse
    {
        $me = $this->me($request);
        $u = $this->target($username);
        DB::table('game_follows')->where('follower_id', $me->id)->where('followee_id', $u->id)->delete();

        return response()->json(['ok' => true]);
    }

    /** GET /v1/follows -> the players I follow. */
    public function following(Request $request): JsonResponse
    {
        $users = GameUser::whereIn('id', DB::table('game_follows')->where('follower_id', $this->me($request)->id)->select('followee_id'))
            ->orderBy('username')->get();

        return response()->json(['users' => $users->map->toPublic()]);
    }

    /** GET /v1/leaderboard?month=&scope=all|following -> {month, scope, rows, me} (resets monthly) */
    public function leaderboard(Request $request): JsonResponse
    {
        $me = $this->me($request);
        $month = GameRules::month($request->query('month'), (int) now()->getTimestampMs());
        $scope = $request->query('scope') === 'following' ? 'following' : 'all';

        $q = DB::table('game_completions as c')
            ->join('game_users as u', 'u.id', '=', 'c.user_id')
            ->where('c.window_key', 'like', $month.'%')
            ->where('u.hide_progress', false)
            ->groupBy('u.id', 'u.username', 'u.display_name')
            ->select('u.id', 'u.username', 'u.display_name', DB::raw('SUM(c.points) AS points'))
            ->orderByDesc('points')->orderBy('u.username')->limit(100);
        if ($scope === 'following') {
            $ids = DB::table('game_follows')->where('follower_id', $me->id)->pluck('followee_id')->push($me->id);
            $q->whereIn('c.user_id', $ids);
        }

        $rows = $q->get()->values()->map(fn ($r, $i) => [
            'rank' => $i + 1,
            'username' => $r->username,
            'displayName' => $r->display_name ?: $r->username,
            'hideProgress' => false,
            'points' => (int) $r->points,
        ]);

        return response()->json([
            'month' => $month,
            'scope' => $scope,
            'rows' => $rows,
            'me' => $me->toPublic() + ['points' => self::monthPoints($me->id, $month)],
        ]);
    }
}
