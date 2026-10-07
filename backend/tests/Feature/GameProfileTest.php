<?php

namespace Tests\Feature;

use App\Models\GameUser;
use App\Support\GameAccounts;
use App\Support\GameStats;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Player profiles with real statistics, and achievements that are awarded
 * exactly once however often the same data arrives (App\Support\GameStats).
 */
class GameProfileTest extends TestCase
{
    use RefreshDatabase;

    private const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-09-30 20:00:00', 'UTC'));
        $this->withoutMiddleware(ThrottleRequests::class);
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

    private static function at(string $day, int $hour, int $minute = 0): int
    {
        return Carbon::parse("$day $hour:$minute:00", 'UTC')->getTimestampMs();
    }

    private static function row(string $key, string $item, int $points, int $doneAt, string $kind = 'task'): array
    {
        return ['windowKey' => $key, 'itemId' => $item, 'kind' => $kind, 'points' => $points,
            'startedAt' => $doneAt - 60000, 'doneAt' => $doneAt];
    }

    /**
     * Every task of a window (10 points each), finished from $hour on, plus the
     * gift row an older app still sends — the server now drops it (no points).
     */
    private static function fullWindow(string $day, string $prayer, int $hour): array
    {
        $key = "$day:$prayer";
        $rows = [];
        for ($i = 0; $i < GameStats::WINDOW_TASK_COUNT[$prayer]; $i++) {
            $rows[] = self::row($key, "t$i", 10, self::at($day, $hour, $i));
        }
        $rows[] = self::row($key, 'gift-x', 10, self::at($day, $hour, 30), 'gift');

        return $rows;
    }

    private function push(string $token, array $rows)
    {
        return $this->as($token)->postJson('/v1/progress', ['completions' => $rows])->assertOk();
    }

    public function test_achievements_are_awarded_once_however_often_the_data_is_resent(): void
    {
        $t = $this->register('ali');
        $first = [self::row('2026-09-28:Dhuhr', 'tasbih-33', 20, self::at('2026-09-28', 13))];

        $this->push($t, $first)->assertJson(['accepted' => 1, 'newAchievements' => ['first-task']]);
        // The same batch again (lost ack, app retry): nothing new, no second row.
        $this->push($t, $first)->assertJson(['accepted' => 0, 'newAchievements' => []]);
        // More progress that earns nothing new also reports nothing new.
        $this->push($t, [self::row('2026-09-28:Dhuhr', 'tahmid-33', 20, self::at('2026-09-28', 13, 5))])
            ->assertJson(['accepted' => 1, 'newAchievements' => []]);

        $id = GameUser::findByUsername('ali')->id;
        $this->assertSame(1, DB::table('game_achievements')->where('user_id', $id)->count());
        // Awarding again directly (e.g. a profile view) is a no-op too.
        $this->assertSame([], GameStats::award($id));
        $this->assertSame(1, DB::table('game_achievements')->where('user_id', $id)->count());
    }

    public function test_achievements_are_dated_by_the_completion_that_earned_them(): void
    {
        $t = $this->register('sara');
        $day = '2026-09-28';
        $rows = [];
        foreach (self::PRAYERS as $i => $p) {
            $rows = array_merge($rows, self::fullWindow($day, $p, 5 + 3 * $i));
        }
        $new = $this->push($t, $rows)->json('newAchievements');
        // No first-gift: gift rows from older apps are dropped.
        $this->assertSame(['first-task', 'first-window', 'full-day'], $new);

        $ach = collect($this->as($t)->getJson('/v1/users/sara')->json('achievements'))->pluck('earnedAt', 'id');
        $this->assertSame(self::at($day, 5, 0), $ach['first-task']);
        // Fajr's 11th task completes the window.
        $this->assertSame(self::at($day, 5, 10), $ach['first-window']);
        $this->assertArrayNotHasKey('first-gift', $ach->all());
        // The day is full when its last window (Isha, 17:00) is complete.
        $this->assertSame(self::at($day, 17, 8), $ach['full-day']);
    }

