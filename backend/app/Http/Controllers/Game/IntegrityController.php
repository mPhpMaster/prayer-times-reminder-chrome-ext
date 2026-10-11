<?php

namespace App\Http\Controllers\Game;

use App\Http\Controllers\Controller;
use App\Models\GameUser;
use App\Support\GameRules;
use App\Support\PlayIntegrity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Google Play Integrity for the Android app (PlayIntegrity). The app checks
 * in after sign-in and about once a day:
 *   1. GET  /v1/integrity/challenge -> {nonce, projectNumber}
 *   2. it asks Google for a token whose request hash is that nonce
 *   3. POST /v1/integrity {token}   -> {verified, detail}
 * The result is saved on the player: a recent pass shows the "verified" mark
 * next to their name, a failure is listed for the admins. Nobody is blocked:
 * the web, Chrome and Windows apps have no such check.
 */
class IntegrityController extends Controller
{
    private const NONCE_TTL = 10 * 60;

    /** GET /v1/integrity/challenge -> {nonce, projectNumber}; 503 integrity-off when not set up. */
    public function challenge(Request $request): JsonResponse
    {
        if (! PlayIntegrity::configured()) {
            GameRules::fail(503, 'integrity-off');
        }
        $nonce = rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
        Cache::put($this->key($request), $nonce, self::NONCE_TTL);

        return response()->json(['nonce' => $nonce, 'projectNumber' => PlayIntegrity::projectNumber()]);
    }

    /** POST /v1/integrity {token} -> {verified, detail}; 409 no-challenge when the nonce is used or expired. */
    public function verify(Request $request): JsonResponse
    {
        if (! PlayIntegrity::configured()) {
            GameRules::fail(503, 'integrity-off');
        }
        $token = $request->input('token');
        if (! is_string($token) || $token === '' || strlen($token) > 12000) {
            GameRules::fail(422, 'bad-token');
        }
        // One use per challenge: a captured token can't be replayed.
        $nonce = Cache::pull($this->key($request)) ?? GameRules::fail(409, 'no-challenge');

        $result = PlayIntegrity::verdict(PlayIntegrity::decode($token), $nonce, (int) now()->getTimestampMs());

        /** @var GameUser $me */
        $me = $request->attributes->get('gameUser');
        $me->integrity_status = $result['ok'] ? 'ok' : 'fail';
        $me->integrity_detail = $result['detail'] ?: null;
        $me->integrity_checked_at = now();
        $me->save();

        return response()->json(['verified' => $result['ok'], 'detail' => $result['detail']]);
    }

    private function key(Request $request): string
    {
        return 'integrity-nonce:'.$request->attributes->get('gameUser')->id;
    }
}
