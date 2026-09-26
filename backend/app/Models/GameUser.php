<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

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

    protected function casts(): array
    {
        return ['hide_progress' => 'boolean'];
    }

    public static function findByUsername(string $name): ?self
    {
        return static::where('username_lower', mb_strtolower($name))->first();
    }

    public function isLegacy(): bool
    {
        return $this->email === null && $this->google_sub === null;
    }

    /** What other players may see. */
    public function toPublic(): array
    {
        return [
            'username' => $this->username,
            'displayName' => $this->display_name ?: $this->username,
            'hideProgress' => (bool) $this->hide_progress,
        ];
    }

    /** What the player sees about their own account (never the hash or the Google id). */
    public function toPrivate(): array
    {
        return $this->toPublic() + [
            'email' => $this->email,
            'hasPassword' => $this->password !== null,
            'google' => $this->google_sub !== null,
            'legacy' => $this->isLegacy(),
        ];
    }
}
