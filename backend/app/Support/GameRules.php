<?php

namespace App\Support;

use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * Validation shared by the game endpoints. The point cap mirrors the app's
 * core/logic/game-score.js (WINDOW_POINTS) — keep them in step.
 *
 * Finishing a window no longer opens a gift worth points: prizes go to each
 * period's top player instead (GameWinners). Older apps still send their
 * "gift" rows; those are dropped here, so they earn nothing.
 */
final class GameRules
{
    public const WINDOW_POINTS = 300;
    public const MAX_WINDOW_TOTAL = self::WINDOW_POINTS;

    /**
     * The first day a completion may be dated. The game went live in
     * September 2026; anything older is forged (and would make period
     * prizes reach back centuries — see GameWinners).
     */
    public const LAUNCH_DAY = '2026-09-01';

    private const USERNAME = '/^[\p{L}\p{N}_]{3,20}$/u'; // any script, digits, underscore
    private const WINDOW_KEY = '/^\d{4}-\d{2}-\d{2}:(Fajr|Dhuhr|Asr|Maghrib|Isha)$/';
    private const ITEM_ID = '/^[a-z0-9-]{1,64}$/';
    private const MONTH = '/^\d{4}-\d{2}$/';
    private const DAY = '/^\d{4}-\d{2}-\d{2}$/';

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

    /** A sign-in email, lowercased; fails 400 bad-email. */
    public static function email(mixed $raw): string
    {
        $e = mb_strtolower(trim((string) $raw));
        if (mb_strlen($e) > 191 || ! filter_var($e, FILTER_VALIDATE_EMAIL)) {
            self::fail(400, 'bad-email');
        }

        return $e;
    }

    /** A new password: 8 to 200 characters; fails 400 weak-password. Stored only as a bcrypt hash. */
    public static function password(mixed $raw): string
    {
        $p = is_string($raw) ? $raw : '';
        if (mb_strlen($p) < 8 || mb_strlen($p) > 200) {
            self::fail(400, 'weak-password');
        }

        return $p;
    }

    /** "YYYY-MM-DD:Prayer", as the apps key a prayer window. */
    public static function isWindowKey(mixed $key): bool
    {
        return is_string($key) && preg_match(self::WINDOW_KEY, $key) === 1;
    }

    /**
     * A window date a player can really have played: a real calendar date,
     * not before LAUNCH_DAY, and not after tomorrow in UTC (the furthest-ahead
     * time zone is UTC+14, so a player's "today" is at most UTC tomorrow).
     */
    public static function playableDay(string $day, int $nowMs): bool
    {
        if (! checkdate((int) substr($day, 5, 2), (int) substr($day, 8, 2), (int) substr($day, 0, 4))) {
            return false;
        }

        return $day >= self::LAUNCH_DAY && $day <= gmdate('Y-m-d', intdiv($nowMs, 1000) + 86400);
    }

    /** The viewer's local date "YYYY-MM-DD", or null (then the server's UTC date is used). */
    public static function day(?string $d): ?string
    {
        if ($d === null) {
            return null;
        }
        if (! preg_match(self::DAY, $d) || ! checkdate((int) substr($d, 5, 2), (int) substr($d, 8, 2), (int) substr($d, 0, 4))) {
            self::fail(400, 'bad-day');
        }

        return $d;
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
            if (! preg_match(self::WINDOW_KEY, $key) || ! preg_match(self::ITEM_ID, $item) || ! self::playableDay(substr($key, 0, 10), $nowMs)) {
                continue;
            }
            if (($r['kind'] ?? '') === 'gift') {
                continue; // gifts no longer earn points (see the class comment)
            }
            $kind = 'task';
            $cap = self::WINDOW_POINTS;
            if (! is_numeric($r['points'] ?? null) || ! is_numeric($r['doneAt'] ?? null)) {
                continue;
            }
            $points = (int) round((float) $r['points']);
            $doneAt = (int) $r['doneAt'];
            $startedAt = is_numeric($r['startedAt'] ?? null) ? (int) $r['startedAt'] : $doneAt;
            if ($points < 1 || $points > $cap || $doneAt > $future || $startedAt > $doneAt) {
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
