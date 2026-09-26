<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Verifies a Google ID token from the app (Credential Manager, requested for
 * our web client id) with Google's tokeninfo endpoint. No secret is involved:
 * the check is that Google vouches for the token AND it was issued for our
 * client id (services.google.client_id), unexpired, with a verified email.
 */
final class GoogleIdToken
{
    /** @return array{sub:string,email:string}|null  null = not a valid token for us */
    public static function verify(string $idToken): ?array
    {
        $clientId = config('services.google.client_id');
        if (! $clientId || strlen($idToken) > 4096) {
            return null;
        }
        try {
            $res = Http::timeout(10)->get('https://oauth2.googleapis.com/tokeninfo', ['id_token' => $idToken]);
        } catch (Throwable) {
            GameRules::fail(503, 'google-unreachable');
        }
        if (! $res->ok()) {
            return null;
        }
        $c = $res->json();
        $okIss = in_array($c['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true);
        $okAud = ($c['aud'] ?? null) === $clientId;
        $okExp = (int) ($c['exp'] ?? 0) > now()->getTimestamp();
        $okMail = in_array($c['email_verified'] ?? null, [true, 'true'], true) && ! empty($c['email']);
        if (! $okIss || ! $okAud || ! $okExp || ! $okMail || empty($c['sub'])) {
            return null;
        }

        return ['sub' => (string) $c['sub'], 'email' => mb_strtolower((string) $c['email'])];
    }
}