    public function test_streaks_follow_the_players_own_dates(): void
    {
        $t = $this->register('omar');
        $rows = [];
        foreach (['2026-09-26', '2026-09-27', '2026-09-28', '2026-09-30'] as $d) {
            $rows[] = self::row("$d:Asr", 'tasbih-33', 20, self::at($d, 16));
        }
        $this->push($t, $rows)->assertJson(['newAchievements' => ['first-task', 'streak-3']]);

        $stats = $this->as($t)->getJson('/v1/users/omar?today=2026-09-30')->assertOk()->json('stats');
        $this->assertSame(['activeDays' => 4, 'currentStreak' => 1, 'bestStreak' => 3],
            array_intersect_key($stats, array_flip(['activeDays', 'currentStreak', 'bestStreak'])));
        // Seen from two days later the streak is broken.
        $this->assertSame(0, $this->as($t)->getJson('/v1/users/omar?today=2026-10-02')->json('stats.currentStreak'));
        $this->as($t)->getJson('/v1/users/omar?today=2026-13-40')->assertStatus(400)->assertJson(['error' => 'bad-day']);
    }

    public function test_profile_stats_are_real_and_hidden_progress_hides_them_from_others(): void
    {
        $ta = $this->register('amina');
        $tb = $this->register('bilal');
        $this->push($ta, array_merge(
            self::fullWindow('2026-09-29', 'Dhuhr', 13),
            [self::row('2026-08-31:Isha', 'tasbih-33', 40, self::at('2026-08-31', 21))],
        ));
        $this->as($tb)->putJson('/v1/follows/amina')->assertOk();

        $p = $this->as($tb)->getJson('/v1/users/amina?month=2026-09')->assertOk();
        $p->assertJsonPath('self', false)->assertJsonPath('following', true)
            ->assertJsonPath('followers', 1)->assertJsonPath('followingCount', 0)
            ->assertJsonPath('joined', '2026-09')
            ->assertJsonPath('points', 90) // September only (the gift row earns nothing)
            ->assertJsonPath('stats.totalPoints', 130)
            ->assertJsonPath('stats.tasks', 10)
            ->assertJsonPath('stats.gifts', 0)
            ->assertJsonPath('stats.windows', 1)
            ->assertJsonPath('stats.fullDays', 0)
            ->assertJsonPath('stats.lastActive', '2026-09-29');

        $this->as($ta)->patchJson('/v1/me', ['hideProgress' => true])->assertOk();
        $this->as($tb)->getJson('/v1/users/amina')
            ->assertJsonPath('points', null)->assertJsonPath('stats', null)->assertJsonPath('achievements', null)
            ->assertJsonPath('followers', 1)->assertJsonPath('following', true);
        // The player still sees their own.
        $this->as($ta)->getJson('/v1/users/amina')->assertJsonPath('self', true)->assertJsonPath('stats.totalPoints', 130);
    }

    public function test_a_merge_stores_each_achievement_once_dated_by_the_earliest_finish(): void
    {
        $main = $this->register('huda');
        $this->push($main, [self::row('2026-09-29:Fajr', 'tasbih-33', 20, self::at('2026-09-29', 5))]);

        $old = GameAccounts::issueToken(GameUser::create(['username' => 'oldhuda', 'username_lower' => 'oldhuda']));
        $this->push($old, [self::row('2026-09-27:Fajr', 'tahmid-33', 20, self::at('2026-09-27', 5))]);

        $t = $this->postJson('/v1/auth/login', ['email' => 'huda@example.com', 'password' => 'secret-pass-1', 'legacyToken' => $old])
            ->assertOk()->json('token');

        $id = GameUser::findByUsername('huda')->id;
        $this->assertSame(1, DB::table('game_achievements')->where('user_id', $id)->where('achievement_id', 'first-task')->count());
        $this->assertSame(self::at('2026-09-27', 5), (int) DB::table('game_achievements')->where('user_id', $id)->value('earned_at'));
        $this->assertSame(0, DB::table('game_achievements')->whereNotIn('user_id', GameUser::pluck('id'))->count());
        $this->push($t, [self::row('2026-09-27:Fajr', 'tahmid-33', 20, self::at('2026-09-27', 5))])
            ->assertJson(['accepted' => 0, 'newAchievements' => []]);
    }

    public function test_deleting_an_account_removes_its_achievements(): void
    {
        $t = $this->register('zaid');
        $this->push($t, [self::row('2026-09-29:Asr', 'tasbih-33', 20, self::at('2026-09-29', 16))]);
        $this->assertSame(1, DB::table('game_achievements')->count());
        $this->as($t)->deleteJson('/v1/me')->assertNoContent();
        $this->assertSame(0, DB::table('game_achievements')->count());
    }
}
