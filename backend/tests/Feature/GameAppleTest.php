<?php

namespace Tests\Feature;

use App\Models\GameUser;
use App\Support\GameAccounts;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Sign in with Apple (identity tokens checked locally against Apple's JWKS),
 * its web-flow callback, and linking / unlinking Google and Apple on one
 * account. Apple's keys are faked: tokens are signed with a committed
 * TEST-ONLY key (tests/fixtures/apple-test-only-*.pem|p8), because
 * openssl_pkey_new needs an openssl.cnf that Windows PHP builds often lack.
 */
class GameAppleTest extends TestCase
{
    use RefreshDatabase;

    private const SERVICES = 'com.mphpmaster.prayer.signin';

    private const BUNDLE = 'com.mphpmaster.prayer';

    private const GOOGLE = 'test-web-client.apps.googleusercontent.com';

    private const EXT = 'knahkbkmbjghaiillhngjbhoinmeegoc';

    private array $googleClaims = [];

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-10-15 12:00:00', 'UTC'));
        $this->withoutMiddleware(ThrottleRequests::class);
        config([
            'app.key' => 'base64:'.base64_encode(str_repeat('k', 32)),
            'app.url' => 'https://prayer-times.sarhsoft.com',
            'services.google.client_id' => self::GOOGLE,
            'services.apple.client_ids' => [self::BUNDLE],
            'services.apple.services_id' => self::SERVICES,
            'services.apple.redirect_uri' => null,
            'services.apple.extension_ids' => [self::EXT],
            'services.apple.web_return' => 'https://mphpmaster.github.io/prayer-times-reminder-chrome-ext/app/apple-callback.html',
            'services.apple.team_id' => null,
            'services.apple.key_id' => null,
            'services.apple.private_key_path' => null,
        ]);
        $this->fakeServices();
    }

    // ---- helpers ------------------------------------------------------------

    private function rsaKey()
    {
        return openssl_pkey_get_private(file_get_contents(base_path('tests/fixtures/apple-test-only-rsa.pem')));
    }

    private static function b64(string $s): string
    {
        return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
    }

    /** An Apple identity token signed with the test key; null values drop a claim. */
    private function appleToken(array $claims = [], array $header = []): string
    {
        $c = array_filter($claims + [
            'iss' => 'https://appleid.apple.com',
            'aud' => self::SERVICES,
            'exp' => now()->getTimestamp() + 600,
            'iat' => now()->getTimestamp(),
            'sub' => '001234.apple-sara',
            'email' => 'sara@icloud.com',
            'email_verified' => 'true',
            'nonce' => 'n-123',
        ], fn ($v) => $v !== null);
        $input = self::b64(json_encode($header + ['alg' => 'RS256', 'kid' => 'test-kid'])).'.'.self::b64(json_encode($c));
        openssl_sign($input, $sig, $this->rsaKey(), OPENSSL_ALGO_SHA256);

        return $input.'.'.self::b64($sig);
    }

    /** Apple's JWKS (our test key), Apple's token/revoke endpoints, and Google's tokeninfo. */
    private function fakeServices(): void
    {
        $rsa = openssl_pkey_get_details($this->rsaKey())['rsa'];
        Http::fake(function (HttpRequest $req) use ($rsa) {
            $url = $req->url();
            if (str_starts_with($url, 'https://appleid.apple.com/auth/keys')) {
                return Http::response(['keys' => [
                    ['kty' => 'RSA', 'kid' => 'other-kid', 'use' => 'sig', 'alg' => 'RS256', 'n' => self::b64(str_repeat("\xC1", 256)), 'e' => 'AQAB'],
                    ['kty' => 'RSA', 'kid' => 'test-kid', 'use' => 'sig', 'alg' => 'RS256', 'n' => self::b64($rsa['n']), 'e' => self::b64($rsa['e'])],
                ]]);
            }
            if (str_starts_with($url, 'https://appleid.apple.com/auth/token')) {
                return Http::response(['access_token' => 'a', 'refresh_token' => 'r-'.$req['code'], 'id_token' => 'x']);
            }
            if (str_starts_with($url, 'https://appleid.apple.com/auth/revoke')) {
                return Http::response('', 200);
            }
            if (str_starts_with($url, 'https://oauth2.googleapis.com/')) {
                return Http::response($this->googleClaims + [
                    'iss' => 'https://accounts.google.com', 'aud' => self::GOOGLE,
                    'exp' => (string) (now()->getTimestamp() + 3600), 'email_verified' => 'true',
                ]);
            }

            return Http::response('unexpected', 500);
        });
    }

    private function google(string $sub, string $email): void
    {
        $this->googleClaims = ['sub' => $sub, 'email' => $email];
    }

    private function as(string $token): static
    {
        return $this->withHeader('Authorization', "Bearer $token");
    }

    private function apple(array $claims = [], array $body = [])
    {
        return $this->postJson('/v1/auth/apple', $body + ['identityToken' => $this->appleToken($claims), 'nonce' => 'n-123']);
    }

    // ---- config: off until configured ---------------------------------------

    public function test_everything_is_off_while_apple_is_not_configured(): void
    {
        config(['services.apple.client_ids' => [], 'services.apple.services_id' => null]);
        $this->getJson('/v1/auth/config')->assertExactJson(['google' => ['clientId' => self::GOOGLE], 'apple' => null]);
        $this->apple([], ['username' => 'sara'])->assertStatus(503)->assertJson(['error' => 'apple-unavailable']);
        $this->post('/v1/auth/apple/callback', ['state' => 'web.'.str_repeat('a', 32), 'id_token' => 'x'])->assertStatus(400);
        $t = GameAccounts::issueToken(GameUser::create(['username' => 'sara', 'username_lower' => 'sara', 'email' => 's@x.com', 'password' => 'h']));
        $this->as($t)->postJson('/v1/me/link/apple', ['identityToken' => 'x'])->assertStatus(503)->assertJson(['error' => 'apple-unavailable']);
        $this->assertDatabaseCount('game_users', 1);
    }

    public function test_config_exposes_only_public_ids(): void
    {
        $this->getJson('/v1/auth/config')->assertExactJson([
            'google' => ['clientId' => self::GOOGLE],
            'apple' => ['servicesId' => self::SERVICES, 'redirectUri' => 'https://prayer-times.sarhsoft.com/v1/auth/apple/callback'],
        ]);
        // Native-only (iOS bundle id, no Services ID): on, but no web flow.
        config(['services.apple.services_id' => null]);
        $this->getJson('/v1/auth/config')->assertJsonPath('apple', ['servicesId' => null, 'redirectUri' => null]);
    }

    // ---- identity token checks ----------------------------------------------

    public function test_apple_token_must_be_signed_by_apple_for_us_unexpired_with_our_nonce(): void
    {
        $bad = [
            'audience' => $this->appleToken(['aud' => 'com.someone.else']),
            'issuer' => $this->appleToken(['iss' => 'https://evil.example']),
            'expired' => $this->appleToken(['exp' => now()->getTimestamp() - 1]),
            'unknown key' => $this->appleToken([], ['kid' => 'nope']),
            'other key' => $this->appleToken([], ['kid' => 'other-kid']),
            'alg none' => $this->appleToken([], ['alg' => 'none']),
            'no sub' => $this->appleToken(['sub' => null]),
        ];
        // A payload changed after signing.
        [$h, , $s] = explode('.', $this->appleToken());
        $bad['tampered'] = $h.'.'.self::b64(json_encode(['iss' => 'https://appleid.apple.com', 'aud' => self::SERVICES, 'exp' => now()->getTimestamp() + 600, 'sub' => 'x'])).'.'.$s;
        $bad['garbage'] = 'not-a-jwt';
        foreach ($bad as $why => $token) {
            $this->postJson('/v1/auth/apple', ['identityToken' => $token, 'username' => 'sara'])
                ->assertStatus(401)->assertJson(['error' => 'apple-invalid'], $why);
        }
        $this->apple([], ['nonce' => 'another-nonce', 'username' => 'sara'])->assertStatus(401);
        $this->assertDatabaseCount('game_users', 0);

        // Native iOS: Apple holds SHA-256(nonce), the app sends the raw nonce; the bundle id is an audience too.
        $this->apple(['aud' => self::BUNDLE, 'nonce' => hash('sha256', 'raw-nonce')], ['nonce' => 'raw-nonce', 'username' => 'sara'])->assertCreated();
    }

    // ---- sign in with Apple ---------------------------------------------------

    public function test_new_apple_player_picks_a_name_then_signs_in_again_as_the_same_user(): void
    {
        $this->apple()->assertStatus(422)->assertJson(['error' => 'username-required']);
        $this->apple([], ['username' => 'sara'])->assertCreated()
            ->assertJsonPath('user.apple', true)->assertJsonPath('user.google', false)
            ->assertJsonPath('user.hasPassword', false)->assertJsonPath('user.email', 'sara@icloud.com')
            ->assertJsonPath('user.emailVerified', true)->assertJsonPath('user.legacy', false)
            ->assertJsonMissingPath('user.apple_sub');
        // Later sign-ins carry no email: the account is found by Apple's sub.
        $this->apple(['email' => null])->assertOk()->assertJsonPath('user.username', 'sara');
        $this->assertDatabaseCount('game_users', 1);
    }

    public function test_apple_without_email_or_with_a_private_relay_address_still_makes_a_real_account(): void
    {
        $t = $this->apple(['email' => null], ['username' => 'hidden'])->assertCreated()
            ->assertJsonPath('user.email', null)->assertJsonPath('user.legacy', false)->json('token');
        $this->as($t)->getJson('/v1/me')->assertOk()->assertJsonPath('user.apple', true);

        $this->apple(['sub' => 'relay-1', 'email' => 'x7k2@privaterelay.appleid.com', 'is_private_email' => 'true'], ['username' => 'relay'])
            ->assertCreated()->assertJsonPath('user.email', 'x7k2@privaterelay.appleid.com');
    }

    public function test_apple_with_the_email_of_an_existing_account_links_to_it(): void
    {
        $this->postJson('/v1/auth/register', ['email' => 'sara@icloud.com', 'password' => 'secret-pass-1', 'username' => 'sara'])->assertCreated();
        $this->apple()->assertOk()->assertJsonPath('user.username', 'sara')->assertJsonPath('user.apple', true)
            ->assertJsonPath('user.emailVerified', true)->assertJsonPath('user.hasPassword', false); // unproven password dropped, as with Google
        $this->assertDatabaseCount('game_users', 1);
        // A different Apple ID with that same email can't take it over.
        $this->apple(['sub' => 'someone-else'])->assertStatus(409)->assertJson(['error' => 'account-conflict']);
    }

    public function test_a_legacy_account_upgrades_in_place_with_apple(): void
    {
        $old = GameAccounts::issueToken(GameUser::create(['username' => 'oldname', 'username_lower' => 'oldname']));
        $res = $this->apple(['email' => null], ['legacyToken' => $old])->assertCreated()
            ->assertJsonPath('user.username', 'oldname')->assertJsonPath('user.legacy', false);
        $this->as($old)->getJson('/v1/me')->assertStatus(401); // the name-only token retires
        $this->as($res->json('token'))->getJson('/v1/me')->assertOk();
    }

    // ---- the web flow's return hop ---------------------------------------------

    public function test_callback_forwards_apples_form_post_only_to_allowed_app_addresses(): void
    {
        $nonce = str_repeat('ab12', 8);
        $cases = [
            "ext-".self::EXT.".$nonce" => 'https://'.self::EXT.'.chromiumapp.org/apple#',
            "web.$nonce" => 'https://mphpmaster.github.io/prayer-times-reminder-chrome-ext/app/apple-callback.html#',
            "desk-53918.$nonce" => 'http://127.0.0.1:53918/#',
            "app.$nonce" => 'https://localhost/apple-callback.html#',
        ];
        foreach ($cases as $state => $prefix) {
            $res = $this->post('/v1/auth/apple/callback', ['state' => $state, 'id_token' => 'tok.en.sig', 'code' => 'c1', 'user' => '{"email":"x@y.z"}']);
            $res->assertStatus(303)->assertHeader('Cache-Control', 'no-store, private');
            $loc = $res->headers->get('Location');
            $this->assertStringStartsWith($prefix, $loc);
            parse_str(substr($loc, strlen($prefix)), $got);
            $this->assertSame(['state' => $state, 'id_token' => 'tok.en.sig', 'code' => 'c1'], $got);
        }
        // Apple's "canceled" comes back the same way.
        $loc = $this->post('/v1/auth/apple/callback', ['state' => "web.$nonce", 'error' => 'user_cancelled_authorize'])->headers->get('Location');
        $this->assertStringEndsWith('#state=web.'.$nonce.'&error=user_cancelled_authorize', $loc);

        foreach (['ext-'.str_repeat('a', 32).".$nonce", "desk-12345.$nonce", "evil.$nonce", 'web.short', 'https://evil.example/', ''] as $state) {
            $this->post('/v1/auth/apple/callback', ['state' => $state, 'id_token' => 'x'])->assertStatus(400);
        }
    }

    // ---- linking ------------------------------------------------------------------

    public function test_a_google_player_links_apple_and_then_either_one_opens_the_same_account(): void
    {
        $this->google('g-1', 'sara@gmail.com');
        $t = $this->postJson('/v1/auth/google', ['idToken' => 'g', 'username' => 'sara'])->assertCreated()->json('token');

        $this->as($t)->postJson('/v1/me/link/apple', ['identityToken' => $this->appleToken(['email' => 'other@icloud.com']), 'nonce' => 'n-123'])
            ->assertOk()->assertJsonPath('user.apple', true)->assertJsonPath('user.google', true)
            ->assertJsonPath('user.email', 'sara@gmail.com'); // the account keeps its email
        $this->as($t)->getJson('/v1/me')->assertJsonPath('user.apple', true)->assertJsonPath('user.hasPassword', false);

        $this->apple(['email' => null])->assertOk()->assertJsonPath('user.username', 'sara');
        $this->postJson('/v1/auth/google', ['idToken' => 'g'])->assertOk()->assertJsonPath('user.username', 'sara');
        $this->assertDatabaseCount('game_users', 1);
        // Linking the same Apple ID again is harmless.
        $this->as($t)->postJson('/v1/me/link/apple', ['identityToken' => $this->appleToken(), 'nonce' => 'n-123'])->assertOk();
    }

    public function test_an_apple_player_links_google_and_gets_its_email_when_it_had_none(): void
    {
        $t = $this->apple(['email' => null], ['username' => 'sara'])->assertCreated()->json('token');
        $this->google('g-1', 'sara@gmail.com');
        $this->as($t)->postJson('/v1/me/link/google', ['idToken' => 'g'])->assertOk()
            ->assertJsonPath('user.google', true)->assertJsonPath('user.email', 'sara@gmail.com')->assertJsonPath('user.emailVerified', true);
        $this->postJson('/v1/auth/google', ['idToken' => 'g'])->assertOk()->assertJsonPath('user.username', 'sara');
        $this->assertDatabaseCount('game_users', 1);
    }

    public function test_linking_an_identity_owned_by_another_player_is_a_conflict(): void
    {
        $this->apple([], ['username' => 'owner'])->assertCreated();
        $this->google('g-9', 'owner@gmail.com');
        $this->postJson('/v1/auth/google', ['idToken' => 'g', 'username' => 'gowner'])->assertCreated();
        $me = $this->postJson('/v1/auth/register', ['email' => 'me@example.com', 'password' => 'secret-pass-1', 'username' => 'meme'])->json('token');

        $this->as($me)->postJson('/v1/me/link/apple', ['identityToken' => $this->appleToken(), 'nonce' => 'n-123'])
            ->assertStatus(409)->assertJson(['error' => 'account-conflict']);
        $this->as($me)->postJson('/v1/me/link/google', ['idToken' => 'g'])->assertStatus(409)->assertJson(['error' => 'account-conflict']);
        $this->as($me)->getJson('/v1/me')->assertJsonPath('user.apple', false)->assertJsonPath('user.google', false);

        // Already has a different Apple ID: unlink that first.
        $this->as($me)->postJson('/v1/me/link/apple', ['identityToken' => $this->appleToken(['sub' => 'mine', 'email' => null]), 'nonce' => 'n-123'])->assertOk();
        $this->as($me)->postJson('/v1/me/link/apple', ['identityToken' => $this->appleToken(['sub' => 'mine-2', 'email' => null]), 'nonce' => 'n-123'])
            ->assertStatus(409)->assertJson(['error' => 'already-linked']);
        // A bad token is refused before anything changes.
        $this->as($me)->postJson('/v1/me/link/apple', ['identityToken' => $this->appleToken(['aud' => 'x'])])->assertStatus(401);
        $this->flushHeaders()->postJson('/v1/me/link/apple', ['identityToken' => $this->appleToken()])->assertStatus(401); // signed out
    }

    public function test_unlinking_never_leaves_an_account_without_a_way_to_sign_in(): void
    {
        $t = $this->apple([], ['username' => 'sara'])->assertCreated()->json('token');
        $this->as($t)->deleteJson('/v1/me/link/apple')->assertStatus(409)->assertJson(['error' => 'last-method']);

        $this->google('g-1', 'sara@gmail.com');
        $this->as($t)->postJson('/v1/me/link/google', ['idToken' => 'g'])->assertOk();
        $this->as($t)->deleteJson('/v1/me/link/apple')->assertOk()->assertJsonPath('user.apple', false)->assertJsonPath('user.google', true);
        $this->as($t)->deleteJson('/v1/me/link/google')->assertStatus(409)->assertJson(['error' => 'last-method']);
        $this->as($t)->deleteJson('/v1/me/link/apple')->assertOk(); // not linked: nothing to do
        $this->assertContains($this->as($t)->deleteJson('/v1/me/link/github')->status(), [404, 405]);

        // Apple sign-in no longer opens this account: it would be a new player.
        $this->apple(['email' => null])->assertStatus(422)->assertJson(['error' => 'username-required']);

        // With a password, the last provider can go.
        $p = $this->postJson('/v1/auth/register', ['email' => 'pw@example.com', 'password' => 'secret-pass-1', 'username' => 'pwuser'])->json('token');
        $this->as($p)->postJson('/v1/me/link/apple', ['identityToken' => $this->appleToken(['sub' => 'pw-apple', 'email' => null]), 'nonce' => 'n-123'])->assertOk();
        $this->as($p)->deleteJson('/v1/me/link/apple')->assertOk()->assertJsonPath('user.apple', false)->assertJsonPath('user.hasPassword', true);
    }

    // ---- server key: refresh token kept, revoked on unlink / delete -----------------

    public function test_with_a_server_key_apple_access_is_revoked_on_unlink_and_on_account_deletion(): void
    {
        config([
            'services.apple.team_id' => 'TEAM123456',
            'services.apple.key_id' => 'KEY1234567',
            'services.apple.private_key_path' => base_path('tests/fixtures/apple-test-only-ec.p8'),
        ]);
        $t = $this->apple([], ['username' => 'sara', 'authorizationCode' => 'code-1'])->assertCreated()->json('token');
        $stored = DB::table('game_users')->value('apple_refresh_token');
        $this->assertStringNotContainsString('r-code-1', $stored); // encrypted at rest
        $this->assertSame(['c' => self::SERVICES, 't' => 'r-code-1'], json_decode(Crypt::decryptString($stored), true));

        Http::assertSent(function (HttpRequest $r) {
            if (! str_contains($r->url(), '/auth/token')) {
                return false;
            }
            $this->assertSame('https://prayer-times.sarhsoft.com/v1/auth/apple/callback', $r['redirect_uri']);
            $this->assertValidClientSecret($r['client_secret'], self::SERVICES);

            return $r['code'] === 'code-1' && $r['grant_type'] === 'authorization_code';
        });

        $this->postJson('/v1/auth/register', ['email' => 'x@example.com', 'password' => 'secret-pass-1', 'username' => 'xuser']);
        $this->google('g-1', 'sara@gmail.com');
        $this->as($t)->postJson('/v1/me/link/google', ['idToken' => 'g'])->assertOk();
        $this->as($t)->deleteJson('/v1/me/link/apple')->assertOk();
        Http::assertSent(fn (HttpRequest $r) => str_contains($r->url(), '/auth/revoke') && $r['token'] === 'r-code-1' && $r['token_type_hint'] === 'refresh_token');
        $this->assertNull(DB::table('game_users')->where('username', 'sara')->value('apple_refresh_token'));

        // Native iOS code (bundle id audience) on link, then the account is deleted.
        $this->as($t)->postJson('/v1/me/link/apple', [
            'identityToken' => $this->appleToken(['aud' => self::BUNDLE, 'nonce' => hash('sha256', 'raw')]), 'nonce' => 'raw', 'authorizationCode' => 'code-2',
        ])->assertOk();
        $this->as($t)->deleteJson('/v1/me')->assertNoContent();
        Http::assertSent(function (HttpRequest $r) {
            if (! str_contains($r->url(), '/auth/revoke') || $r['token'] !== 'r-code-2') {
                return false;
            }
            $this->assertSame(self::BUNDLE, $r['client_id']);
            $this->assertValidClientSecret($r['client_secret'], self::BUNDLE);

            return true;
        });
    }

    public function test_without_a_server_key_no_code_is_exchanged(): void
    {
        $this->apple([], ['username' => 'sara', 'authorizationCode' => 'code-1'])->assertCreated();
        $this->assertNull(DB::table('game_users')->value('apple_refresh_token'));
        Http::assertNotSent(fn (HttpRequest $r) => str_contains($r->url(), '/auth/token'));
    }

    /** The ES256 client secret: our team, key and client id, signed by the .p8 key (raw r||s, as JOSE wants). */
    private function assertValidClientSecret(string $jwt, string $clientId): void
    {
        [$h, $c, $s] = explode('.', $jwt);
        $dec = fn ($x) => base64_decode(strtr($x, '-_', '+/'));
        $this->assertSame(['alg' => 'ES256', 'kid' => 'KEY1234567'], json_decode($dec($h), true));
        $claims = json_decode($dec($c), true);
        $this->assertSame(['TEAM123456', 'https://appleid.apple.com', $clientId], [$claims['iss'], $claims['aud'], $claims['sub']]);
        $raw = $dec($s);
        $this->assertSame(64, strlen($raw));
        $int = function (string $v) {
            $v = ltrim($v, "\x00");
            $v = ord($v[0]) > 0x7F ? "\x00".$v : $v;

            return "\x02".chr(strlen($v)).$v;
        };
        $body = $int(substr($raw, 0, 32)).$int(substr($raw, 32));
        $der = "\x30".chr(strlen($body)).$body;
        $pub = openssl_pkey_get_details(openssl_pkey_get_private(file_get_contents(base_path('tests/fixtures/apple-test-only-ec.p8'))))['key'];
        $this->assertSame(1, openssl_verify("$h.$c", $der, $pub, OPENSSL_ALGO_SHA256));
    }
}
