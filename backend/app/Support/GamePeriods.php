<?php

namespace App\Support;

use Illuminate\Database\Query\Builder;

/**
 * Prize periods. Points are kept forever; a period only selects which
 * completions count. Completions carry the player's own local date in
 * window_key ("YYYY-MM-DD:Prayer"), so a period is a range of those date
 * strings, compared as text: [start, end).
 *
 *   month   "2026-10"   quarter "2026-Q4"   half "2026-H2"   year "2026"
 */
final class GamePeriods
{
    public const TYPES = ['month', 'quarter', 'half', 'year'];

    /** Months per period type. */
    private const SPAN = ['month' => 1, 'quarter' => 3, 'half' => 6, 'year' => 12];

    /** The key of the period of `type` containing `day` ("YYYY-MM-DD"). */
    public static function key(string $type, string $day): string
    {
        $y = (int) substr($day, 0, 4);
        $m = (int) substr($day, 5, 2);

        return match ($type) {
            'month' => sprintf('%04d-%02d', $y, $m),
            'quarter' => sprintf('%04d-Q%d', $y, intdiv($m - 1, 3) + 1),
            'half' => sprintf('%04d-H%d', $y, $m <= 6 ? 1 : 2),
            'year' => sprintf('%04d', $y),
        };
    }

    /** [first month 1..12, year] of a period key. */
    private static function firstMonth(string $type, string $key): array
    {
        $y = (int) substr($key, 0, 4);
        $m = match ($type) {
            'month' => (int) substr($key, 5, 2),
            'quarter' => ((int) substr($key, 6, 1) - 1) * 3 + 1,
            'half' => substr($key, 6, 1) === '1' ? 1 : 7,
            'year' => 1,
        };

        return [$m, $y];
    }

    /** ["YYYY-MM-01" start, "YYYY-MM-01" end-exclusive] of a period. */
    public static function range(string $type, string $key): array
    {
        [$m, $y] = self::firstMonth($type, $key);
        $start = sprintf('%04d-%02d-01', $y, $m);
        $endM = $m + self::SPAN[$type];
        $end = sprintf('%04d-%02d-01', $y + intdiv($endM - 1, 12), ($endM - 1) % 12 + 1);

        return [$start, $end];
    }

    /** The period right after `key`. */
    public static function next(string $type, string $key): string
    {
        return self::key($type, self::range($type, $key)[1]);
    }

    /** The period right before `key`. */
    public static function previous(string $type, string $key): string
    {
        [$start] = self::range($type, $key);
        $y = (int) substr($start, 0, 4);
        $m = (int) substr($start, 5, 2) - 1;
        if ($m === 0) {
            [$y, $m] = [$y - 1, 12];
        }

        return self::key($type, sprintf('%04d-%02d-01', $y, $m));
    }

    /** Restrict a completions query (column `window_key`, optionally aliased) to a period. */
    public static function scope(Builder $q, string $type, string $key, string $column = 'window_key'): Builder
    {
        [$start, $end] = self::range($type, $key);

        return $q->where($column, '>=', $start)->where($column, '<', $end);
    }
}
