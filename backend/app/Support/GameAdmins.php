<?php

namespace App\Support;

use App\Models\GameUser;
use Illuminate\Support\Facades\DB;

/**
 * Who is an admin, and the admin log.
 *
 * A player is an admin when their email is *verified* (Google sign-in, an
 * emailed code, or a password reset code) and is either the super admin
 * (config game.super_admin) or listed in game_admins. The email alone is not
 * enough: email + password sign-up doesn't prove the email, and anyone could
 * otherwise register an admin's address before its owner does.
 */
final class GameAdmins
{
    public static function superEmail(): string
    {
        return (string) config('game.super_admin');
    }

    public static function isSuper(?string $email): bool
    {
        return $email !== null && $email !== '' && mb_strtolower($email) === self::superEmail();
    }

    /** Admin by email (the list), whether or not anyone has signed in with it yet. */
    public static function isAdminEmail(?string $email): bool
    {
        if ($email === null || $email === '') {
            return false;
        }
        $email = mb_strtolower($email);

        return self::isSuper($email) || DB::table('game_admins')->where('email', $email)->exists();
    }

    public static function isAdmin(GameUser $user): bool
    {
        return $user->email_verified_at !== null && self::isAdminEmail($user->email);
    }

    public static function isSuperAdmin(GameUser $user): bool
    {
        return $user->email_verified_at !== null && self::isSuper($user->email);
    }

    public static function log(GameUser $admin, string $action, ?string $target = null, array $details = []): void
    {
        DB::table('game_admin_log')->insert([
            'admin_email' => (string) $admin->email,
            'action' => $action,
            'target' => $target === null ? null : mb_substr($target, 0, 191),
            'details' => $details ? json_encode($details, JSON_UNESCAPED_UNICODE) : null,
            'created_at' => now(),
        ]);
    }

    /** Emails of every admin, for notifications (the super admin first). */
    public static function emails(): array
    {
        return array_values(array_unique(array_merge(
            [self::superEmail()],
            DB::table('game_admins')->orderBy('created_at')->pluck('email')->all(),
        )));
    }
}
