<?php

namespace Tests\Feature;

use App\Models\GameUser;
use App\Support\GameAccounts;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Sign-in: email + password, Google, password reset, sign-out, and linking a
 * legacy name-only account without losing or doubling its points.
 */
class GameAuthTest extends TestCase
{
    use RefreshDatabase;

    private const CLIENT = 'test-web-client.apps.googleusercontent.com';

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-09-25 12:00:00', 'UTC'));
        $this->withoutMiddleware(ThrottleRequests::class);
        config(['mail.default' => 'array', 'services.google.client_id' => self::CLIENT]);
    }

    private function as(string $token): static
    {
        return $this->withHeader('Authorization', "Bearer $token");
    }

    private function signUp(string $email, string $name, string $password = 'secret-pass-1', array $extra = [])
    {
        return $this->postJson('/v1/auth/register', ['email' => $email, 'password' => $password, 'username' => $name] + $extra);
    }

    private static function done(string $key, string $item, int $points, int $doneAt = 0): array
    {
        $now = (int) now()->getTimestampMs();

        return ['windowKey' => $key, 'itemId' => $item, 'kind' => 'task', 'points' => $points,
            'startedAt' => ($doneAt ?: $now) - 60000, 'doneAt' => $doneAt ?: $now - 1000];
    }

    /** A pre-sign-in account: a name and a token, no email, no Google. */
    private function legacy(string $name): string
    {
        $u = GameUser::create(['username' => $name, 'username_lower' => mb_strtolower($name)]);

        return GameAccounts::issueToken($u);
    }

    private function sentMails(): array
    {
        return app('mailer')->getSymfonyTransport()->messages()->all();
    }

    private function fakeGoogle(array $claims): void
    {
        Http::fake(['oauth2.googleapis.com/*' => Http::response($claims + [
            'iss' => 'https://accounts.google.com', 'aud' => self::CLIENT, 'exp' => (string) (now()->getTimestamp() + 3600),
            'email_verified' => 'true',
        ])]);
    }

    // ---- email + password ---------------------------------------------------

    public function test_sign_up_stores_only_a_bcrypt_hash_and_returns_private_profile(): void
    {
        $res = $this->signUp('Sara@Example.com', 'sara')->assertCreated();
        $res->assertJsonPath('user.email', 'sara@example.com')->assertJsonPath('user.hasPassword', true)
            ->assertJsonPath('user.legacy', false)->assertJsonMissingPath('user.password');
        $hash = DB::table('game_users')->value('password');
        $this->assertStringStartsWith('$2y$', $hash);
        $this->assertStringNotContainsString('secret-pass-1', $hash);
        $this->as($res->json('token'))->getJson('/v1/me')->assertJsonPath('user.username', 'sara');
    }

    public function test_sign_up_validation(): void
    {
        $this->signUp('not-an-email', 'aaa')->assertStatus(400)->assertJson(['error' => 'bad-email']);
        $this->signUp('a@example.com', 'aaa', 'short')->assertStatus(400)->assertJson(['error' => 'weak-password']);
        $this->signUp('a@example.com', 'aaa')->assertCreated();
        $this->signUp('A@EXAMPLE.com', 'bbb')->assertStatus(409)->assertJson(['error' => 'email-taken']);
        $this->signUp('b@example.com', 'AAA')->assertStatus(409)->assertJson(['error' => 'username-taken']);
    }

    public function test_login_is_by_email_not_username_and_wrong_password_is_generic(): void
    {
        $this->signUp('sara@example.com', 'sara');
        $this->postJson('/v1/auth/login', ['email' => 'SARA@example.com', 'password' => 'secret-pass-1'])->assertOk()->assertJsonStructure(['token']);
        $this->postJson('/v1/auth/login', ['email' => 'sara', 'password' => 'secret-pass-1'])->assertStatus(401)->assertJson(['error' => 'bad-credentials']);
        $this->postJson('/v1/auth/login', ['email' => 'sara@example.com', 'password' => 'wrong-pass-1'])->assertStatus(401)->assertJson(['error' => 'bad-credentials']);
        $this->postJson('/v1/auth/login', ['email' => 'nobody@example.com', 'password' => 'secret-pass-1'])->assertStatus(401)->assertJson(['error' => 'bad-credentials']);
    }

    public function test_each_device_gets_its_own_token_and_logout_revokes_only_that_one(): void
    {
        $phone = $this->signUp('sara@example.com', 'sara')->json('token');
        $tablet = $this->postJson('/v1/auth/login', ['email' => 'sara@example.com', 'password' => 'secret-pass-1'])->json('token');
        $this->assertNotSame($phone, $tablet);
        $this->as($phone)->postJson('/v1/auth/logout')->assertNoContent();
        $this->as($phone)->getJson('/v1/me')->assertStatus(401);
        $this->as($tablet)->getJson('/v1/me')->assertOk();
    }

    // ---- password reset -----------------------------------------------------

    private function requestCode(string $email): ?string
    {
        $this->postJson('/v1/auth/forgot', ['email' => $email])->assertNoContent();
        $mails = $this->sentMails();
        if (! $mails) {
            return null;
        }
        preg_match('/\b(\d{6})\b/', end($mails)->getOriginalMessage()->getTextBody(), $m);

        return $m[1] ?? null;
    }

    public function test_forgot_does_not_reveal_unknown_emails(): void
    {
        $this->assertNull($this->requestCode('ghost@example.com'));
        $this->assertDatabaseCount('game_password_resets', 0);
    }

    public function test_reset_with_emailed_code_sets_new_password_and_signs_out_other_devices(): void
    {
        $old = $this->signUp('sara@example.com', 'sara')->json('token');
        $code = $this->requestCode('sara@example.com');
        $this->assertMatchesRegularExpression('/^\d{6}$/', $code);
        $this->assertNotSame($code, DB::table('game_password_resets')->value('code_hash')); // hashed at rest

        $wrong = $code === '000000' ? '111111' : '000000';
        $this->postJson('/v1/auth/reset', ['email' => 'sara@example.com', 'code' => $wrong, 'password' => 'new-pass-123'])->assertStatus(400)->assertJson(['error' => 'bad-code']);
        $new = $this->postJson('/v1/auth/reset', ['email' => 'sara@example.com', 'code' => $code, 'password' => 'new-pass-123'])->assertOk()->json('token');

        $this->as($old)->getJson('/v1/me')->assertStatus(401);
        $this->as($new)->getJson('/v1/me')->assertOk();
        $this->postJson('/v1/auth/login', ['email' => 'sara@example.com', 'password' => 'new-pass-123'])->assertOk();
        $this->postJson('/v1/auth/reset', ['email' => 'sara@example.com', 'code' => $code, 'password' => 'again-pass-1'])->assertStatus(400); // single use
    }

    public function test_reset_code_expires_and_has_an_attempt_cap(): void
    {
        $this->signUp('sara@example.com', 'sara');
        $code = $this->requestCode('sara@example.com');
        $wrong = $code === '000000' ? '111111' : '000000';
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/v1/auth/reset', ['email' => 'sara@example.com', 'code' => $wrong, 'password' => 'new-pass-123']);
        }
        $this->postJson('/v1/auth/reset', ['email' => 'sara@example.com', 'code' => $code, 'password' => 'new-pass-123'])->assertStatus(429);

        $code = $this->requestCode('sara@example.com'); // a new code resets the counter
        Carbon::setTestNow(now()->addMinutes(16));
        $this->postJson('/v1/auth/reset', ['email' => 'sara@example.com', 'code' => $code, 'password' => 'new-pass-123'])->assertStatus(400)->assertJson(['error' => 'code-expired']);
    }

    // ---- Google -------------------------------------------------------------

    public function test_config_exposes_only_the_public_client_id(): void
    {
        $this->getJson('/v1/auth/config')->assertExactJson(['google' => ['clientId' => self::CLIENT]]);
        config(['services.google.client_id' => null]);
        $this->getJson('/v1/auth/config')->assertExactJson(['google' => null]);
        $this->postJson('/v1/auth/google', ['idToken' => 'x'])->assertStatus(503)->assertJson(['error' => 'google-unavailable']);
    }

    public function test_google_new_player_is_asked_for_a_public_name_then_signs_in_again_as_the_same_user(): void
    {
        $this->fakeGoogle(['sub' => 'g-123', 'email' => 'Sara@Gmail.com']);
        $this->postJson('/v1/auth/google', ['idToken' => 'tok'])->assertStatus(422)->assertJson(['error' => 'username-required']);
        $this->postJson('/v1/auth/google', ['idToken' => 'tok', 'username' => 'sara'])->assertCreated()
            ->assertJsonPath('user.google', true)->assertJsonPath('user.hasPassword', false)->assertJsonPath('user.email', 'sara@gmail.com');
        $this->postJson('/v1/auth/google', ['idToken' => 'tok'])->assertOk()->assertJsonPath('user.username', 'sara');
        $this->assertDatabaseCount('game_users', 1);
    }

    public function test_google_rejects_tokens_for_another_app_expired_or_unverified(): void
    {
        foreach ([['aud' => 'someone-else'], ['exp' => '1'], ['email_verified' => 'false']] as $bad) {
            Http::fake(['oauth2.googleapis.com/*' => Http::response($bad + [
                'iss' => 'https://accounts.google.com', 'aud' => self::CLIENT, 'exp' => (string) (now()->getTimestamp() + 3600),
                'email_verified' => 'true', 'sub' => 'g-1', 'email' => 'x@gmail.com',
            ])]);
            $this->postJson('/v1/auth/google', ['idToken' => 'tok', 'username' => 'xxx'])->assertStatus(401)->assertJson(['error' => 'google-invalid']);
        }
        Http::fake(['oauth2.googleapis.com/*' => Http::response(['error' => 'invalid_token'], 400)]);
        $this->postJson('/v1/auth/google', ['idToken' => 'forged', 'username' => 'xxx'])->assertStatus(401);
        $this->assertDatabaseCount('game_users', 0);
    }

    public function test_google_with_the_same_verified_email_links_to_the_password_account(): void
    {
        $this->signUp('sara@gmail.com', 'sara');
        $this->fakeGoogle(['sub' => 'g-9', 'email' => 'sara@gmail.com']);
        $this->postJson('/v1/auth/google', ['idToken' => 'tok'])->assertOk()
            ->assertJsonPath('user.username', 'sara')->assertJsonPath('user.google', true)->assertJsonPath('user.hasPassword', true);
        $this->assertDatabaseCount('game_users', 1);
    }

    // ---- legacy name-only accounts ------------------------------------------

    public function test_legacy_account_upgrades_in_place_on_sign_up_keeping_name_points_and_follows(): void
    {
        $friend = $this->legacy('friend');
        $old = $this->legacy('oldname');
        $this->as($old)->postJson('/v1/progress', ['completions' => [self::done('2026-09-25:Dhuhr', 'tasbih-33', 58)]]);
        $this->as($friend)->putJson('/v1/follows/oldname')->assertOk();

        $res = $this->signUp('old@example.com', 'ignored', 'secret-pass-1', ['legacyToken' => $old])->assertCreated();
        $res->assertJsonPath('user.username', 'oldname')->assertJsonPath('user.legacy', false);
        $this->as($old)->getJson('/v1/me')->assertStatus(401); // the name-only token retires
        $this->as($res->json('token'))->getJson('/v1/leaderboard?month=2026-09')->assertJsonPath('me.points', 58);
        $this->assertSame(1, DB::table('game_follows')->count());
    }

    public function test_legacy_account_folds_into_an_existing_account_without_doubling_points(): void
    {
        $main = $this->signUp('sara@example.com', 'sara')->json('token');
        // The same tasbih was finished on both (e.g. synced twice) plus one item each.
        $this->as($main)->postJson('/v1/progress', ['completions' => [
            self::done('2026-09-25:Dhuhr', 'tasbih-33', 58), self::done('2026-09-25:Dhuhr', 'tahmid-33', 58),
        ]]);
        $old = $this->legacy('oldname');
        $this->as($old)->postJson('/v1/progress', ['completions' => [
            self::done('2026-09-25:Dhuhr', 'tasbih-33', 58), self::done('2026-09-25:Dhuhr', 'takbir-33', 57),
        ]]);

        $t = $this->postJson('/v1/auth/login', ['email' => 'sara@example.com', 'password' => 'secret-pass-1', 'legacyToken' => $old])->assertOk()->json('token');

        $this->as($t)->getJson('/v1/leaderboard?month=2026-09')->assertJsonPath('me.points', 58 + 58 + 57);
        $this->assertDatabaseMissing('game_users', ['username' => 'oldname']);
        $this->as($old)->getJson('/v1/me')->assertStatus(401);
        // The app then resends its whole local queue to the new account: nothing is counted twice.
        $this->as($t)->postJson('/v1/progress', ['completions' => [
            self::done('2026-09-25:Dhuhr', 'tasbih-33', 58), self::done('2026-09-25:Dhuhr', 'takbir-33', 57),
        ]])->assertJson(['accepted' => 0]);
        $this->as($t)->getJson('/v1/leaderboard?month=2026-09')->assertJsonPath('me.points', 173);
    }

    public function test_a_real_account_token_is_never_treated_as_legacy(): void
    {
        $a = $this->signUp('a@example.com', 'aaa')->json('token');
        $this->as($a)->postJson('/v1/progress', ['completions' => [self::done('2026-09-25:Dhuhr', 'tasbih-33', 58)]]);
        $this->signUp('b@example.com', 'bbb');
        $this->postJson('/v1/auth/login', ['email' => 'b@example.com', 'password' => 'secret-pass-1', 'legacyToken' => $a])->assertOk();
        $this->assertDatabaseHas('game_users', ['username' => 'aaa']); // not absorbed
        $this->as($a)->getJson('/v1/me')->assertOk();
    }

    public function test_delete_removes_tokens_and_reset_codes(): void
    {
        $t = $this->signUp('sara@example.com', 'sara')->json('token');
        $this->requestCode('sara@example.com');
        $this->as($t)->deleteJson('/v1/me')->assertNoContent();
        $this->assertDatabaseCount('game_tokens', 0);
        $this->assertDatabaseCount('game_password_resets', 0);
        $this->signUp('sara@example.com', 'sara')->assertCreated(); // email and name are free again
    }
}
