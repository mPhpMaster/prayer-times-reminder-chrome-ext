<?php

namespace App\Http\Controllers\Game;

use App\Http\Controllers\Controller;
use App\Support\GameRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProgressController extends Controller
{
    /**
     * POST /v1/progress {completions: [...]} -> {accepted}. Idempotent:
     * first write wins per (window, item), so the app can resend its queue
     * after a network failure. Window totals are capped across requests.
     * Location is never sent — windows are computed on the device.
     */
    public function store(Request $request): JsonResponse
    {
        $me = $request->attributes->get('gameUser');
        $rows = GameRules::completions($request->input('completions'), (int) now()->getTimestampMs());
        if (! $rows) {
            return response()->json(['accepted' => 0]);
        }

        $keys = array_values(array_unique(array_column($rows, 'windowKey')));
        $stored = DB::table('game_completions')->where('user_id', $me->id)->whereIn('window_key', $keys)
            ->get(['window_key', 'item_id', 'points']);
        $have = [];
        $totals = [];
        foreach ($stored as $s) {
            $have[$s->window_key.'|'.$s->item_id] = true;
            $totals[$s->window_key] = ($totals[$s->window_key] ?? 0) + $s->points;
        }

        $fresh = [];
        foreach ($rows as $r) {
            if (isset($have[$r['windowKey'].'|'.$r['itemId']])) {
                continue;
            }
            $t = ($totals[$r['windowKey']] ?? 0) + $r['points'];
            if ($t > GameRules::MAX_WINDOW_TOTAL) {
                continue;
            }
            $totals[$r['windowKey']] = $t;
            $have[$r['windowKey'].'|'.$r['itemId']] = true;
            $fresh[] = [
                'user_id' => $me->id,
                'window_key' => $r['windowKey'],
                'item_id' => $r['itemId'],
                'kind' => $r['kind'],
                'points' => $r['points'],
                'started_at' => $r['startedAt'],
                'done_at' => $r['doneAt'],
            ];
        }
        if ($fresh) {
            DB::table('game_completions')->insertOrIgnore($fresh);
        }

        return response()->json(['accepted' => count($fresh)]);
    }

    /** GET /v1/progress?month=YYYY-MM -> {completions} (own progress only). */
    public function index(Request $request): JsonResponse
    {
        $me = $request->attributes->get('gameUser');
        $month = GameRules::month($request->query('month'), (int) now()->getTimestampMs());
        $rows = DB::table('game_completions')->where('user_id', $me->id)
            ->where('window_key', 'like', $month.'%')->orderBy('window_key')->get()
            ->map(fn ($r) => [
                'windowKey' => $r->window_key,
                'itemId' => $r->item_id,
                'kind' => $r->kind,
                'points' => (int) $r->points,
                'startedAt' => (int) $r->started_at,
                'doneAt' => (int) $r->done_at,
            ]);

        return response()->json(['completions' => $rows]);
    }
}
