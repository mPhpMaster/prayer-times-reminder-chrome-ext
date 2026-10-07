<?php

namespace App\Http\Controllers\Game;

use App\Http\Controllers\Controller;
use App\Models\GameUser;
use App\Support\GameAccounts;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** The signed-in player's own account. Sign-in itself lives in AuthController. */
class AccountController extends Controller
{
    /** GET /v1/me -> {user} with the private fields (email, hasPassword, google, legacy). */
    public function show(Request $request): JsonResponse
    {
        return response()->json(['user' => $request->attributes->get('gameUser')->toPrivate()]);
    }

    /** PATCH /v1/me {displayName?, hideProgress?, settings?: {alerts?, journey?, sound?}} */
    public function update(Request $request): JsonResponse
    {
        /** @var GameUser $me */
        $me = $request->attributes->get('gameUser');
        if (is_string($request->input('displayName'))) {
            // Same cleaning as dedication names: control/format characters
            // (bidi overrides, zero-width) can't be used to fake another name.
            $me->display_name = mb_substr(\App\Support\Dedications::clean($request->input('displayName')), 0, 40) ?: null;
        }
        if (is_bool($request->input('hideProgress'))) {
            $me->hide_progress = $request->input('hideProgress');
        }
        // Game options: only the known on/off keys; the rest of the stored set is kept.
        $settings = $request->input('settings');
        if (is_array($settings)) {
            $known = array_filter(
                array_intersect_key($settings, array_flip(GameUser::SETTINGS)),
                'is_bool',
            );
            if ($known) {
                $me->settings = array_merge($me->settings ?? [], $known);
            }
        }
        $me->save();

        return response()->json(['user' => $me->toPrivate()]);
    }

    /**
     * DELETE /v1/me -> 204. Deletes the account, its progress, every follow to
     * or from it, and all its device tokens (Google Play requires in-app
     * account deletion).
     */
    public function destroy(Request $request): Response
    {
        GameAccounts::deleteUser($request->attributes->get('gameUser'));

        return response()->noContent();
    }
}
