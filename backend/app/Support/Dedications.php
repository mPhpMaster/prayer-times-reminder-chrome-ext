<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * The About page's dedication names. A name is a map lang => text in any of
 * the app's languages (config game.languages); at least one is required.
 */
final class Dedications
{
    public const MAX_NAME = 80;

    public const MAX_NOTE = 300;

    public const MAX_PENDING_PER_USER = 3;

    /**
     * Clean a names map from a request; fails 400 bad-names when nothing
     * usable is left or a value looks like a link.
     *
     * @return array<string,string>
     */
    public static function names(mixed $raw): array
    {
        $out = [];
        foreach (config('game.languages') as $lang) {
            $v = is_array($raw) ? ($raw[$lang] ?? null) : null;
            if (! is_string($v)) {
                continue;
            }
            $v = self::clean($v);
            if ($v === '') {
                continue;
            }
            if (mb_strlen($v) > self::MAX_NAME || preg_match('~(://|www\.|\.(com|net|org|io|ly|me)\b|@)~iu', $v)) {
                GameRules::fail(400, 'bad-names');
            }
            $out[$lang] = $v;
        }
        if (! $out) {
            GameRules::fail(400, 'bad-names');
        }

        return $out;
    }

    public static function note(mixed $raw): ?string
    {
        if (! is_string($raw)) {
            return null;
        }
        $v = self::clean($raw);

        return $v === '' ? null : mb_substr($v, 0, self::MAX_NOTE);
    }

    /** One line: control/format characters out (ZWNJ/ZWJ kept), whitespace collapsed, NFC. */
    private static function clean(string $v): string
    {
        $v = preg_replace('/(?:(?![\x{200C}\x{200D}])[\p{Cc}\p{Cf}])+/u', ' ', $v) ?? '';
        $v = trim(preg_replace('/\s+/u', ' ', $v) ?? '');
        if (class_exists(\Normalizer::class)) {
            $v = \Normalizer::normalize($v, \Normalizer::FORM_C) ?: $v;
        }

        return $v;
    }

    /** The visible names, in display order. */
    public static function publicList(): array
    {
        return DB::table('dedications')->where('hidden', false)
            ->orderBy('sort_order')->orderBy('id')->get(['id', 'names'])
            ->map(fn ($r) => ['id' => (int) $r->id, 'names' => json_decode($r->names, true) ?: []])
            ->all();
    }

    public static function row(object $r): array
    {
        return [
            'id' => (int) $r->id,
            'names' => json_decode($r->names, true) ?: [],
            'sortOrder' => (int) $r->sort_order,
            'hidden' => (bool) $r->hidden,
            'requestId' => $r->request_id === null ? null : (int) $r->request_id,
        ];
    }

    public static function request(object $r, bool $forAdmin = false): array
    {
        $out = [
            'id' => (int) $r->id,
            'names' => json_decode($r->names, true) ?: [],
            'note' => $r->note,
            'status' => $r->status,
            'reason' => $r->reason,
            'createdAt' => (string) $r->created_at,
            'reviewedAt' => $r->reviewed_at === null ? null : (string) $r->reviewed_at,
        ];
        if ($forAdmin) {
            $out['user'] = isset($r->username) ? ['id' => (int) $r->user_id, 'username' => $r->username, 'email' => $r->email] : null;
            $out['reviewedBy'] = $r->reviewed_by;
            $out['dedicationId'] = $r->dedication_id === null ? null : (int) $r->dedication_id;
        }

        return $out;
    }
}
