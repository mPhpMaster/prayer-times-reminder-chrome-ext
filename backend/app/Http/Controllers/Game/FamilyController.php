<?php

namespace App\Http\Controllers\Game;

use App\Http\Controllers\Controller;
use App\Models\GameUser;
use App\Support\GameFamilies;
use App\Support\GameRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * Families: parents follow their children's adhkar. Rules in GameFamilies.
 *
 * Every member sees the family and who is in it. Parents also see each
 * member's whole year (even when that member hides their progress from other
 * players), and the state of chosen prayer windows, which the apps use to
 * alert a parent when a child leaves a prayer's tasks unfinished — the app
 * knows when each window closes (its prayer times), so it asks the server
 * only then. Alerts per parent: off, after each prayer, or a daily summary.
 */
class FamilyController extends Controller
{
    /**
     * GET /v1/family -> {family: {role, notify, members: [{username, displayName, role, me}]}|null,
     *                    invites: [{id, role, from, members}], sent: [{id, role, to}]}
     */
    public function show(Request $request): JsonResponse
    {
        return response()->json($this->state($this->me($request)));
    }

    /** POST /v1/family -> 201. The creator is its first parent. */
    public function create(Request $request): JsonResponse
    {
        $me = $this->me($request);
        if (GameFamilies::membership($me->id)) {
            GameRules::fail(409, 'in-a-family');
        }
        DB::transaction(function () use ($me) {
            $id = DB::table('game_families')->insertGetId(['created_at' => now()]);
            DB::table('game_family_members')->insert([
                'user_id' => $me->id, 'family_id' => $id, 'role' => 'parent', 'notify' => 'window', 'created_at' => now(),
            ]);
        });

        return response()->json($this->state($me), 201);
    }

    /** POST /v1/family/invites {username, role: parent|child} -> 201. Parents only. */
    public function invite(Request $request): JsonResponse
    {
        $me = $this->me($request);
        $m = $this->parent($me);
        $role = $request->input('role');
        if (! in_array($role, GameFamilies::ROLES, true)) {
            GameRules::fail(400, 'bad-role');
        }
        $user = GameUser::findByUsername((string) $request->input('username'));
        if (! $user || $user->isBanned()) {
            GameRules::fail(404, 'no-such-user');
        }
        if ($user->id === $me->id) {
            GameRules::fail(400, 'self');
        }
        if (GameFamilies::membership($user->id)) {
            GameRules::fail(409, 'in-a-family');
        }
        if (DB::table('game_family_invites')->where('family_id', $m->family_id)->where('user_id', $user->id)->exists()) {
            GameRules::fail(409, 'already-invited');
        }
        $size = DB::table('game_family_members')->where('family_id', $m->family_id)->count()
            + DB::table('game_family_invites')->where('family_id', $m->family_id)->count();
        if ($size >= GameFamilies::MAX_MEMBERS) {
            GameRules::fail(409, 'family-full');
        }
        DB::table('game_family_invites')->insert([
            'family_id' => $m->family_id, 'user_id' => $user->id, 'role' => $role, 'invited_by' => $me->id, 'created_at' => now(),
        ]);

        return response()->json($this->state($me), 201);
    }

    /** POST /v1/family/invites/{id}/accept -> the new state. Only the invitee. */
    public function accept(Request $request, int $id): JsonResponse
    {
        $me = $this->me($request);
        $inv = DB::table('game_family_invites')->where('id', $id)->where('user_id', $me->id)->first()
            ?? GameRules::fail(404, 'not-found');
        if (GameFamilies::membership($me->id)) {
            GameRules::fail(409, 'in-a-family');
        }
        DB::transaction(function () use ($me, $inv) {
            DB::table('game_family_members')->insert([
                'user_id' => $me->id, 'family_id' => $inv->family_id, 'role' => $inv->role, 'notify' => 'window', 'created_at' => now(),
            ]);
            // In one family now: every other invitation lapses.
            DB::table('game_family_invites')->where('user_id', $me->id)->delete();
        });

        return response()->json($this->state($me));
    }

    /** DELETE /v1/family/invites/{id} -> 204. The invitee declines, or a parent of that family cancels. */
    public function dropInvite(Request $request, int $id): Response
    {
        $me = $this->me($request);
        $inv = DB::table('game_family_invites')->find($id) ?? GameRules::fail(404, 'not-found');
        $m = GameFamilies::membership($me->id);
        $mayCancel = $m && $m->role === 'parent' && (int) $m->family_id === (int) $inv->family_id;
        if ((int) $inv->user_id !== $me->id && ! $mayCancel) {
            GameRules::fail(404, 'not-found');
        }
        DB::table('game_family_invites')->where('id', $id)->delete();

        return response()->noContent();
    }

    /** DELETE /v1/family/members/{username} -> 204. A parent removes a child. */
    public function remove(Request $request, string $username): Response
    {
        $me = $this->me($request);
        $m = $this->parent($me);
        $user = GameUser::findByUsername($username);
        $target = $user ? GameFamilies::membership($user->id) : null;
        if (! $target || (int) $target->family_id !== (int) $m->family_id) {
            GameRules::fail(404, 'not-found');
        }
        if ($target->role === 'parent') {
            GameRules::fail(403, 'parents-leave-themselves');
        }
        DB::table('game_family_members')->where('user_id', $user->id)->delete();

        return response()->noContent();
    }

