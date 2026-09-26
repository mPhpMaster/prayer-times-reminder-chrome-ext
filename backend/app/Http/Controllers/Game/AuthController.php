<?php

namespace App\Http\Controllers\Game;

use App\Http\Controllers\Controller;
use App\Models\GameUser;
use App\Support\GameAccounts;
use App\Support\GameRules;
use App\Support\GoogleIdToken;
use App\Http\Middleware\GameAuth;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Sign-in for the game: email + password, or a Google account. Every success
 * returns {user, token} with a fresh per-device token (shown once).
 *
 * Any sign-in may carry `legacyToken` — the token of a name-only account from
 * before real sign-in existed. That account is then upgraded in place (a new
 * account) or folded into the existing one (GameAccounts::absorb), so its
 * points and follows survive without being counted twice.
 */
class AuthController extends Controller
{
    private const RESET_MINUTES = 15;

    private const RESET_ATTEMPTS = 5;

    /** GET /v1/auth/config -> {google: {clientId} | null}. Public ids only, never secrets. */
    public function config(): JsonResponse
    {
        $id = config('services.google.client_id');

        return response()->json(['google' => $id ? ['clientId' => $id] : null]);
    }

    /** POST /v1/auth/register {email, password, username, legacyToken?} */
    public function register(Request $request): JsonResponse
    {
        $email = GameRules::email($request->input('email'));
        $password = GameRules::password($request->input('password'));
        if (GameUser::where('email', $email)->exists()) {
            GameRules::fail(409, 'email-taken');
        }
        $legacy = $this->legacy($request);
        try {
            if ($legacy) {
                $legacy->fill(['email' => $email, 'password' => Hash::make($password)])->save();
                GameAccounts::revokeAll($legacy); // the old name-only token retires
                $user = $legacy;
            } else {
                $user = $this->create($request->input('username'), ['email' => $email, 'password' => Hash::make($password)]);
            }
        } catch (UniqueConstraintViolationException) {
            GameRules::fail(409, 'email-taken'); // lost a race for the same email
        }

        return $this->signedIn($user, 201);
    }

    /** POST /v1/auth/login {email, password, legacyToken?} */
    public function login(Request $request): JsonResponse
    {
        $email = mb_strtolower(trim((string) $request->input('email')));
        $password = (string) $request->input('password');
        $user = $email !== '' ? GameUser::where('email', $email)->first() : null;
        // Always run one hash check, so response time doesn't reveal which emails exist.
        $ok = Hash::check($password, $user?->password ?? '$2y$12$'.str_repeat('x', 53));
        if (! $user || ! $user->password || ! $ok) {
            GameRules::fail(401, 'bad-credentials');
        }
        $this->absorbLegacy($request, $user);

        return $this->signedIn($user);
    }

    /** POST /v1/auth/google {idToken, username?, legacyToken?} */
    public function google(Request $request): JsonResponse
    {
        if (! config('services.google.client_id')) {
            GameRules::fail(503, 'google-unavailable');
        }
        $claims = GoogleIdToken::verify((string) $request->input('idToken'));
        if (! $claims) {
            GameRules::fail(401, 'google-invalid');
        }

        $user = GameUser::where('google_sub', $claims['sub'])->first();
        if (! $user && ($user = GameUser::where('email', $claims['email'])->first())) {
            if ($user->google_sub !== null) {
                GameRules::fail(409, 'account-conflict'); // that email is tied to another Google account
            }
            $user->google_sub = $claims['sub']; // same verified email: link Google to it
            $user->save();
        }
        if ($user) {
            $this->absorbLegacy($request, $user);

            return $this->signedIn($user);
        }

        $legacy = $this->legacy($request);
        if ($legacy) {
            $legacy->fill(['google_sub' => $claims['sub'], 'email' => $claims['email']])->save();
            GameAccounts::revokeAll($legacy);

            return $this->signedIn($legacy, 201);
        }
        if (! $request->filled('username')) {
            GameRules::fail(422, 'username-required'); // new player: the app asks for a public name
        }
        $user = $this->create($request->input('username'), ['google_sub' => $claims['sub'], 'email' => $claims['email']]);

        return $this->signedIn($user, 201);
    }

