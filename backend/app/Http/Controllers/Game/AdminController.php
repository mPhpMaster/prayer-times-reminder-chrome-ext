<?php

namespace App\Http\Controllers\Game;

use App\Http\Controllers\Controller;
use App\Models\GameUser;
use App\Support\Dedications;
use App\Support\GameAccounts;
use App\Support\GameAdmins;
use App\Support\GameRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * The in-app Admin page (GameAuth + GameAdmin on every route). Every change is
 * written to game_admin_log.
 *
 * Guard rails:
 * - The super admin (config game.super_admin) is never listed in game_admins
 *   and can't be removed, deleted or reset from here.
 * - Removing an admin, and deleting or resetting another admin's account, is
 *   for the super admin only, so one admin can't lock the others out.
 * - An admin deletes their own account from "My account", not from here.
 * - Banning and editing a player are for players who aren't admins (remove
 *   the admin first).
 */
class AdminController extends Controller
{
    /** GET /v1/admin/overview -> {pendingRequests, admins, users} */
    public function overview(): JsonResponse
    {
        return response()->json([
            'pendingRequests' => DB::table('dedication_requests')->where('status', 'pending')->count(),
            'admins' => count(GameAdmins::emails()),
            'users' => DB::table('game_users')->count(),
        ]);
    }

    // ---- admins -----------------------------------------------------------

    /** GET /v1/admin/admins -> {admins: [{email, super, addedBy, createdAt, username, verified}]} */
    public function admins(): JsonResponse
    {
        $rows = collect([['email' => GameAdmins::superEmail(), 'added_by' => null, 'created_at' => null]])
            ->concat(DB::table('game_admins')->orderBy('created_at')->get()->map(fn ($r) => (array) $r));
        $users = GameUser::whereIn('email', $rows->pluck('email'))->get()->keyBy('email');

        return response()->json(['admins' => $rows->map(fn ($r) => [
            'email' => $r['email'],
            'super' => GameAdmins::isSuper($r['email']),
            'addedBy' => $r['added_by'],
            'createdAt' => $r['created_at'] === null ? null : (string) $r['created_at'],
            'username' => $users[$r['email']]->username ?? null,
            'verified' => isset($users[$r['email']]) && $users[$r['email']]->email_verified_at !== null,
        ])->values()->all()]);
    }

    /** POST /v1/admin/admins {email} -> 201. Super admin only. The owner of that email becomes admin once their email is verified. */
    public function addAdmin(Request $request): JsonResponse
    {
        $me = $this->me($request);
        if (! GameAdmins::isSuperAdmin($me)) {
            GameRules::fail(403, 'super-admin-only');
        }
        $email = GameRules::email($request->input('email'));
        if (GameAdmins::isAdminEmail($email)) {
            GameRules::fail(409, 'already-admin');
        }
        DB::table('game_admins')->insert(['email' => $email, 'added_by' => $me->email, 'created_at' => now()]);
        GameAdmins::log($me, 'admin.add', $email);

        return $this->admins()->setStatusCode(201);
    }

    /** DELETE /v1/admin/admins/{email} -> 204. Super admin only. */
    public function removeAdmin(Request $request, string $email): Response
    {
        $me = $this->me($request);
        $email = mb_strtolower($email);
        if (GameAdmins::isSuper($email)) {
            GameRules::fail(403, 'super-admin');
        }
        if (! GameAdmins::isSuperAdmin($me)) {
            GameRules::fail(403, 'super-admin-only');
        }
        if (! DB::table('game_admins')->where('email', $email)->delete()) {
            GameRules::fail(404, 'not-found');
        }
        GameAdmins::log($me, 'admin.remove', $email);

        return response()->noContent();
    }

    // ---- accounts ---------------------------------------------------------

