<?php

namespace App\Support;

use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * Validation shared by the game endpoints. Point caps mirror the app's
 * core/logic/game-score.js (WINDOW_POINTS, GIFT_POINTS) — keep them in step.
 */
final class GameRules
{
    public const WINDOW_POINTS = 300;
    public const GIFT_POINTS = 100;
    public const MAX_WINDOW_TOTAL = self::WINDOW_POINTS + self::GIFT_POINTS;

    private const USERNAME = '/^[\p{L}\p{N}_]{3,20}$/u'; // any script, digits, underscore
    private const WINDOW_KEY = '/^\d{4}-\d{2}-\d{2}:(Fajr|Dhuhr|Asr|Maghrib|Isha)$/';
    private const ITEM_ID = '/^[a-z0-9-]{1,64}$/';
    private const MONTH = '/^\d{4}-\d{2}$/';

    /** The API's error shape: {"error": "code"}. */
    public static function fail(int $status, string $code): never
    {
        throw new HttpResponseException(response()->json(['error' => $code], $status));
    }

    public static function username(mixed $raw): ?string
    {
        $u = trim((string) $raw);
        if (class_exists(\Normalizer::class)) {
            $u = \Normalizer::normalize($u, \Normalizer::FORM_C) ?: $u;
        }

        return preg_match(self::USERNAME, $u) ? $u : null;
    }

    public static function month(?string $m, int $nowMs): string
    {
        $m ??= gmdate('Y-m', intdiv($nowMs, 1000));
        if (! preg_match(self::MONTH, $m)) {
            self::fail(400, 'bad-month');
        }

        return $m;
    }

    /**
     * Completed items from the client: {windowKey, itemId, kind, points,
     * startedAt, doneAt}. Invalid rows are dropped, not fatal — the app keeps
     * its local copy either way. Per-window totals are capped in the request.
     *
     * @return list<array{windowKey:string,itemId:string,kind:string,points:int,startedAt:int,doneAt:int}>
     */
    public static function completions(mixed $rows, int $nowMs): array
    {
        $out = [];
        $perWindow = [];
        $future = $nowMs + 5 * 60 * 1000; // clock-skew allowance
        foreach (array_slice(is_array($rows) ? $rows : [], 0, 500) as $r) {
            if (! is_array($r)) {
                continue;
            }
            $key = (string) ($r['windowKey'] ?? '');
            $item = (string) ($r['itemId'] ?? '');
            if (! preg_match(self::WINDOW_KEY, $key) || ! preg_match(self::ITEM_ID, $item)) {
                continue;
            }
            $kind = ($r['kind'] ?? '') === 'gift' ? 'gift' : 'task';
            $cap = $kind === 'gift' ? self::GIFT_POINTS : self::WINDOW_POINTS;
            if (! is_numeric($r['points'] ?? null) || ! is_numeric($r['doneAt'] ?? null)) {
                continue;
            }
            $points = (int) round((float) $r['points']);
            $doneAt = (int) $r['doneAt'];
            $startedAt = is_numeric($r['startedAt'] ?? null) ? (int) $r['startedAt'] : $doneAt;
            if ($points < 0 || $points > $cap || $doneAt > $future || $startedAt > $doneAt) {
                continue;
            }
            $sum = ($perWindow[$key] ?? 0) + $points;
            if ($sum > self::MAX_WINDOW_TOTAL) {
                continue;
            }
            $perWindow[$key] = $sum;
            $out[] = compact('kind', 'points', 'doneAt', 'startedAt') + ['windowKey' => $key, 'itemId' => $item];
        }

        return $out;
    }
}
