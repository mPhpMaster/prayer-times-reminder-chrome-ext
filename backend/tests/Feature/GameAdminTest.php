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
 * Admins (verified email only), email verification, the Admin page's account
 * tools, and the About page's dedication names with their request flow.
 */
class GameAdminTest extends TestCase
{
    use RefreshDatabase;

    private const CLIENT = 'test-web-client.apps.googleusercontent.com';

    private const OWNER = 'mphpmaster@gmail.com';

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-09-29 12:00:00', 'UTC'));
        $this->withoutMiddleware(ThrottleRequests::class);
        config(['mail.default' => 'array', 'services.google.client_id' => self::CLIENT, 'game.super_admin' => self::OWNER]);
    }

    private function as(string $token): static
    {
        return $this->withHeader('Authorization', "Bearer $token");
    }

    private function register(string $email, string $name): string
    {
        return $this->postJson('/v1/auth/register', ['email' => $email, 'password' => 'secret-pass-1', 'username' => $name])
            ->assertCreated()->json('token');
    }

    private function google(string $email, string $sub, ?string $name = null)
    {
        Http::fake(['oauth2.googleapis.com/*' => Http::response([
            'iss' => 'https://accounts.google.com', 'aud' => self::CLIENT, 'exp' => (string) (now()->getTimestamp() + 3600),
            'email_verified' => 'true', 'email' => $email, 'sub' => $sub,
        ])]);

        return $this->postJson('/v1/auth/google', ['idToken' => 'x.y.z'] + ($name ? ['username' => $name] : []));
    }

    /** A signed-in player whose email is verified (as after a confirmation code). */
    private function verified(string $email, string $name): string
    {
        $token = $this->register($email, $name);
        DB::table('game_users')->where('email', $email)->update(['email_verified_at' => now()]);

        return $token;
    }

    private function owner(): string
    {
        return $this->verified(self::OWNER, 'owner');
    }

    private function sentMails(): array
    {
        return app('mailer')->getSymfonyTransport()->messages()->all();
    }

    private function lastCode(): string
    {
        $mails = $this->sentMails();
        preg_match('/\b(\d{6})\b/', end($mails)->getOriginalMessage()->getTextBody(), $m);

        return $m[1];
    }

    // ---- verified email ------------------------------------------------------

    public function test_email_verification_by_code(): void
    {
        $t = $this->register('sara@example.com', 'sara');
        $this->as($t)->getJson('/v1/me')->assertJsonPath('user.emailVerified', false);

        $this->as($t)->postJson('/v1/auth/verify-email/send')->assertNoContent();
        $code = $this->lastCode();
        $this->as($t)->postJson('/v1/auth/verify-email', ['code' => '000000'])->assertStatus(400)->assertJsonPath('error', 'bad-code');
        $this->as($t)->postJson('/v1/auth/verify-email', ['code' => $code])->assertOk()->assertJsonPath('user.emailVerified', true);
        $this->as($t)->postJson('/v1/auth/verify-email/send')->assertStatus(409)->assertJsonPath('error', 'already-verified');
    }

    public function test_verification_code_expires_and_is_capped(): void
    {
        $t = $this->register('sara@example.com', 'sara');
        $this->as($t)->postJson('/v1/auth/verify-email/send');
        for ($i = 0; $i < 5; $i++) {
            $this->as($t)->postJson('/v1/auth/verify-email', ['code' => '000000'])->assertStatus(400);
        }
        $this->as($t)->postJson('/v1/auth/verify-email', ['code' => $this->lastCode()])->assertStatus(429);

        $this->as($t)->postJson('/v1/auth/verify-email/send');
        Carbon::setTestNow(now()->addMinutes(16));
        $this->as($t)->postJson('/v1/auth/verify-email', ['code' => $this->lastCode()])->assertStatus(400)->assertJsonPath('error', 'code-expired');
    }

    public function test_google_sign_in_and_password_reset_verify_the_email(): void
    {
        $this->google('g@example.com', 'sub-g', 'gina')->assertCreated()->assertJsonPath('user.emailVerified', true);

        $this->register('p@example.com', 'pete');
        $this->postJson('/v1/auth/forgot', ['email' => 'p@example.com'])->assertNoContent();
        $this->postJson('/v1/auth/reset', ['email' => 'p@example.com', 'code' => $this->lastCode(), 'password' => 'new-pass-123'])
            ->assertOk()->assertJsonPath('user.emailVerified', true);
    }

    public function test_google_owner_takes_over_an_unproven_password_account(): void
    {
        // Someone registers the victim's address with their own password first.
        $squatter = $this->register('victim@example.com', 'victim');
        $this->google('victim@example.com', 'sub-v')->assertOk()->assertJsonPath('user.hasPassword', false);

        $this->as($squatter)->getJson('/v1/me')->assertUnauthorized(); // old sessions revoked
        $this->postJson('/v1/auth/login', ['email' => 'victim@example.com', 'password' => 'secret-pass-1'])->assertUnauthorized();
    }

    public function test_a_verified_password_survives_linking_google(): void
    {
        $this->verified('both@example.com', 'both');
        $this->google('both@example.com', 'sub-b')->assertOk()->assertJsonPath('user.hasPassword', true);
    }

    // ---- who is an admin -----------------------------------------------------

    public function test_the_owner_email_is_admin_only_once_verified(): void
    {
        $t = $this->register(self::OWNER, 'owner');
        $this->as($t)->getJson('/v1/me')->assertJsonPath('user.admin', false);
        $this->as($t)->getJson('/v1/admin/overview')->assertForbidden()->assertJsonPath('error', 'not-admin');

        DB::table('game_users')->where('email', self::OWNER)->update(['email_verified_at' => now()]);
        $this->as($t)->getJson('/v1/me')->assertJsonPath('user.admin', true)->assertJsonPath('user.superAdmin', true);
        $this->as($t)->getJson('/v1/admin/overview')->assertOk()->assertJsonPath('admins', 1);
    }

    public function test_owner_signing_in_with_google_is_admin_at_once(): void
    {
        $this->google(self::OWNER, 'sub-owner', 'owner')->assertCreated()
            ->assertJsonPath('user.admin', true)->assertJsonPath('user.superAdmin', true);
    }

    public function test_players_are_not_admins(): void
    {
        $t = $this->verified('p@example.com', 'player');
        foreach (['overview', 'admins', 'users', 'requests', 'dedications', 'log'] as $path) {
            $this->as($t)->getJson("/v1/admin/$path")->assertForbidden();
        }
        $this->flushHeaders()->getJson('/v1/admin/overview')->assertUnauthorized();
    }

    public function test_adding_and_removing_admins(): void
    {
        $owner = $this->owner();
        $helper = $this->verified('helper@example.com', 'helper');
        $this->as($helper)->getJson('/v1/me')->assertJsonPath('user.admin', false);

        $this->as($owner)->postJson('/v1/admin/admins', ['email' => 'Helper@Example.com'])->assertCreated()
            ->assertJsonPath('admins.1.email', 'helper@example.com')->assertJsonPath('admins.1.verified', true)
            ->assertJsonPath('admins.0.super', true);
        $this->as($owner)->postJson('/v1/admin/admins', ['email' => 'helper@example.com'])->assertStatus(409);
        $this->as($owner)->postJson('/v1/admin/admins', ['email' => self::OWNER])->assertStatus(409);
        $this->as($helper)->getJson('/v1/me')->assertJsonPath('user.admin', true)->assertJsonPath('user.superAdmin', false);

        // Only the owner adds or removes admins — and nobody removes the owner.
        $this->as($helper)->postJson('/v1/admin/admins', ['email' => 'third@example.com'])->assertForbidden()->assertJsonPath('error', 'super-admin-only');
        $this->as($helper)->deleteJson('/v1/admin/admins/helper@example.com')->assertForbidden()->assertJsonPath('error', 'super-admin-only');
        $this->as($helper)->deleteJson('/v1/admin/admins/'.self::OWNER)->assertForbidden()->assertJsonPath('error', 'super-admin');
        $this->as($owner)->deleteJson('/v1/admin/admins/'.self::OWNER)->assertForbidden();
        $this->as($owner)->deleteJson('/v1/admin/admins/helper@example.com')->assertNoContent();
        $this->as($helper)->getJson('/v1/admin/overview')->assertForbidden();

        $actions = DB::table('game_admin_log')->orderBy('id')->pluck('action')->all();
        $this->assertSame(['admin.add', 'admin.remove'], $actions);
    }

    public function test_an_added_admin_email_needs_verifying_first(): void
    {
        $owner = $this->owner();
        $this->as($owner)->postJson('/v1/admin/admins', ['email' => 'new@example.com'])->assertCreated();
        // Whoever registers that address with a password is not an admin until the email is proven.
        $t = $this->register('new@example.com', 'newbie');
        $this->as($t)->getJson('/v1/admin/overview')->assertForbidden();
        $this->as($t)->postJson('/v1/auth/verify-email/send');
        $this->as($t)->postJson('/v1/auth/verify-email', ['code' => $this->lastCode()])->assertJsonPath('user.admin', true);
    }

    // ---- accounts --------------------------------------------------------------

    public function test_search_delete_and_reset_accounts(): void
    {
        $owner = $this->owner();
        $sara = $this->register('sara@example.com', 'sara');
        $bob = $this->register('bob@example.com', 'bob');
        $saraId = GameUser::findByUsername('sara')->id;
        $bobId = GameUser::findByUsername('bob')->id;
        $now = (int) now()->getTimestampMs();
        $this->as($sara)->postJson('/v1/progress', ['completions' => [[
            'windowKey' => '2026-09-29:Fajr', 'itemId' => 'a', 'kind' => 'task', 'points' => 10, 'startedAt' => $now - 60000, 'doneAt' => $now - 1000,
        ]]])->assertOk();
        $this->as($sara)->putJson('/v1/follows/bob')->assertSuccessful();
        $this->as($sara)->patchJson('/v1/me', ['displayName' => 'Sara A', 'hideProgress' => true]);

        $this->as($owner)->getJson('/v1/admin/users?q=SAR')->assertOk()
            ->assertJsonCount(1, 'users')->assertJsonPath('users.0.username', 'sara')
            ->assertJsonPath('users.0.points', 10)->assertJsonPath('users.0.email', 'sara@example.com');
        $this->as($owner)->getJson('/v1/admin/users?q=bob@')->assertJsonPath('users.0.username', 'bob');

        $this->as($owner)->postJson("/v1/admin/users/$saraId/reset")->assertNoContent();
        $this->assertSame(0, DB::table('game_completions')->where('user_id', $saraId)->count());
        $this->assertSame(0, DB::table('game_follows')->where('follower_id', $saraId)->count());
        $this->as($sara)->getJson('/v1/me')->assertOk() // still signed in, profile wiped
            ->assertJsonPath('user.displayName', 'sara')->assertJsonPath('user.hideProgress', false);

        $this->as($owner)->deleteJson("/v1/admin/users/$bobId")->assertNoContent();
        $this->as($bob)->getJson('/v1/me')->assertUnauthorized();
        $this->assertSame(['user.reset', 'user.delete'], DB::table('game_admin_log')->orderBy('id')->pluck('action')->all());
    }

    public function test_account_guard_rails(): void
    {
        $owner = $this->owner();
        $ownerId = GameUser::findByUsername('owner')->id;
        $helper = $this->verified('helper@example.com', 'helper');
        $other = $this->verified('other@example.com', 'other');
        $this->as($owner)->postJson('/v1/admin/admins', ['email' => 'helper@example.com']);
        $this->as($owner)->postJson('/v1/admin/admins', ['email' => 'other@example.com']);
        $otherId = GameUser::findByUsername('other')->id;
        $helperId = GameUser::findByUsername('helper')->id;

        $this->as($owner)->deleteJson("/v1/admin/users/$ownerId")->assertStatus(400)->assertJsonPath('error', 'use-my-account');
        $this->as($helper)->deleteJson("/v1/admin/users/$ownerId")->assertForbidden()->assertJsonPath('error', 'super-admin');
        $this->as($helper)->postJson("/v1/admin/users/$ownerId/reset")->assertForbidden();
        $this->as($helper)->deleteJson("/v1/admin/users/$otherId")->assertForbidden()->assertJsonPath('error', 'super-admin-only');
        $this->as($owner)->postJson("/v1/admin/users/$helperId/reset")->assertNoContent();
        $this->as($owner)->deleteJson('/v1/admin/users/999')->assertNotFound();
        $this->as($other)->getJson('/v1/me')->assertOk();
    }

    // ---- dedication names ------------------------------------------------------

    public function test_public_list_is_seeded_with_the_old_names_in_order(): void
    {
        $res = $this->getJson('/v1/dedications')->assertOk()->assertJsonCount(5, 'dedications')
            ->assertJsonPath('dedications.0.names.ar', 'ام بلال - باشية حجازي')
            ->assertJsonPath('dedications.0.names.en', 'Umm Bilal – Bashiyah Hijazi')
            ->assertJsonPath('dedications.4.names.ar', 'سوهيرمان');
        $etag = $res->headers->get('ETag');
        $this->assertNotEmpty($etag);
        $this->withHeader('If-None-Match', $etag)->getJson('/v1/dedications')->assertStatus(304);
    }

    public function test_a_request_needs_a_real_signed_in_account(): void
    {
        $this->postJson('/v1/dedications/requests', ['names' => ['ar' => 'فلان']])->assertUnauthorized();
        $legacy = GameAccounts::issueToken(GameUser::create(['username' => 'old', 'username_lower' => 'old']));
        $this->as($legacy)->postJson('/v1/dedications/requests', ['names' => ['ar' => 'فلان']])
            ->assertForbidden()->assertJsonPath('error', 'sign-in-required');
    }

    public function test_request_validation(): void
    {
        $t = $this->register('sara@example.com', 'sara');
        foreach ([
            [],
            ['names' => []],
            ['names' => ['ar' => '   ']],
            ['names' => ['xx' => 'Name']],             // not an app language
            ['names' => ['en' => str_repeat('a', 81)]],
            ['names' => ['en' => 'visit www.spam.test']],
            ['names' => ['en' => 'https://x.test']],
        ] as $body) {
            $this->as($t)->postJson('/v1/dedications/requests', $body)->assertStatus(400)->assertJsonPath('error', 'bad-names');
        }
        $this->as($t)->postJson('/v1/dedications/requests', [
            'names' => ['ar' => "  والدة\n  أحمد \u{202E}", 'en' => 'Mother of Ahmad', 'fr' => '', 'xx' => 'dropped'],
            'note' => 'my mother',
        ])->assertCreated()
            ->assertJsonPath('request.names', ['ar' => 'والدة أحمد', 'en' => 'Mother of Ahmad'])
            ->assertJsonPath('request.status', 'pending')->assertJsonPath('request.note', 'my mother');
    }

    public function test_at_most_three_pending_requests(): void
    {
        $t = $this->register('sara@example.com', 'sara');
        for ($i = 1; $i <= 3; $i++) {
            $this->as($t)->postJson('/v1/dedications/requests', ['names' => ['ar' => "اسم $i"]])->assertCreated();
        }
        $this->as($t)->postJson('/v1/dedications/requests', ['names' => ['ar' => 'اسم 4']])
            ->assertStatus(429)->assertJsonPath('error', 'too-many-pending');
    }

    public function test_admins_are_emailed_about_a_new_request(): void
    {
        $owner = $this->owner();
        $this->as($owner)->postJson('/v1/admin/admins', ['email' => 'helper@example.com']);
        $t = $this->register('sara@example.com', 'sara');
        $this->as($t)->postJson('/v1/dedications/requests', ['names' => ['ar' => 'فلانة']])->assertCreated();
        $to = array_map(fn ($m) => $m->getEnvelope()->getRecipients()[0]->getAddress(), $this->sentMails());
        $this->assertSame([self::OWNER, 'helper@example.com'], $to);
        $mails = $this->sentMails();
        $this->assertStringContainsString('فلانة', end($mails)->getOriginalMessage()->getTextBody());
    }

    public function test_approve_after_editing_puts_the_name_on_the_about_page(): void
    {
        $owner = $this->owner();
        $sara = $this->register('sara@example.com', 'sara');
        $id = $this->as($sara)->postJson('/v1/dedications/requests', ['names' => ['ar' => 'والدتي']])->json('request.id');

        $this->as($owner)->getJson('/v1/admin/requests')->assertJsonCount(1, 'requests')
            ->assertJsonPath('requests.0.user.username', 'sara')->assertJsonPath('requests.0.user.email', 'sara@example.com');
        $this->as($owner)->getJson('/v1/admin/overview')->assertJsonPath('pendingRequests', 1);
        $this->as($owner)->patchJson("/v1/admin/requests/$id", ['names' => ['ar' => 'أم سارة']])->assertOk()
            ->assertJsonPath('request.names.ar', 'أم سارة');
        $this->as($owner)->postJson("/v1/admin/requests/$id/approve", ['names' => ['ar' => 'أم سارة', 'en' => 'Umm Sara']])->assertOk()
            ->assertJsonPath('request.status', 'approved')->assertJsonPath('dedication.names.en', 'Umm Sara');

        $this->getJson('/v1/dedications')->assertJsonCount(6, 'dedications')->assertJsonPath('dedications.5.names.ar', 'أم سارة');
        $this->as($sara)->getJson('/v1/dedications/requests')->assertJsonPath('requests.0.status', 'approved');
        $this->as($owner)->postJson("/v1/admin/requests/$id/reject")->assertStatus(409)->assertJsonPath('error', 'already-decided');
    }

    public function test_reject_with_a_reason_the_player_can_see(): void
    {
        $owner = $this->owner();
        $sara = $this->register('sara@example.com', 'sara');
        $id = $this->as($sara)->postJson('/v1/dedications/requests', ['names' => ['en' => 'Test']])->json('request.id');
        $this->as($owner)->postJson("/v1/admin/requests/$id/reject", ['reason' => 'Please send a real name'])->assertOk();

        $this->as($sara)->getJson('/v1/dedications/requests')
            ->assertJsonPath('requests.0.status', 'rejected')->assertJsonPath('requests.0.reason', 'Please send a real name')
            ->assertJsonMissingPath('requests.0.reviewedBy');
        $this->getJson('/v1/dedications')->assertJsonCount(5, 'dedications');
        $this->as($owner)->getJson('/v1/admin/requests?status=rejected')->assertJsonCount(1, 'requests');
    }

    public function test_players_only_see_their_own_requests(): void
    {
        $a = $this->register('a@example.com', 'alpha');
        $b = $this->register('b@example.com', 'bravo');
        $this->as($a)->postJson('/v1/dedications/requests', ['names' => ['ar' => 'أ']]);
        $this->as($b)->getJson('/v1/dedications/requests')->assertJsonCount(0, 'requests');
    }

    public function test_managing_the_names_list(): void
    {
        $owner = $this->owner();
        $id = $this->as($owner)->postJson('/v1/admin/dedications', ['names' => ['ar' => 'اسم مباشر']])->assertCreated()->json('dedication.id');
        $this->as($owner)->patchJson("/v1/admin/dedications/$id", ['hidden' => true])->assertJsonPath('dedication.hidden', true);
        $this->getJson('/v1/dedications')->assertJsonCount(5, 'dedications');
        $this->as($owner)->getJson('/v1/admin/dedications')->assertJsonCount(6, 'dedications');
        $this->as($owner)->patchJson("/v1/admin/dedications/$id", ['hidden' => false, 'names' => ['ar' => 'اسم معدّل']]);

        $ids = collect($this->as($owner)->getJson('/v1/admin/dedications')->json('dedications'))->pluck('id')->all();
        $this->as($owner)->postJson('/v1/admin/dedications/order', ['ids' => array_slice($ids, 0, 3)])->assertStatus(400);
        $this->as($owner)->postJson('/v1/admin/dedications/order', ['ids' => array_reverse($ids)])->assertOk();
        $this->getJson('/v1/dedications')->assertJsonPath('dedications.0.names.ar', 'اسم معدّل');

        $this->as($owner)->deleteJson("/v1/admin/dedications/$id")->assertNoContent();
        $this->getJson('/v1/dedications')->assertJsonCount(5, 'dedications');
    }

    public function test_deleting_an_account_drops_its_pending_requests_and_keeps_approved_names(): void
    {
        $owner = $this->owner();
        $sara = $this->register('sara@example.com', 'sara');
        $saraId = GameUser::findByUsername('sara')->id;
        $approved = $this->as($sara)->postJson('/v1/dedications/requests', ['names' => ['ar' => 'مقبول']])->json('request.id');
        $this->as($sara)->postJson('/v1/dedications/requests', ['names' => ['ar' => 'معلق']]);
        $this->as($owner)->postJson("/v1/admin/requests/$approved/approve")->assertOk();

        $this->as($sara)->deleteJson('/v1/me')->assertNoContent();
        $this->assertSame(1, DB::table('dedication_requests')->count());
        $this->assertNull(DB::table('dedication_requests')->value('user_id'));
        $this->assertSame(0, DB::table('dedication_requests')->where('user_id', $saraId)->count());
        $this->getJson('/v1/dedications')->assertJsonPath('dedications.5.names.ar', 'مقبول');
    }

    // ---- bans and edits --------------------------------------------------------

    private function idOf(string $username): int
    {
        return (int) DB::table('game_users')->where('username', $username)->value('id');
    }

    public function test_a_banned_player_is_signed_out_hidden_and_can_be_unbanned(): void
    {
        $owner = $this->owner();
        $helper = $this->verified('helper@example.com', 'helper');
        $this->as($owner)->postJson('/v1/admin/admins', ['email' => 'helper@example.com'])->assertCreated();
        $bad = $this->register('bad@example.com', 'badguy');
        $fan = $this->register('fan@example.com', 'fan');
        $this->as($fan)->putJson('/v1/follows/badguy')->assertOk();
        $this->as($bad)->postJson('/v1/progress', ['completions' => [[
            'windowKey' => '2026-09-29:Dhuhr', 'itemId' => 'tasbih-33', 'kind' => 'task', 'points' => 30,
            'startedAt' => now()->getTimestampMs() - 60000, 'doneAt' => now()->getTimestampMs() - 1000,
        ]]])->assertOk();

        // Any admin (not only the owner) bans a player.
        $this->as($helper)->postJson('/v1/admin/users/'.$this->idOf('badguy').'/ban', ['reason' => "spam\u{202E}"])->assertNoContent();
        $this->as($bad)->getJson('/v1/me')->assertUnauthorized(); // every device signed out
        $this->postJson('/v1/auth/login', ['email' => 'bad@example.com', 'password' => 'secret-pass-1'])
            ->assertStatus(403)->assertJson(['error' => 'banned']);

        $this->as($fan)->getJson('/v1/users/badguy')->assertNotFound();
        $this->assertSame([], $this->as($fan)->getJson('/v1/users?q=badg')->json('users'));
        $this->assertSame([], $this->as($fan)->getJson('/v1/follows')->json('users'));
        $this->assertNotContains('badguy', collect($this->as($fan)->getJson('/v1/leaderboard?period=all')->json('rows'))->pluck('username')->all());

        $row = collect($this->as($helper)->getJson('/v1/admin/users?q=badguy')->json('users'))->first();
        $this->assertTrue($row['banned']);
        $this->assertSame('spam', $row['banReason']);
        $this->assertSame('helper@example.com', $row['bannedBy']);

        $this->as($helper)->deleteJson('/v1/admin/users/'.$this->idOf('badguy').'/ban')->assertNoContent();
        $this->postJson('/v1/auth/login', ['email' => 'bad@example.com', 'password' => 'secret-pass-1'])->assertOk();
        $this->as($fan)->getJson('/v1/users/badguy')->assertOk()->assertJsonPath('points', 30);

        $actions = DB::table('game_admin_log')->orderBy('id')->pluck('action')->all();
        $this->assertSame(['admin.add', 'user.ban', 'user.unban'], $actions);
    }

    public function test_admins_cant_be_banned_or_edited_and_nobody_bans_themselves(): void
    {
        $owner = $this->owner();
        $this->verified('helper@example.com', 'helper');
        $this->as($owner)->postJson('/v1/admin/admins', ['email' => 'helper@example.com'])->assertCreated();
        $this->as($owner)->postJson('/v1/admin/users/'.$this->idOf('helper').'/ban')->assertForbidden()->assertJson(['error' => 'is-admin']);
        $this->as($owner)->patchJson('/v1/admin/users/'.$this->idOf('helper'), ['username' => 'x_x_x'])->assertForbidden();
        $this->as($owner)->postJson('/v1/admin/users/'.$this->idOf('owner').'/ban')->assertStatus(400);
        $t = $this->register('p@example.com', 'player');
        $this->as($t)->postJson('/v1/admin/users/'.$this->idOf('owner').'/ban')->assertForbidden();
    }

    public function test_an_admin_edits_a_players_name_email_and_privacy(): void
    {
        $owner = $this->owner();
        $t = $this->verified('old@example.com', 'oldname');
        $this->register('other@example.com', 'taken');
        $id = $this->idOf('oldname');
        $url = "/v1/admin/users/$id";

        $this->as($owner)->patchJson($url, ['username' => 'Taken'])->assertStatus(409)->assertJson(['error' => 'username-taken']);
        $this->as($owner)->patchJson($url, ['username' => 'a b'])->assertStatus(400)->assertJson(['error' => 'bad-username']);
        $this->as($owner)->patchJson($url, ['email' => 'other@example.com'])->assertStatus(409)->assertJson(['error' => 'email-taken']);
        $this->as($owner)->patchJson($url, ['email' => self::OWNER])->assertStatus(409);

        $this->as($owner)->patchJson($url, [
            'username' => 'NewName', 'displayName' => "  Ali\u{200B}  ", 'email' => 'New@Example.com', 'hideProgress' => true,
        ])->assertNoContent();
        $me = $this->as($t)->getJson('/v1/me')->assertOk()->json('user'); // still signed in
        $this->assertSame(['NewName', 'Ali', 'new@example.com', false, true],
            [$me['username'], $me['displayName'], $me['email'], $me['emailVerified'], $me['hideProgress']]);
        $this->postJson('/v1/auth/login', ['email' => 'new@example.com', 'password' => 'secret-pass-1'])->assertOk();
        // Same name in another case is the same name.
        $this->as($owner)->patchJson($url, ['username' => 'newname'])->assertNoContent();

        $log = DB::table('game_admin_log')->where('action', 'user.edit')->orderBy('id')->get();
        $this->assertCount(2, $log);
        $this->assertStringContainsString('oldname', $log[0]->details);
    }
}