    /** GET /v1/admin/users?q= -> {users} — by username or email, at most 50. */
    public function users(Request $request): JsonResponse
    {
        $q = mb_strtolower(trim((string) $request->query('q', '')));
        $query = GameUser::query();
        if ($q !== '') {
            $like = '%'.str_replace(['%', '_'], '', $q).'%'; // wildcards dropped: SQLite has no default LIKE escape
            $query->where(fn ($w) => $w->where('username_lower', 'like', $like)->orWhere('email', 'like', $like));
        }
        $users = $query->orderByDesc('id')->limit(50)->get();
        $points = DB::table('game_completions')->whereIn('user_id', $users->pluck('id'))
            ->groupBy('user_id')->select('user_id', DB::raw('SUM(points) AS points'), DB::raw('COUNT(*) AS items'))
            ->get()->keyBy('user_id');
        $seen = DB::table('game_tokens')->whereIn('user_id', $users->pluck('id'))
            ->groupBy('user_id')->select('user_id', DB::raw('MAX(last_used_at) AS seen'))->get()->keyBy('user_id');

        return response()->json(['users' => $users->map(fn (GameUser $u) => [
            'id' => $u->id,
            'username' => $u->username,
            'displayName' => $u->display_name,
            'email' => $u->email,
            'emailVerified' => $u->email_verified_at !== null,
            'google' => $u->google_sub !== null,
            'legacy' => $u->isLegacy(),
            'admin' => GameAdmins::isAdmin($u),
            'superAdmin' => GameAdmins::isSuperAdmin($u),
            'points' => (int) ($points[$u->id]->points ?? 0),
            'items' => (int) ($points[$u->id]->items ?? 0),
            'createdAt' => (string) $u->created_at,
            'lastSeen' => isset($seen[$u->id]) ? (string) $seen[$u->id]->seen : null,
            'hideProgress' => (bool) $u->hide_progress,
            'banned' => $u->isBanned(),
            'bannedAt' => $u->banned_at === null ? null : (string) $u->banned_at,
            'banReason' => $u->ban_reason,
            'bannedBy' => $u->banned_by,
        ])->values()->all()]);
    }

    /**
     * PATCH /v1/admin/users/{id} {username?, displayName?, email?, hideProgress?} -> 204.
     * A changed email must be confirmed again by its owner.
     */
    public function updateUser(Request $request, int $id): Response
    {
        $me = $this->me($request);
        $user = $this->player($me, $id);
        $changes = [];

        if ($request->has('username')) {
            $name = GameRules::username($request->input('username')) ?? GameRules::fail(400, 'bad-username');
            if ($name !== $user->username) {
                $lower = mb_strtolower($name);
                if (GameUser::where('username_lower', $lower)->where('id', '!=', $user->id)->exists()) {
                    GameRules::fail(409, 'username-taken');
                }
                $changes['username'] = [$user->username, $name];
                $user->username = $name;
                $user->username_lower = $lower;
            }
        }
        if ($request->has('displayName')) {
            $display = mb_substr(Dedications::clean((string) $request->input('displayName')), 0, 40) ?: null;
            if ($display !== $user->display_name) {
                $changes['displayName'] = [$user->display_name, $display];
                $user->display_name = $display;
            }
        }
        if ($request->has('email')) {
            $email = GameRules::email($request->input('email'));
            if ($email !== $user->email) {
                if (GameUser::where('email', $email)->where('id', '!=', $user->id)->exists()) {
                    GameRules::fail(409, 'email-taken');
                }
                if (GameAdmins::isAdminEmail($email)) {
                    GameRules::fail(409, 'admin-email'); // would hand admin rights over
                }
                DB::table('game_password_resets')->where('email', $user->email)->delete();
                $changes['email'] = [$user->email, $email];
                $user->email = $email;
                $user->email_verified_at = null;
            }
        }
        if (is_bool($request->input('hideProgress')) && $request->input('hideProgress') !== (bool) $user->hide_progress) {
            $changes['hideProgress'] = [(bool) $user->hide_progress, $request->input('hideProgress')];
            $user->hide_progress = $request->input('hideProgress');
        }

        if ($changes) {
            $user->save();
            GameAdmins::log($me, 'user.edit', $user->username, $changes);
        }

        return response()->noContent();
    }

    /** POST /v1/admin/users/{id}/ban {reason?} -> 204. Signs them out everywhere. */
    public function ban(Request $request, int $id): Response
    {
        $me = $this->me($request);
        $user = $this->player($me, $id);
        $reason = mb_substr(Dedications::clean((string) $request->input('reason', '')), 0, 200) ?: null;
        DB::transaction(function () use ($user, $me, $reason) {
            $user->banned_at = now();
            $user->ban_reason = $reason;
            $user->banned_by = $me->email;
            $user->save();
            DB::table('game_tokens')->where('user_id', $user->id)->delete();
        });
        GameAdmins::log($me, 'user.ban', $user->username, $reason === null ? [] : ['reason' => $reason]);

        return response()->noContent();
    }

    /** DELETE /v1/admin/users/{id}/ban -> 204. */
    public function unban(Request $request, int $id): Response
    {
        $me = $this->me($request);
        $user = $this->player($me, $id);
        if ($user->isBanned()) {
            $user->banned_at = null;
            $user->ban_reason = null;
            $user->banned_by = null;
            $user->save();
            GameAdmins::log($me, 'user.unban', $user->username);
        }

        return response()->noContent();
    }

    /** DELETE /v1/admin/users/{id} -> 204. */
    public function deleteUser(Request $request, int $id): Response
    {
        $me = $this->me($request);
        $user = $this->target($me, $id);
        GameAdmins::log($me, 'user.delete', $user->username, ['email' => $user->email]);
        GameAccounts::deleteUser($user);

        return response()->noContent();
    }

