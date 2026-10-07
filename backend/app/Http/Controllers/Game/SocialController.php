<?php

namespace App\Http\Controllers\Game;

use App\Http\Controllers\Controller;
use App\Models\GameUser;
use App\Support\GamePeriods;
use App\Support\GameRules;
use App\Support\GameStats;
use App\Support\GameWinners;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Players, follows (one-way, no approval), the leaderboard and period prizes.
 * Points are never reset: the board ranks all-time points or the points of
 * the current year / half / quarter / month, and each ended period crowns its
 * top player(s) (GameWinners).
 * "Hide my progress" is enforced here, not in the app: a hidden player never
 * appears on a board and nobody else sees their points, followers included —
 * but they can still win a period; the prize then shows their name only.
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

    /**
     * GET /v1/users/{username}?month=&today=YYYY-MM-DD ->
     * {user, self, following, followers, followingCount, joined, points, stats, achievements}
     *
     * Everything is computed from stored completions (GameStats). A player who
     * hides their progress shows others only name, follow state and counts:
     * points / stats / achievements are null. `today` is the viewer's local
     * date, so "current streak" follows the phone's clock.
     */
    public function show(Request $request, string $username): JsonResponse
    {
        $me = $this->me($request);
        $u = $this->target($username);
        $month = GameRules::month($request->query('month'), (int) now()->getTimestampMs());
        $today = GameRules::day($request->query('today'));
        $self = $u->id === $me->id;
        $visible = $self || ! $u->hide_progress;
        GameWinners::settle((int) now()->getTimestampMs());

        $stats = null;
        $achievements = null;
        if ($visible) {
            GameStats::award($u->id); // backfills players who synced before achievements existed
            $stats = GameStats::compute($u->id, $today)['stats'];
            $achievements = GameStats::achievements($u->id);
        }

        return response()->json([
            'user' => $u->toPublic(),
            'self' => $self,
            'following' => $self ? false : self::isFollowing($me->id, $u->id),
            'followers' => DB::table('game_follows')->where('followee_id', $u->id)->count(),
            'followingCount' => DB::table('game_follows')->where('follower_id', $u->id)->count(),
            'joined' => $u->created_at ? $u->created_at->format('Y-m') : null,
            'points' => $visible ? self::monthPoints($u->id, $month) : null,
            'stats' => $stats,
            'achievements' => $achievements,
            // Prizes are public (like the winners list), even for hidden players.
            'wins' => GameWinners::of($u->id),
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

    /**
     * GET /v1/leaderboard?period=all|year|half|quarter|month&today=YYYY-MM-DD&scope=all|following
     *   -> {period, periodKey, month, scope, rows, me, winners}
     *
     * period "all" ranks all-time points; the others rank the points earned in
     * the current period, taken from the viewer's local `today`. Older apps
     * send only `month` and get that month, as before. `winners` is the most
     * recently decided period of each type (GameWinners::latest).
     */
    public function leaderboard(Request $request): JsonResponse
    {
        $me = $this->me($request);
        $nowMs = (int) now()->getTimestampMs();
        $scope = $request->query('scope') === 'following' ? 'following' : 'all';
        $asked = $request->query('period');
        $period = in_array($asked, ['all', ...GamePeriods::TYPES], true) ? $asked : 'month';
        if ($asked === null) {
            $key = GameRules::month($request->query('month'), $nowMs); // older apps
        } elseif ($period === 'all') {
            $key = null;
        } else {
            $today = GameRules::day($request->query('today')) ?? gmdate('Y-m-d', intdiv($nowMs, 1000));
            $key = GamePeriods::key($period, $today);
        }
        GameWinners::settle($nowMs);

        $q = DB::table('game_completions as c')
            ->join('game_users as u', 'u.id', '=', 'c.user_id')
            ->where('u.hide_progress', false)
            ->groupBy('u.id', 'u.username', 'u.display_name')
            ->select('u.id', 'u.username', 'u.display_name', DB::raw('SUM(c.points) AS points'))
            ->orderByDesc('points')->orderBy('u.username')->limit(100);
        if ($key !== null) {
            GamePeriods::scope($q, $period, $key, 'c.window_key');
        }
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

        $mine = DB::table('game_completions')->where('user_id', $me->id);
        if ($key !== null) {
            GamePeriods::scope($mine, $period, $key);
        }

        return response()->json([
            'period' => $period,
            'periodKey' => $key,
            'month' => $period === 'month' ? $key : null,
            'scope' => $scope,
            'rows' => $rows,
            'me' => $me->toPublic() + ['points' => (int) $mine->sum('points')],
            'winners' => GameWinners::latest(),
        ]);
    }
}
