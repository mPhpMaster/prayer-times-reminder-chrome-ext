<?php

namespace App\Http\Controllers\Game;

use App\Http\Controllers\Controller;
use App\Models\GameUser;
use App\Support\AppleIdToken;
use App\Support\AppleSignIn;
use App\Support\GameRules;
use App\Support\GoogleIdToken;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The signed-in player's sign-in methods: link a Google account or an Apple ID
 * to this account (either way round: whichever was used first), or remove one.
 * Afterwards signing in with any linked method opens this same account.
 *
 * - Linking fails with `account-conflict` when that Google account / Apple ID
 *   already belongs to another player (sign in with it and delete that
 *   account first), and with `already-linked` when this account already has a
 *   different one of that kind (unlink it first).
 * - Unlinking fails with `last-method` when it would leave no way to sign in
 *   (no password and no other provider).
 */
class LinkController extends Controller
{
    private const COLUMNS = ['google' => 'google_sub', 'apple' => 'apple_sub'];

    /** POST /v1/me/link/google {idToken} -> {user} */
    public function google(Request $request): JsonResponse
    {
        if (! config('services.google.client_id')) {
            GameRules::fail(503, 'google-unavailable');
        }
        $claims = GoogleIdToken::verify((string) $request->input('idToken'));
        if (! $claims) {
            GameRules::fail(401, 'google-invalid');
        }

        return $this->link($this->me($request), 'google_sub', $claims['sub'], $claims['email']);
    }

    /** POST /v1/me/link/apple {identityToken, nonce?, authorizationCode?} -> {user} */
    public function apple(Request $request): JsonResponse
    {
        if (! AppleSignIn::enabled()) {
            GameRules::fail(503, 'apple-unavailable');
        }
        $claims = AppleIdToken::verify((string) $request->input('identityToken'), $request->input('nonce') ? (string) $request->input('nonce') : null);
        if (! $claims) {
            GameRules::fail(401, 'apple-invalid');
        }
        $me = $this->me($request);
        $res = $this->link($me, 'apple_sub', $claims['sub'], $claims['email']);
        $code = $request->input('authorizationCode');
        AppleSignIn::keepRefreshToken($me, is_string($code) ? $code : null, $claims['aud']);

        return $res;
    }

    /** DELETE /v1/me/link/{google|apple} -> {user} */
    public function unlink(Request $request, string $provider): JsonResponse
    {
        $column = self::COLUMNS[$provider] ?? null;
        if (! $column) {
            GameRules::fail(404, 'not-found');
        }
        $me = $this->me($request);
        if ($me->{$column} !== null) {
            $left = ($me->password !== null ? 1 : 0)
                + ($provider !== 'google' && $me->google_sub !== null ? 1 : 0)
                + ($provider !== 'apple' && $me->apple_sub !== null ? 1 : 0);
            if ($left === 0) {
                GameRules::fail(409, 'last-method');
            }
            if ($provider === 'apple') {
                AppleSignIn::revoke($me); // and forget the refresh token
            }
            $me->{$column} = null;
            $me->save();
        }

        return response()->json(['user' => $me->toPrivate()]);
    }

    private function me(Request $request): GameUser
    {
        return $request->attributes->get('gameUser');
    }

    private function link(GameUser $me, string $column, string $sub, ?string $email): JsonResponse
    {
        $owner = GameUser::where($column, $sub)->first();
        if ($owner && $owner->id !== $me->id) {
            GameRules::fail(409, 'account-conflict');
        }
        if (! $owner) {
            if ($me->{$column} !== null) {
                GameRules::fail(409, 'already-linked');
            }
            $me->{$column} = $sub;
        }
        // The provider's email proves the address: it becomes the account's
        // email when it has none (and nobody else uses it), or confirms it.
        if ($email !== null) {
            if ($me->email === null && ! GameUser::where('email', $email)->exists()) {
                $me->email = $email;
                $me->email_verified_at = now();
            } elseif ($me->email === $email && $me->email_verified_at === null) {
                $me->email_verified_at = now();
            }
        }
        try {
            $me->save();
        } catch (UniqueConstraintViolationException) {
            GameRules::fail(409, 'account-conflict'); // lost a race for the same identity
        }

        return response()->json(['user' => $me->toPrivate()]);
    }
}
