<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GameUser extends Model
{
    protected $table = 'game_users';

    protected $fillable = ['username', 'username_lower', 'display_name', 'hide_progress', 'token_hash'];

    protected $hidden = ['token_hash'];

    protected function casts(): array
    {
        return ['hide_progress' => 'boolean'];
    }

    public static function findByUsername(string $name): ?self
    {
        return static::where('username_lower', mb_strtolower($name))->first();
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
}
