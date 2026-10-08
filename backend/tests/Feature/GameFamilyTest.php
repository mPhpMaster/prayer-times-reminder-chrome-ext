<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Families: invitations, roles, leaving, alerts state and a child's year. */
class GameFamilyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-10-08 20:00:00', 'UTC'));
        $this->withoutMiddleware(ThrottleRequests::class);
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

    /** $n tasks of a window, finished an hour ago. */
    private function done(string $token, string $key, int $n): void
    {
        $at = (int) now()->getTimestampMs() - 3600000;
        $rows = array_map(fn ($i) => ['windowKey' => $key, 'itemId' => "task-$i", 'kind' => 'task', 'points' => 10,
            'startedAt' => $at - 1000, 'doneAt' => $at], range(1, $n));
        $this->as($token)->postJson('/v1/progress', ['completions' => $rows])->assertOk();
    }

    private function inviteAndAccept(string $parent, string $token, string $name, string $role): void
    {
        $this->as($parent)->postJson('/v1/family/invites', ['username' => $name, 'role' => $role])->assertCreated();
        $id = $this->as($token)->getJson('/v1/family')->json('invites.0.id');
        $this->as($token)->postJson("/v1/family/invites/$id/accept")->assertOk();
    }

    public function test_a_parent_invites_and_the_child_must_accept(): void
    {
        $dad = $this->register('dad');
        $kid = $this->register('kid');
        $this->as($dad)->getJson('/v1/family')->assertJson(['family' => null, 'invites' => [], 'sent' => []]);
        $this->as($dad)->postJson('/v1/family')->assertCreated()
            ->assertJsonPath('family.role', 'parent')->assertJsonPath('family.notify', 'window');
        $this->as($dad)->postJson('/v1/family')->assertStatus(409);

        $this->as($kid)->postJson('/v1/family/invites', ['username' => 'dad', 'role' => 'child'])->assertNotFound(); // no family
        $this->as($dad)->postJson('/v1/family/invites', ['username' => 'nobody', 'role' => 'child'])->assertNotFound();
        $this->as($dad)->postJson('/v1/family/invites', ['username' => 'kid', 'role' => 'boss'])->assertStatus(400);
        $this->as($dad)->postJson('/v1/family/invites', ['username' => 'dad', 'role' => 'child'])->assertStatus(400);
        $this->as($dad)->postJson('/v1/family/invites', ['username' => 'Kid', 'role' => 'child'])->assertCreated()
            ->assertJsonPath('sent.0.to.username', 'kid');
        $this->as($dad)->postJson('/v1/family/invites', ['username' => 'kid', 'role' => 'child'])->assertStatus(409);

        // Not a member until they say yes; nobody else can accept for them.
        $this->as($dad)->getJson('/v1/family')->assertJsonCount(1, 'family.members');
        $inv = $this->as($kid)->getJson('/v1/family')->assertJsonPath('invites.0.from.username', 'dad')
            ->assertJsonPath('invites.0.role', 'child')->json('invites.0.id');
        $this->as($dad)->postJson("/v1/family/invites/$inv/accept")->assertNotFound();
        $this->as($kid)->postJson("/v1/family/invites/$inv/accept")->assertOk()
            ->assertJsonPath('family.role', 'child')->assertJsonPath('family.notify', null)
            ->assertJsonCount(2, 'family.members')->assertJsonPath('invites', []);

        // A child sees the family but can't manage it.
        $this->as($kid)->postJson('/v1/family/invites', ['username' => 'dad', 'role' => 'child'])->assertForbidden();
        $this->as($kid)->postJson('/v1/family/leave')->assertForbidden()->assertJson(['error' => 'children-cant-leave']);
        $this->as($kid)->getJson('/v1/family/status')->assertForbidden();
        $this->as($kid)->patchJson('/v1/family/me', ['notify' => 'off'])->assertForbidden();
    }

    public function test_declining_cancelling_and_one_family_at_a_time(): void
    {
        $mom = $this->register('mom');
        $dad = $this->register('dad');
        $kid = $this->register('kid');
        $this->as($mom)->postJson('/v1/family')->assertCreated();
        $this->as($dad)->postJson('/v1/family')->assertCreated();
        $this->as($mom)->postJson('/v1/family/invites', ['username' => 'kid', 'role' => 'child'])->assertCreated();
        $this->as($dad)->postJson('/v1/family/invites', ['username' => 'kid', 'role' => 'child'])->assertCreated();
        $this->as($dad)->postJson('/v1/family/invites', ['username' => 'mom', 'role' => 'parent'])->assertStatus(409); // already in one

        [$a, $b] = $this->as($kid)->getJson('/v1/family')->assertJsonCount(2, 'invites')->json('invites.*.id');
        $this->as($kid)->deleteJson("/v1/family/invites/$a")->assertNoContent(); // declined
        $this->as($kid)->postJson("/v1/family/invites/$b/accept")->assertOk()->assertJsonPath('family.members.0.username', 'dad');

        // A parent cancels a pending invitation; another family's parent can't.
        $other = $this->register('other');
        $this->as($dad)->postJson('/v1/family/invites', ['username' => 'other', 'role' => 'child'])->assertCreated();
        $id = $this->as($other)->getJson('/v1/family')->json('invites.0.id');
        $this->as($mom)->deleteJson("/v1/family/invites/$id")->assertNotFound();
        $this->as($dad)->deleteJson("/v1/family/invites/$id")->assertNoContent();
        $this->as($other)->getJson('/v1/family')->assertJsonPath('invites', []);
    }

    public function test_parents_remove_children_leave_themselves_and_the_last_one_dissolves_it(): void
    {
        $mom = $this->register('mom');
        $dad = $this->register('dad');
        $kid = $this->register('kid');
        $kid2 = $this->register('kid2');
        $this->as($mom)->postJson('/v1/family')->assertCreated();
        $this->inviteAndAccept($mom, $dad, 'dad', 'parent');
        $this->inviteAndAccept($mom, $kid, 'kid', 'child');
        $this->inviteAndAccept($dad, $kid2, 'kid2', 'child');
        $this->as($kid)->getJson('/v1/family')->assertJsonPath('family.members.*.username', ['dad', 'mom', 'kid', 'kid2']);

        $this->as($dad)->deleteJson('/v1/family/members/mom')->assertForbidden()->assertJson(['error' => 'parents-leave-themselves']);
        $this->as($dad)->deleteJson('/v1/family/members/kid2')->assertNoContent();
        $this->as($kid2)->getJson('/v1/family')->assertJsonPath('family', null);

        $this->as($mom)->postJson('/v1/family/leave')->assertNoContent();
        $this->as($kid)->getJson('/v1/family')->assertJsonPath('family.members.*.username', ['dad', 'kid']);
        $this->as($dad)->postJson('/v1/family/invites', ['username' => 'kid2', 'role' => 'child'])->assertCreated();
        $this->as($dad)->postJson('/v1/family/leave')->assertNoContent(); // the last parent
        $this->as($kid)->getJson('/v1/family')->assertJsonPath('family', null);
        $this->as($kid2)->getJson('/v1/family')->assertJsonPath('invites', []);
        $this->assertSame(0, DB::table('game_families')->count());
    }

    public function test_deleting_the_last_parents_account_dissolves_the_family(): void
    {
        $dad = $this->register('dad');
        $kid = $this->register('kid');
        $this->as($dad)->postJson('/v1/family')->assertCreated();
        $this->inviteAndAccept($dad, $kid, 'kid', 'child');
        $this->as($dad)->deleteJson('/v1/me')->assertNoContent();
        $this->as($kid)->getJson('/v1/family')->assertJsonPath('family', null);
        $this->assertSame(0, DB::table('game_family_members')->count());
    }

    public function test_parents_see_window_status_and_a_childs_year_even_when_hidden(): void
    {
        $dad = $this->register('dad');
        $kid = $this->register('kid');
        $this->as($dad)->postJson('/v1/family')->assertCreated();
        $this->inviteAndAccept($dad, $kid, 'kid', 'child');
        $this->as($kid)->patchJson('/v1/me', ['hideProgress' => true])->assertOk();
        $this->done($kid, '2026-10-08:Fajr', 11);    // all 11
        $this->done($kid, '2026-10-08:Dhuhr', 4);    // 4 of 9
        $this->done($kid, '2026-09-30:Asr', 10);

        $this->as($dad)->getJson('/v1/family/status?keys=2026-10-08:Fajr,2026-10-08:Dhuhr,2026-10-08:Asr,bad')->assertOk()
            ->assertJsonPath('notify', 'window')
            ->assertJsonPath('children.0.username', 'kid')
            ->assertJsonPath('children.0.windows.2026-10-08:Fajr', ['done' => 11, 'total' => 11, 'complete' => true])
            ->assertJsonPath('children.0.windows.2026-10-08:Dhuhr', ['done' => 4, 'total' => 9, 'complete' => false])
            ->assertJsonPath('children.0.windows.2026-10-08:Asr', ['done' => 0, 'total' => 10, 'complete' => false]);
        $many = implode(',', array_map(fn ($d) => sprintf('2026-10-%02d:Fajr', $d), range(1, 11)));
        $this->as($dad)->getJson("/v1/family/status?keys=$many")->assertStatus(400);

        $y = $this->as($dad)->getJson('/v1/family/members/kid/year?year=2026')->assertOk()
            ->assertJsonPath('user.username', 'kid')->assertJsonPath('role', 'child')
            ->assertJsonPath('windows', 2)->assertJsonPath('activeDays', 2)->assertJsonPath('points', 250)
            ->json();
        $this->assertSame(['windows' => 1, 'points' => 150], $y['days']['2026-10-08']);
        $this->assertSame(100, $y['months'][8]);
        $this->as($dad)->getJson('/v1/family/members/kid/year?year=1999')->assertStatus(400);

        // Outsiders and children get nothing.
        $stranger = $this->register('stranger');
        $this->as($kid)->getJson('/v1/family/members/dad/year')->assertForbidden();
        $this->as($stranger)->getJson('/v1/family/members/kid/year')->assertNotFound();

        $this->as($dad)->patchJson('/v1/family/me', ['notify' => 'daily'])->assertOk()->assertJsonPath('family.notify', 'daily');
        $this->as($dad)->patchJson('/v1/family/me', ['notify' => 'loud'])->assertStatus(400);
    }
}
