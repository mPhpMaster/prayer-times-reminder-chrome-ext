<?php

namespace App\Http\Controllers\Game;

use App\Http\Controllers\Controller;
use App\Models\GameUser;
use App\Support\Dedications;
use App\Support\GameAdmins;
use App\Support\GameRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * The About page's dedication (sadaqah jariyah) names: the public list, and
 * signed-in players asking for a name to be added. Admins decide in
 * AdminController; the player follows the status here (no email is sent).
 */
class DedicationController extends Controller
{
    /** GET /v1/dedications -> {dedications: [{id, names}]}. Public, cacheable. */
    public function index(Request $request): JsonResponse
    {
        $list = Dedications::publicList();
        $etag = '"'.sha1(json_encode($list, JSON_UNESCAPED_UNICODE)).'"';
        if ($request->header('If-None-Match') === $etag) {
            return response()->json(null, 304)->setEtag(trim($etag, '"'));
        }

        return response()->json(['dedications' => $list])
            ->setEtag(trim($etag, '"'))
            ->header('Cache-Control', 'public, max-age=300');
    }

    /** GET /v1/dedications/requests -> {requests} — the signed-in player's own, newest first. */
    public function mine(Request $request): JsonResponse
    {
        $me = $request->attributes->get('gameUser');
        $rows = DB::table('dedication_requests')->where('user_id', $me->id)
            ->orderByDesc('id')->limit(50)->get();

        return response()->json(['requests' => $rows->map(fn ($r) => Dedications::request($r))->all()]);
    }

    /** POST /v1/dedications/requests {names: {lang: text}, note?} -> 201 {request}. */
    public function store(Request $request): JsonResponse
    {
        /** @var GameUser $me */
        $me = $request->attributes->get('gameUser');
        if ($me->isLegacy()) {
            GameRules::fail(403, 'sign-in-required'); // a name-only account can't be reached or held to account
        }
        $names = Dedications::names($request->input('names'));
        $note = Dedications::note($request->input('note'));
        $pending = DB::table('dedication_requests')->where('user_id', $me->id)->where('status', 'pending')->count();
        if ($pending >= Dedications::MAX_PENDING_PER_USER) {
            GameRules::fail(429, 'too-many-pending');
        }
        $now = now();
        $id = DB::table('dedication_requests')->insertGetId([
            'user_id' => $me->id,
            'names' => json_encode($names, JSON_UNESCAPED_UNICODE),
            'note' => $note,
            'status' => 'pending',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $this->notifyAdmins($me, $names, $note);

        return response()->json(['request' => Dedications::request(DB::table('dedication_requests')->find($id))], 201);
    }

    /** A short email to every admin; a mail failure never fails the request. */
    private function notifyAdmins(GameUser $from, array $names, ?string $note): void
    {
        $lines = [];
        foreach ($names as $lang => $text) {
            $lines[] = "  $lang: $text";
        }
        $body = "طلب جديد لإضافة اسم إلى صفحة «حول» من {$from->username}:\n".
            'New request to add a name to the About page from '.$from->username.":\n\n".
            implode("\n", $lines).
            ($note ? "\n\nملاحظة / Note: $note" : '').
            "\n\nافتح صفحة «الإدارة» في التطبيق للموافقة أو الرفض.\nOpen the Admin page in the app to approve or reject.";
        try {
            foreach (GameAdmins::emails() as $to) {
                Mail::raw($body, fn ($m) => $m->to($to)->subject('طلب إضافة اسم / Name request'));
            }
        } catch (Throwable $e) {
            Log::error('dedication request mail failed', ['error' => $e->getMessage()]);
        }
    }
}
