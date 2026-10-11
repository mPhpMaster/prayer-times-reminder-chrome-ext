<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** Play Integrity: challenge, Google's verdict, the "verified" mark and the admin view. */
class GameIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private string $keyFile;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-10-12 10:00:00', 'UTC'));
        $this->withoutMiddleware(ThrottleRequests::class);
        // A stand-in key file; the access token it would be traded for is
        // cached up front, and Google's decode endpoint is faked below.
        $this->keyFile = tempnam(sys_get_temp_dir(), 'pi');
        file_put_contents($this->keyFile, json_encode(['client_email' => 'checker@example.iam.gserviceaccount.com']));
        Cache::put('play-integrity-access-token', 'at', 3000);
        Http::fake(['playintegrity.googleapis.com/*' => fn () => is_int($this->google)
            ? Http::response(['error' => ['code' => $this->google]], $this->google)
            : Http::response(['tokenPayloadExternal' => $this->google])]);
        config([
            'services.play_integrity.credentials' => $this->keyFile,
            'services.play_integrity.project_number' => '115850105204',
            'services.play_integrity.package' => 'com.mphpmaster.prayer',
        ]);
    }

    protected function tearDown(): void
    {
        @unlink($this->keyFile);
        parent::tearDown();
    }

    private function register(string $name): string
    {
        return $this->postJson('/v1/auth/register', [
            'email' => "$name@example.com", 'password' => 'secret-pass-1', 'username' => $name,
        ])->assertCreated()->json('token');
    }

    private function as(string $token): static
    {
        return $this->withHeader('Authorization', "Bearer $token");
    }

    /** Google's decoded payload for a genuine Play install, with overrides. */
    private function payload(string $nonce, array $over = []): array
    {
        return array_replace_recursive([
            'requestDetails' => [
                'requestPackageName' => 'com.mphpmaster.prayer',
                'requestHash' => $nonce,
                'timestampMillis' => (string) now()->getTimestampMs(),
            ],
            'appIntegrity' => ['appRecognitionVerdict' => 'PLAY_RECOGNIZED'],
            'deviceIntegrity' => ['deviceRecognitionVerdict' => ['MEETS_DEVICE_INTEGRITY']],
            'accountDetails' => ['appLicensingVerdict' => 'LICENSED'],
        ], $over);
    }

    /** What the faked decodeIntegrityToken answers next: a payload, or an HTTP error status. */
    private array|int $google = 400;

    private function fakeGoogle(array|int $payload): void
    {
        $this->google = $payload;
    }

    private function check(string $token, callable $payload): \Illuminate\Testing\TestResponse
    {
        $c = $this->as($token)->getJson('/v1/integrity/challenge')->assertOk()
            ->assertJsonPath('projectNumber', '115850105204');
        $p = $payload($c->json('nonce'));
        $this->fakeGoogle($p);

        return $this->as($token)->postJson('/v1/integrity', ['token' => 'opaque-token']);
    }

    public function test_a_genuine_install_is_verified_and_shown_on_the_board(): void
    {
        $t = $this->register('amal');
        $this->check($t, fn ($n) => $this->payload($n))->assertOk()->assertJson(['verified' => true, 'detail' => '']);

        Http::assertSent(fn ($r) => str_contains($r->url(), 'com.mphpmaster.prayer:decodeIntegrityToken')
            && $r['integrity_token'] === 'opaque-token' && $r->hasHeader('Authorization', 'Bearer at'));
        $this->as($t)->getJson('/v1/me')->assertJsonPath('user.playVerified', true);

        $at = (int) now()->getTimestampMs() - 3600000;
        $this->as($t)->postJson('/v1/progress', ['completions' => [[
            'windowKey' => '2026-10-12:Dhuhr', 'itemId' => 'task-1', 'kind' => 'task', 'points' => 10,
            'startedAt' => $at - 1000, 'doneAt' => $at,
        ]]])->assertOk();
        $this->getJson('/v1/leaderboard?period=all')->assertOk()->assertJsonPath('rows.0.playVerified', true);

        // The mark lapses when the app hasn't checked in for 30 days.
        Carbon::setTestNow(now()->addDays(31));
        $this->as($t)->getJson('/v1/me')->assertJsonPath('user.playVerified', false);
    }

    public function test_a_modified_app_or_rooted_device_fails(): void
    {
        $t = $this->register('omar');
        $this->check($t, fn ($n) => $this->payload($n, [
            'appIntegrity' => ['appRecognitionVerdict' => 'UNRECOGNIZED_VERSION'],
            'deviceIntegrity' => ['deviceRecognitionVerdict' => null],
            'accountDetails' => ['appLicensingVerdict' => 'UNLICENSED'],
        ]))->assertOk()->assertJson([
            'verified' => false,
            'detail' => 'app:UNRECOGNIZED_VERSION device:NONE licence:UNLICENSED',
        ]);
        $this->as($t)->getJson('/v1/me')->assertJsonPath('user.playVerified', false);
    }

    public function test_the_token_must_answer_this_challenge(): void
    {
        $t = $this->register('sara');
        // A token made for another nonce (a replay) fails.
        $this->check($t, fn ($n) => $this->payload('someone-elses-nonce'))->assertOk()
            ->assertJsonPath('verified', false)->assertJsonPath('detail', 'request-hash');
        // The challenge is single-use.
        $this->as($t)->postJson('/v1/integrity', ['token' => 'opaque-token'])->assertStatus(409)->assertJson(['error' => 'no-challenge']);
        // Stale, and for another app.
        $this->check($t, fn ($n) => $this->payload($n, ['requestDetails' => [
            'timestampMillis' => (string) (now()->getTimestampMs() - 11 * 60 * 1000),
            'requestPackageName' => 'com.example.fake',
        ]]))->assertJsonPath('detail', 'package stale');
        // Google can't read it.
        $this->check($t, fn () => 400)->assertJson(['verified' => false, 'detail' => 'invalid-token']);
    }

    public function test_it_is_off_until_configured_and_needs_a_session(): void
    {
        $this->getJson('/v1/integrity/challenge')->assertUnauthorized();
        $t = $this->register('noor');
        config(['services.play_integrity.project_number' => null]);
        $this->as($t)->getJson('/v1/integrity/challenge')->assertStatus(503)->assertJson(['error' => 'integrity-off']);
        $this->as($t)->postJson('/v1/integrity', ['token' => 'x'])->assertStatus(503);
    }

    public function test_admins_see_failed_checks(): void
    {
        config(['game.super_admin' => 'boss@example.com']);
        $boss = $this->register('boss');
        \Illuminate\Support\Facades\DB::table('game_users')->where('username', 'boss')->update(['email_verified_at' => now()]);
        $t = $this->register('cheat');
        $this->check($t, fn ($n) => $this->payload($n, ['appIntegrity' => ['appRecognitionVerdict' => 'UNRECOGNIZED_VERSION']]));
        $this->register('plain');

        $this->as($boss)->getJson('/v1/admin/overview')->assertOk()->assertJsonPath('integrityFailed', 1);
        $rows = $this->as($boss)->getJson('/v1/admin/users?integrity=fail')->assertOk()->json('users');
        $this->assertSame(['cheat'], array_column($rows, 'username'));
        $this->assertSame('fail', $rows[0]['integrity']['status']);
        $this->assertSame('app:UNRECOGNIZED_VERSION', $rows[0]['integrity']['detail']);
        $plain = collect($this->as($boss)->getJson('/v1/admin/users?q=plain')->json('users'))->firstWhere('username', 'plain');
        $this->assertNull($plain['integrity']);
    }
}
