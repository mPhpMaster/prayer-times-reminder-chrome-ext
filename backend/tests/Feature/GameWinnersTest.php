<?php

namespace Tests\Feature;

use App\Models\GameUser;
use App\Support\GameAccounts;
use App\Support\GamePeriods;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Points are never reset; each ended month / quarter / half-year / year
 * crowns the player(s) with the most points earned in it (App\Support\GameWinners).
 */
class GameWinnersTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    private function now(string $when): void
    {
        Carbon::setTestNow(Carbon::parse($when, 'UTC'));
    }

    private function register(string $name): string
    {
        return $this->postJson('/v1/auth/register', [
            'email' => $name.'@example.com', 'password' => 'secret-pass-1', 'username' => $name,
        ])->assertCreated()->json('token');
    }

    private function as(string $token): static
    {
        return $this->withHeader('Authorization', "Bearer $token");
    }

    /** One finished task worth $points in the $prayer window of $day. */
    private function earn(string $token, string $day, int $points, string $item = 'tasbih-33', string $prayer = 'Dhuhr'): void
    {
        $doneAt = Carbon::parse("$day 13:00:00", 'UTC')->getTimestampMs();
        $this->as($token)->postJson('/v1/progress', ['completions' => [[
            'windowKey' => "$day:$prayer", 'itemId' => $item, 'kind' => 'task',
            'points' => $points, 'startedAt' => $doneAt - 60000, 'doneAt' => $doneAt,
        ]]])->assertOk();
    }

    public function test_period_keys_and_ranges(): void
    {
        $this->assertSame('2026-10', GamePeriods::key('month', '2026-10-08'));
        $this->assertSame('2026-Q4', GamePeriods::key('quarter', '2026-10-08'));
        $this->assertSame('2026-H2', GamePeriods::key('half', '2026-10-08'));
        $this->assertSame('2026', GamePeriods::key('year', '2026-10-08'));
        $this->assertSame(['2026-10-01', '2027-01-01'], GamePeriods::range('quarter', '2026-Q4'));
        $this->assertSame(['2026-07-01', '2027-01-01'], GamePeriods::range('half', '2026-H2'));
        $this->assertSame(['2026-12-01', '2027-01-01'], GamePeriods::range('month', '2026-12'));
        $this->assertSame('2027-01', GamePeriods::next('month', '2026-12'));
        $this->assertSame('2026-Q3', GamePeriods::previous('quarter', '2026-Q4'));
        $this->assertSame('2025-H2', GamePeriods::previous('half', '2026-H1'));
    }

    public function test_the_month_is_decided_after_the_grace_days_and_ties_all_win(): void
    {
        $this->now('2026-09-30 20:00:00');
        $ta = $this->register('amina');
        $tb = $this->register('bilal');
        $tc = $this->register('carim');
        $this->earn($ta, '2026-09-29', 50);
        $this->earn($tb, '2026-09-30', 50);
        $this->earn($tc, '2026-09-30', 20);

        // October 2: still within the grace days — nothing decided yet.
        $this->now('2026-10-02 12:00:00');
        $this->as($ta)->getJson('/v1/leaderboard?period=month&today=2026-10-02')
            ->assertOk()->assertJsonPath('winners.month', null);

        // October 3: September is decided; the two tied players both win.
        $this->now('2026-10-03 00:30:00');
        $res = $this->as($tc)->getJson('/v1/leaderboard?period=month&today=2026-10-03')->assertOk();
        $res->assertJsonPath('winners.month.key', '2026-09');
        $this->assertSame(['amina', 'bilal'], collect($res->json('winners.month.winners'))->pluck('username')->all());
        $this->assertSame([50, 50], collect($res->json('winners.month.winners'))->pluck('points')->all());
        // The quarter (Q3) ended on Sep 30 too: same winners.
        $res->assertJsonPath('winners.quarter.key', '2026-Q3');
        $res->assertJsonPath('winners.year', null); // 2026 hasn't ended

        // A late sync of September points no longer changes the result.
        $this->earn($tc, '2026-09-28', 100, 'tahmid-33');
        $after = $this->as($tc)->getJson('/v1/leaderboard?period=month&today=2026-10-03');
        $this->assertSame(['amina', 'bilal'], collect($after->json('winners.month.winners'))->pluck('username')->all());

        // Profiles: counts by type and "won last month".
        $this->as($tc)->getJson('/v1/users/amina')->assertOk()
            ->assertJsonPath('wins.month', 1)->assertJsonPath('wins.quarter', 1)
            ->assertJsonPath('wins.total', 2)->assertJsonPath('wins.lastMonth', true);
        $this->as($ta)->getJson('/v1/users/carim')->assertJsonPath('wins.total', 0)->assertJsonPath('wins.lastMonth', false);
    }

    public function test_a_hidden_player_can_win_but_their_points_stay_hidden(): void
    {
        $this->now('2026-09-30 20:00:00');
        $th = $this->register('hidden');
        $tv = $this->register('visible');
        $this->earn($th, '2026-09-30', 90);
        $this->earn($tv, '2026-09-30', 40);
        $this->as($th)->patchJson('/v1/me', ['hideProgress' => true])->assertOk();

        $this->now('2026-10-05 08:00:00');
        $res = $this->as($tv)->getJson('/v1/leaderboard?period=month&today=2026-10-05');
        $res->assertJsonPath('winners.month.winners.0.username', 'hidden')
            ->assertJsonPath('winners.month.winners.0.hideProgress', true)
            ->assertJsonPath('winners.month.winners.0.points', null);
        // The board itself still never lists a hidden player.
        $this->assertNotContains('hidden', collect($res->json('rows'))->pluck('username')->all());
        // Their prizes are public; their points and stats are not.
        $this->as($tv)->getJson('/v1/users/hidden')
            ->assertJsonPath('wins.month', 1)->assertJsonPath('points', null)->assertJsonPath('stats', null);
    }

    public function test_nobody_wins_a_period_without_points_and_past_periods_are_backfilled(): void
    {
        $this->now('2027-06-15 20:00:00');
        $ta = $this->register('amina');
        $this->earn($ta, '2027-06-15', 30);

        // July 3: June, Q2 and H1 are all decided on the first request; July and later aren't.
        $this->now('2027-07-03 12:00:00');
        $this->as($ta)->getJson('/v1/leaderboard?period=all')->assertOk()
            ->assertJsonPath('winners.month.key', '2027-06')
            ->assertJsonPath('winners.quarter.key', '2027-Q2')
            ->assertJsonPath('winners.half.key', '2027-H1')
            ->assertJsonPath('winners.half.winners.0.username', 'amina')
            ->assertJsonPath('winners.year', null);

        // August 5: July had no points — decided, but with no winner.
        $this->now('2027-08-05 12:00:00');
        $this->as($ta)->getJson('/v1/leaderboard?period=all')
            ->assertJsonPath('winners.month.key', '2027-07')
            ->assertJsonPath('winners.month.winners', []);
        $this->assertSame(1, DB::table('game_settled_periods')->where(['period_type' => 'month', 'period_key' => '2027-07'])->count());
        $this->as($ta)->getJson('/v1/users/amina')->assertJsonPath('wins.lastMonth', false)->assertJsonPath('wins.month', 1);
    }

    public function test_the_board_ranks_all_time_points_or_the_current_period(): void
    {
        $this->now('2026-10-08 20:00:00');
        $ta = $this->register('amina');
        $tb = $this->register('bilal');
        $this->earn($ta, '2026-09-10', 100);              // last month
        $this->earn($tb, '2026-10-07', 60);               // this month
        $this->earn($ta, '2026-10-08', 10, 'tahmid-33');  // this month

        $names = fn ($res) => collect($res->json('rows'))->map(fn ($r) => $r['username'].':'.$r['points'])->all();

        $all = $this->as($ta)->getJson('/v1/leaderboard?period=all')->assertJsonPath('periodKey', null);
        $this->assertSame(['amina:110', 'bilal:60'], $names($all));
        $all->assertJsonPath('me.points', 110);

        $month = $this->as($ta)->getJson('/v1/leaderboard?period=month&today=2026-10-08')->assertJsonPath('periodKey', '2026-10');
        $this->assertSame(['bilal:60', 'amina:10'], $names($month));

        $this->as($ta)->getJson('/v1/leaderboard?period=quarter&today=2026-10-08')->assertJsonPath('periodKey', '2026-Q4');
        $year = $this->as($ta)->getJson('/v1/leaderboard?period=year&today=2026-10-08')->assertJsonPath('periodKey', '2026');
        $this->assertSame(['amina:110', 'bilal:60'], $names($year));

        // Older apps send only `month`.
        $old = $this->as($ta)->getJson('/v1/leaderboard?month=2026-09')->assertJsonPath('month', '2026-09')->assertJsonPath('period', 'month');
        $this->assertSame(['amina:100'], $names($old));
    }

    public function test_gift_rows_from_older_apps_earn_nothing(): void
    {
        $this->now('2026-10-08 20:00:00');
        $ta = $this->register('amina');
        $doneAt = Carbon::parse('2026-10-08 13:00:00', 'UTC')->getTimestampMs();
        $this->as($ta)->postJson('/v1/progress', ['completions' => [[
            'windowKey' => '2026-10-08:Dhuhr', 'itemId' => 'afw-afiya', 'kind' => 'gift',
            'points' => 100, 'startedAt' => $doneAt - 60000, 'doneAt' => $doneAt,
        ]]])->assertOk()->assertJson(['accepted' => 0]);
        $this->as($ta)->getJson('/v1/leaderboard?period=all')->assertJsonPath('me.points', 0);
    }

    public function test_merging_accounts_keeps_prizes_and_deleting_removes_them(): void
    {
        $this->now('2026-09-30 20:00:00');
        $ta = $this->register('amina');
        $this->register('other');
        $this->earn($ta, '2026-09-30', 70);
        $this->now('2026-10-04 00:00:00');
        $this->as($ta)->getJson('/v1/leaderboard?period=all')->assertOk(); // decides September

        $from = GameUser::findByUsername('amina');
        $into = GameUser::findByUsername('other');
        GameAccounts::absorb($into, $from);
        $this->assertSame(2, DB::table('game_period_winners')->where('user_id', $into->id)->count()); // month + quarter

        GameAccounts::deleteUser($into);
        $this->assertSame(0, DB::table('game_period_winners')->count());
    }
}