    /** POST /v1/auth/logout -> 204. Revokes this device's token only. */
    public function logout(Request $request): Response
    {
        DB::table('game_tokens')->where('id', $request->attributes->get('gameTokenId'))->delete();

        return response()->noContent();
    }

    /**
     * POST /v1/auth/forgot {email} -> 204, whether or not the email has an
     * account (no enumeration). If it does, a 6-digit code valid for 15
     * minutes is emailed; only its hash is stored.
     */
    public function forgot(Request $request): Response
    {
        $email = mb_strtolower(trim((string) $request->input('email')));
        $user = $email !== '' ? GameUser::where('email', $email)->first() : null;
        if ($user) {
            $code = (string) random_int(100000, 999999);
            DB::table('game_password_resets')->updateOrInsert(
                ['email' => $email],
                ['code_hash' => Hash::make($code), 'attempts' => 0, 'expires_at' => now()->addMinutes(self::RESET_MINUTES)],
            );
            try {
                Mail::raw(
                    "رمز استعادة كلمة المرور في لعبة أذكار الصلاة: $code\n".
                    'Your Prayer Adhkar password reset code: '.$code."\n\n".
                    'صالح لمدة '.self::RESET_MINUTES.' دقيقة. إن لم تطلبه فتجاهل هذه الرسالة.'."\n".
                    'Valid for '.self::RESET_MINUTES." minutes. If you didn't ask for it, ignore this email.",
                    fn ($m) => $m->to($email)->subject('رمز استعادة كلمة المرور / Password reset code'),
                );
            } catch (Throwable $e) {
                Log::error('game password reset mail failed', ['error' => $e->getMessage()]);
            }
        }

        return response()->noContent();
    }

    /** POST /v1/auth/reset {email, code, password} -> {user, token}; signs out every other device. */
    public function reset(Request $request): JsonResponse
    {
        $email = mb_strtolower(trim((string) $request->input('email')));
        $row = DB::table('game_password_resets')->where('email', $email)->first();
        if (! $row) {
            GameRules::fail(400, 'bad-code');
        }
        if (now()->greaterThan($row->expires_at)) {
            DB::table('game_password_resets')->where('email', $email)->delete();
            GameRules::fail(400, 'code-expired');
        }
        if ($row->attempts >= self::RESET_ATTEMPTS) {
            GameRules::fail(429, 'too-many-attempts');
        }
        if (! Hash::check((string) $request->input('code'), $row->code_hash)) {
            DB::table('game_password_resets')->where('email', $email)->increment('attempts');
            GameRules::fail(400, 'bad-code');
        }
        $password = GameRules::password($request->input('password'));
        $user = GameUser::where('email', $email)->first();
        if (! $user) {
            GameRules::fail(400, 'bad-code');
        }
        $user->password = Hash::make($password);
        $user->save();
        DB::table('game_password_resets')->where('email', $email)->delete();
        GameAccounts::revokeAll($user);

        return $this->signedIn($user);
    }

    // ---- helpers ------------------------------------------------------------

    private function create(mixed $rawName, array $auth): GameUser
    {
        $name = GameRules::username($rawName);
        if (! $name) {
            GameRules::fail(400, 'bad-username');
        }
        if (GameUser::where('username_lower', mb_strtolower($name))->exists()) {
            GameRules::fail(409, 'username-taken');
        }
        try {
            return GameUser::create(['username' => $name, 'username_lower' => mb_strtolower($name)] + $auth);
        } catch (UniqueConstraintViolationException) {
            GameRules::fail(409, 'username-taken');
        }
    }

    /** The legacy (name-only) account behind `legacyToken`, if it really is one. */
    private function legacy(Request $request): ?GameUser
    {
        $u = GameAuth::userForToken($request->input('legacyToken'));

        return $u && $u->isLegacy() ? $u : null;
    }

    private function absorbLegacy(Request $request, GameUser $into): void
    {
        $legacy = $this->legacy($request);
        if ($legacy && $legacy->id !== $into->id) {
            GameAccounts::absorb($into, $legacy);
        }
    }

    private function signedIn(GameUser $user, int $status = 200): JsonResponse
    {
        $user->refresh();

        return response()->json(['user' => $user->toPrivate(), 'token' => GameAccounts::issueToken($user)], $status);
    }
}
