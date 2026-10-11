<?php

namespace App\Models;

use App\Support\GameAdmins;
use App\Support\PlayIntegrity;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A player. `username` is the public handle (leaderboard, follows, search);
 * signing in is by `email` + `password` (bcrypt) or by `google_sub` (the
 * Google account id). Legacy rows from the name-only era have neither until
 * the app links them (App\Support\GameAccounts).
 */
class GameUser extends Model
{
    protected $table = 'game_users';

    protected $fillable = ['username', 'username_lower', 'display_name', 'hide_progress', 'email', 'password', 'google_sub'];

    protected $hidden = ['password', 'google_sub', 'email'];

    /** The game options kept with the account (all on/off). newTab: the Chrome extension's new-tab page. */
    public const SETTINGS = ['alerts', 'journey', 'sound', 'newTab'];

    protected function casts(): array
    {
        return ['hide_progress' => 'boolean', 'email_verified_at' => 'datetime', 'banned_at' => 'datetime', 'settings' => 'array', 'integrity_checked_at' => 'datetime'];
    }

    public static function findByUsername(string $name): ?self
    {
        return static::where('username_lower', mb_strtolower($name))->first();
    }

    /** Banned by an admin: no sign-in, hidden from other players. */
    public function isBanned(): bool
    {
        return $this->banned_at !== null;
    }

    public function isLegacy(): bool
    {
        return $this->email === null && $this->google_sub === null;
    }

    /** A Play Integrity pass in the last PlayIntegrity::VALID_DAYS days (the "verified" mark). */
    public static function playVerified(?string $status, mixed $checkedAt): bool
    {
        return $status === 'ok' && $checkedAt !== null
            && Carbon::parse($checkedAt)->gt(now()->subDays(PlayIntegrity::VALID_DAYS));
    }

    public function isPlayVerified(): bool
    {
        return self::playVerified($this->integrity_status, $this->integrity_checked_at);
    }

    /** What other players may see. */
    public function toPublic(): array
    {
        return [
            'username' => $this->username,
            'displayName' => $this->display_name ?: $this->username,
            'hideProgress' => (bool) $this->hide_progress,
            'playVerified' => $this->isPlayVerified(),
        ];
    }

    /** What the player sees about their own account (never the hash or the Google id). */
    public function toPrivate(): array
    {
        return $this->toPublic() + [
            'email' => $this->email,
            'emailVerified' => $this->email_verified_at !== null,
            'hasPassword' => $this->password !== null,
            'google' => $this->google_sub !== null,
            'legacy' => $this->isLegacy(),
            'admin' => GameAdmins::isAdmin($this),
            'superAdmin' => GameAdmins::isSuperAdmin($this),
            // null until the player changes one: the app keeps its own defaults.
            'settings' => $this->settings ? (object) array_intersect_key($this->settings, array_flip(self::SETTINGS)) : null,
        ];
    }
}