    /** POST /v1/admin/users/{id}/reset -> 204. Progress, achievements, follows and profile are wiped. */
    public function resetUser(Request $request, int $id): Response
    {
        $me = $this->me($request);
        $user = $this->target($me, $id);
        GameAccounts::resetData($user);
        GameAdmins::log($me, 'user.reset', $user->username);

        return response()->noContent();
    }

    // ---- dedication requests ---------------------------------------------

    /** GET /v1/admin/requests?status=pending|approved|rejected|all -> {requests} */
    public function requests(Request $request): JsonResponse
    {
        $status = (string) $request->query('status', 'pending');
        $q = DB::table('dedication_requests as r')->leftJoin('game_users as u', 'u.id', '=', 'r.user_id')
            ->select('r.*', 'u.username', 'u.email');
        if ($status !== 'all') {
            $q->where('r.status', in_array($status, ['pending', 'approved', 'rejected'], true) ? $status : 'pending');
        }
        $rows = $q->orderBy($status === 'pending' ? 'r.id' : 'r.reviewed_at', $status === 'pending' ? 'asc' : 'desc')
            ->limit(200)->get();

        return response()->json(['requests' => $rows->map(fn ($r) => Dedications::request($r, true))->all()]);
    }

    /** PATCH /v1/admin/requests/{id} {names?, note?} -> {request}. Pending only. */
    public function updateRequest(Request $request, int $id): JsonResponse
    {
        $me = $this->me($request);
        $row = $this->pendingRequest($id);
        $patch = ['updated_at' => now()];
        if ($request->has('names')) {
            $patch['names'] = json_encode(Dedications::names($request->input('names')), JSON_UNESCAPED_UNICODE);
        }
        if ($request->has('note')) {
            $patch['note'] = Dedications::note($request->input('note'));
        }
        DB::table('dedication_requests')->where('id', $row->id)->update($patch);
        GameAdmins::log($me, 'request.edit', (string) $row->id);

        return response()->json(['request' => $this->adminRequest($row->id)]);
    }

