<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * Period prizes. After a month / quarter / half-year / year ends, the
 * player(s) with the most points earned inside it win it — every player tied
 * for first is a winner. Players who hide their progress can win too; their
 * points are just never shown.
 *
 * Deciding is lazy: settle() runs on leaderboard / profile requests, so no
 * cron is needed. A period is decided only GRACE_DAYS after it ends (UTC):
 * completions are dated by each player's local calendar, and offline phones
 * sync late. Once decided it is final (game_settled_periods), so a late sync
 * never changes a published winner. The first run also decides every past
 * period back to the first completion.
 */
final class GameWinners
{
    public const GRACE_DAYS = 2;

    /** Upper bound on periods decided by one request (the rest wait for the next). */
    private const MAX_DECISIONS = 60;

    /** Decide every ended, undecided period. Cheap when there is nothing to do. */
    public static function settle(int $nowMs): void
    {
        $first = DB::table('game_completions')->where('window_key', '>=', GameRules::LAUNCH_DAY)->min('window_key');
        if ($first === null) {
            return;
        }
        $firstDay = substr($first, 0, 10);
        $budget = self::MAX_DECISIONS;
        $cutoff = gmdate('Y-m-d', intdiv($nowMs, 1000) - self::GRACE_DAYS * 86400);

        foreach (GamePeriods::TYPES as $type) {
            $settled = DB::table('game_settled_periods')->where('period_type', $type)
                ->pluck('period_key')->flip();
            for ($key = GamePeriods::key($type, $firstDay); ; $key = GamePeriods::next($type, $key)) {
                [, $end] = GamePeriods::range($type, $key);
                if ($end > $cutoff) {
                    break; // not ended long enough ago (or not ended at all)
                }
                if (! isset($settled[$key])) {
                    if ($budget-- <= 0) {
                        return;
                    }
                    self::decide($type, $key, $nowMs);
                }
            }
        }
    }

    private static function decide(string $type, string $key, int $nowMs): void
    {
        DB::transaction(function () use ($type, $key, $nowMs) {
            [$start] = GamePeriods::range($type, $key);
            $totals = GamePeriods::scope(DB::table('game_completions'), $type, $key)
                ->where('window_key', '>=', max($start, GameRules::LAUNCH_DAY))
                ->groupBy('user_id')
                ->select('user_id', DB::raw('SUM(points) AS points'))
                ->get();
            $best = (int) $totals->max('points');
            if ($best > 0) {
                foreach ($totals->where('points', $best) as $t) {
                    DB::table('game_period_winners')->insertOrIgnore([
                        'period_type' => $type, 'period_key' => $key, 'user_id' => $t->user_id,
                        'points' => $best, 'decided_at' => $nowMs,
                    ]);
                }
            }
            DB::table('game_settled_periods')->insertOrIgnore([
                'period_type' => $type, 'period_key' => $key, 'settled_at' => $nowMs,
            ]);
        });
    }

    /**
     * The most recently decided period of each type and its winners:
     * {month: {key, winners: [{username, displayName, hideProgress, points|null}]}|null, quarter, half, year}
     */
    public static function latest(): array
    {
        $out = [];
        foreach (GamePeriods::TYPES as $type) {
            $key = DB::table('game_settled_periods')->where('period_type', $type)->max('period_key');
            $out[$type] = $key === null ? null : ['key' => $key, 'winners' => self::winnersOf($type, $key)];
        }

        return $out;
    }

    private static function winnersOf(string $type, string $key): array
    {
        return DB::table('game_period_winners as w')
            ->join('game_users as u', 'u.id', '=', 'w.user_id')
            ->where('w.period_type', $type)->where('w.period_key', $key)
            ->orderBy('u.username')
            ->get(['u.username', 'u.display_name', 'u.hide_progress', 'w.points'])
            ->map(fn ($r) => [
                'username' => $r->username,
                'displayName' => $r->display_name ?: $r->username,
                'hideProgress' => (bool) $r->hide_progress,
                'points' => $r->hide_progress ? null : (int) $r->points,
            ])->all();
    }

    /**
     * A player's prizes: {month: n, quarter: n, half: n, year: n, total: n,
     * lastMonth: bool} — lastMonth is "won the most recently decided month".
     */
    public static function of(int $userId): array
    {
        $counts = DB::table('game_period_winners')->where('user_id', $userId)
            ->groupBy('period_type')->select('period_type', DB::raw('COUNT(*) AS n'))
            ->pluck('n', 'period_type');
        $out = [];
        foreach (GamePeriods::TYPES as $type) {
            $out[$type] = (int) ($counts[$type] ?? 0);
        }
        $out['total'] = array_sum($out);
        $lastMonth = DB::table('game_settled_periods')->where('period_type', 'month')->max('period_key');
        $out['lastMonth'] = $lastMonth !== null && DB::table('game_period_winners')
            ->where('period_type', 'month')->where('period_key', $lastMonth)->where('user_id', $userId)->exists();

        return $out;
    }
}
