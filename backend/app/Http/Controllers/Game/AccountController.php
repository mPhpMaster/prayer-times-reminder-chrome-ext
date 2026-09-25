<?php

namespace App\Http\Controllers\Game;

use App\Http\Controllers\Controller;
use App\Models\GameUser;
use App\Support\GameRules;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountController extends Controller
{
    /** POST /v1/register {username} -> {user, token}. The token is shown once. */
    public function register(Request $request): JsonResponse
    {
        $name = GameRules::username($request->input('username'));
        if (! $name) {
            GameRules::fail(400, 'bad-username');
        }
        if (GameUser::where('username_lower', mb_strtolower($name))->exists()) {
            GameRules::fail(409, 'username-taken');
        }
        $token = bin2hex(random_bytes(32));
        try {
            $user = GameUser::create([
                'username' => $name,
                'username_lower' => mb_strtolower($name),
                'token_hash' => hash('sha256', $token),
            ]);
        } catch (UniqueConstraintViolationException) {
            GameRules::fail(409, 'username-taken'); // lost a race with the same name
        }

        return response()->json(['user' => $user->toPublic(), 'token' => $token], 201);
    }

    /** GET /v1/me */
    public function show(Request $request): JsonResponse
    {
        return response()->json(['user' => $request->attributes->get('gameUser')->toPublic()]);
    }

    /** PATCH /v1/me {displayName?, hideProgress?} */
    public function update(Request $request): JsonResponse
    {
        /** @var GameUser $me */
        $me = $request->attributes->get('gameUser');
        if (is_string($request->input('displayName'))) {
            $me->display_name = mb_substr(trim($request->input('displayName')), 0, 40) ?: null;
        }
        if (is_bool($request->input('hideProgress'))) {
            $me->hide_progress = $request->input('hideProgress');
        }
        $me->save();

        return response()->json(['user' => $me->toPublic()]);
    }
}
