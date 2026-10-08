<?php

namespace App\Support;

use App\Models\GameUser;
use Illuminate\Support\Facades\DB;

/**
 * Family rules shared by FamilyController and account deletion.
 *
 * - A player is in at most one family, as a parent or a child.
 * - Joining always needs the invitee's acceptance.
 * - Children can't leave; a parent removes them. Parents leave on their own
 *   (one parent can't remove another). When the last parent leaves — or
 *   their account is deleted — the family is dissolved.
 */
final class GameFamilies
{
    public const ROLES = ['parent', 'child'];

    public const NOTIFY = ['off', 'window', 'daily'];

    public const MAX_MEMBERS = 20;

    /** The player's membership {family_id, role, notify}, or null. */
    public static function membership(int $userId): ?object
    {
        return DB::table('game_family_members')->where('user_id', $userId)->first(['family_id', 'role', 'notify']);
    }

    /** Dissolve the family if no parent is left in it. */
    public static function dissolveIfOrphaned(int $familyId): void
    {
        if (! DB::table('game_family_members')->where('family_id', $familyId)->where('role', 'parent')->exists()) {
            DB::table('game_family_invites')->where('family_id', $familyId)->delete();
            DB::table('game_family_members')->where('family_id', $familyId)->delete();
            DB::table('game_families')->where('id', $familyId)->delete();
        }
    }

    /** Take a player out of any family and invitation (account deletion). */
    public static function forget(GameUser $user): void
    {
        $m = self::membership($user->id);
        DB::table('game_family_invites')->where('user_id', $user->id)->orWhere('invited_by', $user->id)->delete();
        DB::table('game_family_members')->where('user_id', $user->id)->delete();
        if ($m) {
            self::dissolveIfOrphaned((int) $m->family_id);
        }
    }

    /**
     * How far each player got in each of the given windows:
     * [userId => [windowKey => {done, total, complete}]].
     */
    public static function windows(array $userIds, array $keys): array
    {
        $out = [];
        foreach ($userIds as $id) {
            foreach ($keys as $k) {
                $out[$id][$k] = ['done' => 0, 'total' => GameStats::WINDOW_TASK_COUNT[substr($k, 11)] ?? 0, 'complete' => false];
            }
        }
        if (! $userIds || ! $keys) {
            return $out;
        }
        $rows = DB::table('game_completions')->whereIn('user_id', $userIds)->whereIn('window_key', $keys)
            ->groupBy('user_id', 'window_key', 'kind')
            ->select('user_id', 'window_key', 'kind', DB::raw('COUNT(*) AS n'))->get();
        foreach ($rows as $r) {
            $w = &$out[$r->user_id][$r->window_key];
            if ($r->kind === 'gift') {
                $w['complete'] = true; // older apps: the gift opened only once every task was done
            } else {
                $w['done'] = (int) $r->n;
            }
            $w['complete'] = $w['complete'] || ($w['total'] > 0 && $w['done'] >= $w['total']);
            unset($w);
        }

        return $out;
    }

    /**
     * A player's year, day by day: {days: {date: {windows, points}}, months: [12 x points],
     * points, windows, activeDays}. "windows" counts completed prayer windows (0–5 a day).
     */
    public static function year(int $userId, int $year): array
    {
        $rows = DB::table('game_completions')->where('user_id', $userId)
            ->where('window_key', '>=', sprintf('%04d-01-01', $year))
            ->where('window_key', '<', sprintf('%04d-01-01', $year + 1))
            ->groupBy('window_key', 'kind')
            ->select('window_key', 'kind', DB::raw('COUNT(*) AS n'), DB::raw('SUM(points) AS points'))->get();

        $windows = [];
        $days = [];
        $months = array_fill(0, 12, 0);
        foreach ($rows as $r) {
            $day = substr($r->window_key, 0, 10);
            $days[$day] ??= ['windows' => 0, 'points' => 0];
            $days[$day]['points'] += (int) $r->points;
            $months[(int) substr($day, 5, 2) - 1] += (int) $r->points;
            $w = &$windows[$r->window_key];
            $w ??= ['done' => 0, 'gift' => false];
            if ($r->kind === 'gift') {
                $w['gift'] = true;
            } else {
                $w['done'] += (int) $r->n;
            }
            unset($w);
        }
        $complete = 0;
        foreach ($windows as $key => $w) {
            $total = GameStats::WINDOW_TASK_COUNT[substr($key, 11)] ?? PHP_INT_MAX;
            if ($w['gift'] || $w['done'] >= $total) {
                $days[substr($key, 0, 10)]['windows']++;
                $complete++;
            }
        }
        ksort($days);

        return [
            'year' => $year,
            'days' => $days,
            'months' => $months,
            'points' => array_sum($months),
            'windows' => $complete,
            'activeDays' => count($days),
        ];
    }
}
