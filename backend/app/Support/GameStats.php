<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * A player's real statistics and achievements, derived only from what the
 * server stored (game_completions) — never from numbers the app sends.
 *
 * Dates are the window's own date ("2026-09-25" in "2026-09-25:Dhuhr"), i.e.
 * the player's local day, so streaks follow their clock, not the server's.
 *
 * Achievements are awarded idempotently: award() inserts with insertOrIgnore
 * on the (user, achievement) primary key, and each one's earned_at is the
 * finish time of the completion that earned it. Re-running it over the same
 * data — a resent sync, an account merge — adds nothing and changes nothing.
 */
final class GameStats
{
    /**
     * Tasks per prayer window. Mirrors WINDOW_TASKS in core/data/game-tasks.js
     * (tools/test/game.js checks they match). A window counts as completed when
     * all its tasks are stored — or its gift is, since the gift opens only then.
     */
    public const WINDOW_TASK_COUNT = ['Fajr' => 11, 'Dhuhr' => 9, 'Asr' => 10, 'Maghrib' => 10, 'Isha' => 9];

    /** Achievement ids in display order (the app names them: game-i18n.js `ach`). */
    public const ACHIEVEMENTS = [
        'first-task', 'first-window', 'first-gift', 'full-day',
        'streak-3', 'streak-7', 'streak-30',
        'tasks-100', 'tasks-1000', 'points-1000', 'points-10000',
    ];

    private const STREAKS = ['streak-3' => 3, 'streak-7' => 7, 'streak-30' => 30];
    private const TASK_MILESTONES = ['tasks-100' => 100, 'tasks-1000' => 1000];
    private const POINT_MILESTONES = ['points-1000' => 1000, 'points-10000' => 10000];

    /**
     * @return array{stats: array<string,int|string|null>, earned: array<string,int>}
     *         earned = achievement id => earned_at (ms), in the order earned
     */
    public static function compute(int $userId, ?string $today = null): array
    {
        $rows = DB::table('game_completions')->where('user_id', $userId)
            ->orderBy('done_at')->orderBy('window_key')->orderBy('item_id')
            ->get(['window_key', 'kind', 'points', 'done_at']);

        $earned = [];
        $award = function (string $id, int $at) use (&$earned) {
            $earned[$id] ??= $at;
        };

        $points = 0;
        $tasks = 0;
        $gifts = 0;
        $windowTasks = [];   // window key => task rows so far
        $completeAt = [];    // window key => when it became complete
        $dayFirst = [];      // date => first finish time that day (active day)
        foreach ($rows as $r) {
            $at = (int) $r->done_at;
            $key = $r->window_key;
            $day = substr($key, 0, 10);
            $prayer = substr($key, 11);
            $points += (int) $r->points;
            $dayFirst[$day] ??= $at;

            if ($r->kind === 'gift') {
                $gifts++;
                $award('first-gift', $at);
                $completeAt[$key] ??= $at;
            } else {
                $tasks++;
                $award('first-task', $at);
                $windowTasks[$key] = ($windowTasks[$key] ?? 0) + 1;
                if ($windowTasks[$key] >= (self::WINDOW_TASK_COUNT[$prayer] ?? PHP_INT_MAX)) {
                    $completeAt[$key] ??= $at;
                }
            }
            if (isset($completeAt[$key])) {
                $award('first-window', $completeAt[$key]);
            }
            foreach (self::TASK_MILESTONES as $id => $n) {
                if ($tasks >= $n) {
                    $award($id, $at);
                }
            }
            foreach (self::POINT_MILESTONES as $id => $n) {
                if ($points >= $n) {
                    $award($id, $at);
                }
            }
        }

        // Full days: all five windows of a date completed.
        $perDay = [];
        foreach ($completeAt as $key => $at) {
            $day = substr($key, 0, 10);
            $perDay[$day][] = $at;
        }
        $fullDays = 0;
        $fullDayAt = null;
        foreach ($perDay as $ats) {
            if (count($ats) === count(self::WINDOW_TASK_COUNT)) {
                $fullDays++;
                $fullDayAt = min($fullDayAt ?? PHP_INT_MAX, max($ats));
            }
        }
        if ($fullDayAt !== null) {
            $award('full-day', $fullDayAt);
        }

        // Streaks of consecutive active days (at least one finished item).
        ksort($dayFirst);
        $best = 0;
        $run = 0;
        $prev = null;
        foreach ($dayFirst as $day => $at) {
            $run = $prev !== null && self::nextDay($prev) === $day ? $run + 1 : 1;
            $best = max($best, $run);
            foreach (self::STREAKS as $id => $n) {
                if ($run >= $n) {
                    $award($id, $at);
                }
            }
            $prev = $day;
        }
        // The current streak counts only if it reaches today or yesterday.
        $today ??= gmdate('Y-m-d');
        $current = $prev !== null && ($prev === $today || self::nextDay($prev) === $today) ? $run : 0;

        asort($earned);

        return [
            'stats' => [
                'totalPoints' => $points,
                'tasks' => $tasks,
                'gifts' => $gifts,
                'windows' => count($completeAt),
                'fullDays' => $fullDays,
                'activeDays' => count($dayFirst),
                'currentStreak' => $current,
                'bestStreak' => $best,
                'lastActive' => $prev,
            ],
            'earned' => $earned,
        ];
    }

    /**
     * Store every achievement the data earns and return the ids that are new
     * in this call (for the app's one-time "achievement unlocked" note).
     *
     * @return list<string>
     */
    public static function award(int $userId): array
    {
        $earned = self::compute($userId)['earned'];
        $have = DB::table('game_achievements')->where('user_id', $userId)->pluck('achievement_id')->all();
        $fresh = array_diff_key($earned, array_flip($have));
        if (! $fresh) {
            return [];
        }
        DB::table('game_achievements')->insertOrIgnore(array_map(
            fn ($id, $at) => ['user_id' => $userId, 'achievement_id' => $id, 'earned_at' => $at],
            array_keys($fresh), array_values($fresh),
        ));

        return array_keys($fresh);
    }

    /**
     * Replace the stored achievements with exactly what the data earns. For an
     * account merge, where the merged completions can date an achievement the
     * target already had EARLIER (award() would keep the old, later date).
     */
    public static function rebuild(int $userId): void
    {
        DB::transaction(function () use ($userId) {
            DB::table('game_achievements')->where('user_id', $userId)->delete();
            self::award($userId);
        });
    }

    /** @return list<array{id:string, earnedAt:int}> in the order earned */
    public static function achievements(int $userId): array
    {
        return DB::table('game_achievements')->where('user_id', $userId)
            ->orderBy('earned_at')->orderBy('achievement_id')->get()
            ->map(fn ($a) => ['id' => $a->achievement_id, 'earnedAt' => (int) $a->earned_at])->all();
    }

    /** "YYYY-MM-DD" -> the next calendar day (UTC arithmetic on a plain date). */
    private static function nextDay(string $day): string
    {
        return gmdate('Y-m-d', strtotime($day.' 00:00:00 UTC') + 86400);
    }
}