    /** POST /v1/admin/requests/{id}/approve {names?} -> {request, dedication}. The name goes on the About page. */
    public function approve(Request $request, int $id): JsonResponse
    {
        $me = $this->me($request);
        $row = $this->pendingRequest($id);
        $names = $request->has('names')
            ? Dedications::names($request->input('names'))
            : (json_decode($row->names, true) ?: []);
        $dedicationId = DB::transaction(function () use ($row, $names, $me) {
            $now = now();
            $dedicationId = DB::table('dedications')->insertGetId([
                'names' => json_encode($names, JSON_UNESCAPED_UNICODE),
                'sort_order' => (int) DB::table('dedications')->max('sort_order') + 10,
                'hidden' => false,
                'request_id' => $row->id,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            DB::table('dedication_requests')->where('id', $row->id)->update([
                'status' => 'approved', 'reason' => null, 'dedication_id' => $dedicationId,
                'reviewed_by' => $me->email, 'reviewed_at' => $now, 'updated_at' => $now,
            ]);

            return $dedicationId;
        });
        GameAdmins::log($me, 'request.approve', (string) $row->id, ['names' => $names]);

        return response()->json([
            'request' => $this->adminRequest($row->id),
            'dedication' => Dedications::row(DB::table('dedications')->find($dedicationId)),
        ]);
    }

    /** POST /v1/admin/requests/{id}/reject {reason?} -> {request}. The player sees the reason. */
    public function reject(Request $request, int $id): JsonResponse
    {
        $me = $this->me($request);
        $row = $this->pendingRequest($id);
        DB::table('dedication_requests')->where('id', $row->id)->update([
            'status' => 'rejected', 'reason' => Dedications::note($request->input('reason')),
            'reviewed_by' => $me->email, 'reviewed_at' => now(), 'updated_at' => now(),
        ]);
        GameAdmins::log($me, 'request.reject', (string) $row->id);

        return response()->json(['request' => $this->adminRequest($row->id)]);
    }

    // ---- the names on the About page -------------------------------------

    /** GET /v1/admin/dedications -> {dedications} (hidden ones too). */
    public function dedications(): JsonResponse
    {
        $rows = DB::table('dedications')->orderBy('sort_order')->orderBy('id')->get();

        return response()->json(['dedications' => $rows->map(fn ($r) => Dedications::row($r))->all()]);
    }

    /** POST /v1/admin/dedications {names} -> 201 {dedication}. Added directly, at the end. */
    public function addDedication(Request $request): JsonResponse
    {
        $me = $this->me($request);
        $names = Dedications::names($request->input('names'));
        $now = now();
        $id = DB::table('dedications')->insertGetId([
            'names' => json_encode($names, JSON_UNESCAPED_UNICODE),
            'sort_order' => (int) DB::table('dedications')->max('sort_order') + 10,
            'hidden' => false,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        GameAdmins::log($me, 'dedication.add', (string) $id, ['names' => $names]);

        return response()->json(['dedication' => Dedications::row(DB::table('dedications')->find($id))], 201);
    }

    /** PATCH /v1/admin/dedications/{id} {names?, hidden?} -> {dedication} */
    public function updateDedication(Request $request, int $id): JsonResponse
    {
        $me = $this->me($request);
        $row = DB::table('dedications')->find($id) ?? GameRules::fail(404, 'not-found');
        $patch = ['updated_at' => now()];
        if ($request->has('names')) {
            $patch['names'] = json_encode(Dedications::names($request->input('names')), JSON_UNESCAPED_UNICODE);
        }
        if (is_bool($request->input('hidden'))) {
            $patch['hidden'] = $request->input('hidden');
        }
        DB::table('dedications')->where('id', $row->id)->update($patch);
        GameAdmins::log($me, 'dedication.edit', (string) $row->id, array_diff_key($patch, ['updated_at' => 1]));

        return response()->json(['dedication' => Dedications::row(DB::table('dedications')->find($row->id))]);
    }

    /** POST /v1/admin/dedications/order {ids: [..]} -> {dedications}. The new display order. */
    public function reorder(Request $request): JsonResponse
    {
        $me = $this->me($request);
        $ids = array_values(array_filter((array) $request->input('ids'), 'is_int'));
        $known = DB::table('dedications')->pluck('id')->map(fn ($v) => (int) $v)->all();
        if (count($ids) !== count($known) || array_diff($known, $ids)) {
            GameRules::fail(400, 'bad-order'); // must list every name exactly once
        }
        DB::transaction(function () use ($ids) {
            foreach ($ids as $i => $id) {
                DB::table('dedications')->where('id', $id)->update(['sort_order' => ($i + 1) * 10]);
            }
        });
        GameAdmins::log($me, 'dedication.reorder', null, ['ids' => $ids]);

        return $this->dedications();
    }

    /** DELETE /v1/admin/dedications/{id} -> 204 */
    public function deleteDedication(Request $request, int $id): Response
    {
        $me = $this->me($request);
        $row = DB::table('dedications')->find($id) ?? GameRules::fail(404, 'not-found');
        DB::table('dedications')->where('id', $row->id)->delete();
        GameAdmins::log($me, 'dedication.delete', (string) $row->id, ['names' => json_decode($row->names, true)]);

        return response()->noContent();
    }

    /** GET /v1/admin/log -> {log} — the latest 200 actions. */
    public function log(): JsonResponse
    {
        $rows = DB::table('game_admin_log')->orderByDesc('id')->limit(200)->get();

        return response()->json(['log' => $rows->map(fn ($r) => [
            'id' => (int) $r->id,
            'admin' => $r->admin_email,
            'action' => $r->action,
            'target' => $r->target,
            'details' => $r->details === null ? null : json_decode($r->details, true),
            'at' => (string) $r->created_at,
        ])->all()]);
    }

    // ---- helpers ------------------------------------------------------------

    private function me(Request $request): GameUser
    {
        return $request->attributes->get('gameUser');
    }

    /** The account an admin acts on, after the guard rails above. */
    private function target(GameUser $me, int $id): GameUser
    {
        $user = GameUser::find($id) ?? GameRules::fail(404, 'not-found');
        if ($user->id === $me->id) {
            GameRules::fail(400, 'use-my-account'); // your own account: from "My account"
        }
        if (GameAdmins::isSuper($user->email)) {
            GameRules::fail(403, 'super-admin');
        }
        if (GameAdmins::isAdminEmail($user->email) && ! GameAdmins::isSuperAdmin($me)) {
            GameRules::fail(403, 'super-admin-only');
        }

        return $user;
    }

    /** A player (not an admin) an admin may ban or edit. */
    private function player(GameUser $me, int $id): GameUser
    {
        $user = $this->target($me, $id);
        if (GameAdmins::isAdminEmail($user->email)) {
            GameRules::fail(403, 'is-admin');
        }

        return $user;
    }

    private function pendingRequest(int $id): object
    {
        $row = DB::table('dedication_requests')->find($id) ?? GameRules::fail(404, 'not-found');
        if ($row->status !== 'pending') {
            GameRules::fail(409, 'already-decided');
        }

        return $row;
    }

    private function adminRequest(int $id): array
    {
        $r = DB::table('dedication_requests as r')->leftJoin('game_users as u', 'u.id', '=', 'r.user_id')
            ->select('r.*', 'u.username', 'u.email')->where('r.id', $id)->first();

        return Dedications::request($r, true);
    }
}