    /** POST /v1/family/leave -> 204. Parents only; the last parent out dissolves the family. */
    public function leave(Request $request): Response
    {
        $me = $this->me($request);
        $m = GameFamilies::membership($me->id) ?? GameRules::fail(404, 'no-family');
        if ($m->role !== 'parent') {
            GameRules::fail(403, 'children-cant-leave');
        }
        DB::transaction(function () use ($me, $m) {
            DB::table('game_family_members')->where('user_id', $me->id)->delete();
            GameFamilies::dissolveIfOrphaned((int) $m->family_id);
        });

        return response()->noContent();
    }

    /** PATCH /v1/family/me {notify: off|window|daily} -> the new state. Parents only. */
    public function settings(Request $request): JsonResponse
    {
        $me = $this->me($request);
        $this->parent($me);
        $notify = $request->input('notify');
        if (! in_array($notify, GameFamilies::NOTIFY, true)) {
            GameRules::fail(400, 'bad-notify');
        }
        DB::table('game_family_members')->where('user_id', $me->id)->update(['notify' => $notify]);

        return response()->json($this->state($me));
    }

    /**
     * GET /v1/family/status?keys=2026-10-08:Asr,... -> {notify, children: [{username, displayName,
     * windows: {key: {done, total, complete}}}]}. Parents only; at most 10 window keys.
     */
    public function status(Request $request): JsonResponse
    {
        $me = $this->me($request);
        $m = $this->parent($me);
        $keys = array_values(array_unique(array_filter(
            explode(',', (string) $request->query('keys', '')),
            fn ($k) => GameRules::isWindowKey($k),
        )));
        if (count($keys) > 10) {
            GameRules::fail(400, 'too-many-keys');
        }
        $children = $this->members($m->family_id)->where('role', 'child')->values();
        $windows = GameFamilies::windows($children->pluck('id')->all(), $keys);

        return response()->json([
            'notify' => $m->notify,
            'children' => $children->map(fn ($c) => [
                'username' => $c->username,
                'displayName' => $c->display_name ?: $c->username,
                'windows' => (object) ($windows[$c->id] ?? []),
            ])->all(),
        ]);
    }

    /** GET /v1/family/members/{username}/year?year=YYYY -> GameFamilies::year(). Parents only. */
    public function year(Request $request, string $username): JsonResponse
    {
        $me = $this->me($request);
        $m = $this->parent($me);
        $user = GameUser::findByUsername($username);
        $target = $user ? GameFamilies::membership($user->id) : null;
        if (! $target || (int) $target->family_id !== (int) $m->family_id) {
            GameRules::fail(404, 'not-found');
        }
        $year = (int) ($request->query('year') ?: gmdate('Y'));
        if ($year < 2026 || $year > (int) gmdate('Y') + 1) {
            GameRules::fail(400, 'bad-year');
        }

        return response()->json(['user' => $user->toPublic(), 'role' => $target->role] + GameFamilies::year($user->id, $year));
    }

    // ---- helpers ------------------------------------------------------------

    private function me(Request $request): GameUser
    {
        return $request->attributes->get('gameUser');
    }

    /** The caller's membership, which must be a parent's. */
    private function parent(GameUser $me): object
    {
        $m = GameFamilies::membership($me->id) ?? GameRules::fail(404, 'no-family');
        if ($m->role !== 'parent') {
            GameRules::fail(403, 'parents-only');
        }

        return $m;
    }

    private function members(int $familyId)
    {
        return DB::table('game_family_members as m')->join('game_users as u', 'u.id', '=', 'm.user_id')
            ->where('m.family_id', $familyId)
            ->orderByRaw("CASE m.role WHEN 'parent' THEN 0 ELSE 1 END")->orderBy('u.username')
            ->get(['u.id', 'u.username', 'u.display_name', 'm.role']);
    }

    private function state(GameUser $me): array
    {
        $m = GameFamilies::membership($me->id);
        $family = null;
        $sent = [];
        if ($m) {
            $family = [
                'role' => $m->role,
                'notify' => $m->role === 'parent' ? $m->notify : null,
                'members' => $this->members($m->family_id)->map(fn ($r) => [
                    'username' => $r->username,
                    'displayName' => $r->display_name ?: $r->username,
                    'role' => $r->role,
                    'me' => (int) $r->id === $me->id,
                ])->values()->all(),
            ];
            if ($m->role === 'parent') {
                $sent = DB::table('game_family_invites as i')->join('game_users as u', 'u.id', '=', 'i.user_id')
                    ->where('i.family_id', $m->family_id)->orderBy('i.id')
                    ->get(['i.id', 'i.role', 'u.username', 'u.display_name'])
                    ->map(fn ($r) => ['id' => (int) $r->id, 'role' => $r->role, 'to' => [
                        'username' => $r->username, 'displayName' => $r->display_name ?: $r->username,
                    ]])->all();
            }
        }
        $invites = DB::table('game_family_invites as i')->join('game_users as u', 'u.id', '=', 'i.invited_by')
            ->where('i.user_id', $me->id)->orderBy('i.id')
            ->get(['i.id', 'i.role', 'i.family_id', 'u.username', 'u.display_name'])
            ->map(fn ($r) => ['id' => (int) $r->id, 'role' => $r->role,
                'from' => ['username' => $r->username, 'displayName' => $r->display_name ?: $r->username],
                'members' => DB::table('game_family_members')->where('family_id', $r->family_id)->count(),
            ])->all();

        return ['family' => $family, 'invites' => $invites, 'sent' => $sent];
    }
}
