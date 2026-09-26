<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * The game API contract the Android app relies on (core/logic/game-sync.js).
 * Runs on SQLite in memory (phpunit.xml); the same tests pass on MySQL or
 * PostgreSQL by pointing DB_CONNECTION at one.
 */
class GameApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-09-25 12:00:00', 'UTC'));
    }

    private function register(string $name): string
    {
        $res = $this->postJson('/v1/register', ['username' => $name])->assertCreated();

        return $res->json('token');
    }

    private function as(string $token): static
    {
        return $this->withHeader('Authorization', "Bearer $token");
    }

    private static function done(string $key, string $item, int $points, string $kind = 'task'): array
    {
        $now = (int) now()->getTimestampMs();

        return ['windowKey' => $key, 'itemId' => $item, 'kind' => $kind, 'points' => $points,
            'startedAt' => $now - 60000, 'doneAt' => $now - 1000];
    }

    public function test_register_accepts_arabic_and_rejects_duplicates_and_bad_names(): void
    {
        $token = $this->register('أحمد_1');
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $token);
        $this->postJson('/v1/register', ['username' => 'Ahmed'])->assertCreated();
        $this->postJson('/v1/register', ['username' => 'AHMED'])->assertStatus(409)->assertJson(['error' => 'username-taken']);
        $this->postJson('/v1/register', ['username' => 'a b'])->assertStatus(400)->assertJson(['error' => 'bad-username']);
        $this->postJson('/v1/register', ['username' => 'ab'])->assertStatus(400);
        $this->assertDatabaseMissing('game_users', ['token_hash' => $token]); // only the hash is stored
    }

    public function test_missing_or_wrong_token_is_401(): void
    {
        $this->getJson('/v1/me')->assertStatus(401)->assertJson(['error' => 'unauthorized']);
        $this->as(str_repeat('0', 64))->getJson('/v1/me')->assertStatus(401);
    }

    public function test_progress_sync_is_idempotent_first_write_wins_and_capped(): void
    {
        $t = $this->register('syncer');
        $rows = [self::done('2026-09-25:Dhuhr', 'tasbih-33', 27), self::done('2026-09-25:Dhuhr', 'istighfar-salam', 27)];
        $this->as($t)->postJson('/v1/progress', ['completions' => $rows])->assertJson(['accepted' => 2]);
        $this->as($t)->postJson('/v1/progress', ['completions' => $rows])->assertJson(['accepted' => 0]);
        $this->as($t)->postJson('/v1/progress', ['completions' => [self::done('2026-09-25:Dhuhr', 'tasbih-33', 300)]]);

        $bad = [
            self::done('2026-09-25:Dhuhr', 'x1', 301),
            self::done('2026-09-25:Dhuhr', 'g1', 101, 'gift'),
            ['doneAt' => (int) now()->getTimestampMs() + 3600000] + self::done('2026-09-25:Dhuhr', 'x2', 5),
            self::done('2026-09-25:Lunch', 'x3', 5),
        ];
        $this->as($t)->postJson('/v1/progress', ['completions' => $bad])->assertJson(['accepted' => 0]);

        $flood = array_map(fn ($i) => self::done('2026-09-25:Asr', "t$i", 100), range(0, 19));
        $this->as($t)->postJson('/v1/progress', ['completions' => array_slice($flood, 0, 3)]);
        $this->as($t)->postJson('/v1/progress', ['completions' => array_slice($flood, 3)]);

        $mine = collect($this->as($t)->getJson('/v1/progress?month=2026-09')->json('completions'));
        $this->assertSame(400, $mine->where('windowKey', '2026-09-25:Asr')->sum('points'));
        $this->assertSame(27, $mine->firstWhere('itemId', 'tasbih-33')['points']);
    }

    public function test_leaderboard_is_monthly_scoped_and_respects_hidden_progress(): void
    {
        $ta = $this->register('player_a');
        $tb = $this->register('player_b');
        $tc = $this->register('player_c');
        Carbon::setTestNow(Carbon::parse('2026-10-01 06:00:00', 'UTC'));
        $key = '2026-10-01:Fajr';
        $this->as($ta)->postJson('/v1/progress', ['completions' => [self::done($key, 't1', 50)]]);
        $this->as($tb)->postJson('/v1/progress', ['completions' => [self::done($key, 't1', 80)]]);
        $this->as($tc)->postJson('/v1/progress', ['completions' => [self::done($key, 't1', 99)]]);
        // Last month's points don't count this month.
        $this->as($ta)->postJson('/v1/progress', ['completions' => [self::done('2026-09-30:Isha', 't1', 70)]]);

        $all = $this->as($ta)->getJson('/v1/leaderboard?month=2026-10')->assertOk();
        $this->assertSame(['player_c', 'player_b', 'player_a'], array_column($all->json('rows'), 'username'));
        $this->assertSame(50, $all->json('me.points'));

        $this->as($ta)->putJson('/v1/follows/player_b')->assertOk();
        $fol = $this->as($ta)->getJson('/v1/leaderboard?month=2026-10&scope=following');
        $this->assertSame(['player_b', 'player_a'], array_column($fol->json('rows'), 'username'));

        $this->as($tb)->patchJson('/v1/me', ['hideProgress' => true])->assertJson(['user' => ['hideProgress' => true]]);
        $after = $this->as($ta)->getJson('/v1/leaderboard?month=2026-10&scope=following');
        $this->assertSame(['player_a'], array_column($after->json('rows'), 'username'));
        $this->as($ta)->getJson('/v1/users/player_b?month=2026-10')->assertJson(['points' => null, 'following' => true]);
        $this->as($tb)->getJson('/v1/users/player_b?month=2026-10')->assertJson(['points' => 80]);

        $this->as($ta)->putJson('/v1/follows/player_a')->assertStatus(400);
        $this->as($ta)->deleteJson('/v1/follows/player_b')->assertOk();
        $this->as($ta)->getJson('/v1/follows')->assertExactJson(['users' => []]);
        $this->as($ta)->getJson('/v1/users/nobody_here')->assertStatus(404)->assertJson(['error' => 'no-such-user']);
    }

    public function test_user_search_by_prefix(): void
    {
        $t = $this->register('zz_first');
        $this->register('zz_second');
        $this->register('other');
        $names = array_column($this->as($t)->getJson('/v1/users?q=zz')->json('users'), 'username');
        $this->assertSame(['zz_first', 'zz_second'], $names);
        $this->as($t)->getJson('/v1/users?q=z')->assertExactJson(['users' => []]);
    }

    public function test_delete_account_removes_the_user_their_progress_and_follows(): void
    {
        $ta = $this->register('leaver');
        $tb = $this->register('stayer');
        $this->as($ta)->postJson('/v1/progress', ['completions' => [self::done('2026-09-25:Dhuhr', 't1', 10)]]);
        $this->as($ta)->putJson('/v1/follows/stayer')->assertOk();
        $this->as($tb)->putJson('/v1/follows/leaver')->assertOk();

        $this->as($ta)->deleteJson('/v1/me')->assertNoContent();

        $this->assertDatabaseMissing('game_users', ['username' => 'leaver']);
        $this->assertDatabaseCount('game_completions', 0);
        $this->assertDatabaseCount('game_follows', 0);
        $this->as($ta)->getJson('/v1/me')->assertStatus(401); // the token is dead
        $this->as($tb)->getJson('/v1/follows')->assertExactJson(['users' => []]);
        $this->postJson('/v1/register', ['username' => 'leaver'])->assertCreated(); // the name is free again
    }

    public function test_unknown_v1_path_is_json_404(): void
    {
        $this->getJson('/v1/nope')->assertStatus(404)->assertJson(['error' => 'not-found']);
    }
}
