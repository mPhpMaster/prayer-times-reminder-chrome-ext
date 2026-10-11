<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Google Play Integrity for the Android app. The app asks Google for a token
 * bound to a one-time nonce from us (IntegrityController::challenge); Google
 * decrypts it for us (decodeIntegrityToken), and verdict() decides whether
 * the request came from our unmodified Play build on a genuine device.
 *
 * Google is called with a service-account key (services.play_integrity):
 * a signed JWT is traded for an access token, cached for 50 minutes.
 */
final class PlayIntegrity
{
    /** How old a token may be when it reaches us. */
    public const MAX_AGE_MS = 10 * 60 * 1000;

    /** A passing check shows the "verified" mark for this long. */
    public const VALID_DAYS = 30;

    public static function configured(): bool
    {
        $file = config('services.play_integrity.credentials');

        return $file && is_readable($file) && self::projectNumber() !== null;
    }

    public static function projectNumber(): ?string
    {
        $n = (string) config('services.play_integrity.project_number');

        return preg_match('/^\d{6,20}$/', $n) ? $n : null;
    }

    public static function package(): string
    {
        return (string) config('services.play_integrity.package');
    }

    /** The token's decoded payload, or null when Google rejects the token. */
    public static function decode(string $token): ?array
    {
        $url = 'https://playintegrity.googleapis.com/v1/'.rawurlencode(self::package()).':decodeIntegrityToken';
        try {
            $res = Http::timeout(15)->withToken(self::accessToken())->post($url, ['integrity_token' => $token]);
        } catch (Throwable) {
            GameRules::fail(503, 'integrity-unreachable');
        }
        if ($res->status() === 400) {
            return null;
        }
        if (! $res->ok()) {
            GameRules::fail(503, 'integrity-unreachable');
        }

        return $res->json('tokenPayloadExternal');
    }

    /**
     * Pass / fail for a decoded payload.
     *
     * @return array{ok:bool, detail:string}  detail lists what failed (and the
     *                                        licence verdict, for the admins)
     */
    public static function verdict(?array $p, string $nonce, int $nowMs): array
    {
        if (! $p) {
            return ['ok' => false, 'detail' => 'invalid-token'];
        }
        $why = [];
        $req = $p['requestDetails'] ?? [];
        if (($req['requestPackageName'] ?? null) !== self::package()) {
            $why[] = 'package';
        }
        if (! hash_equals($nonce, (string) ($req['requestHash'] ?? ''))) {
            $why[] = 'request-hash';
        }
        $at = (int) ($req['timestampMillis'] ?? 0);
        if (abs($nowMs - $at) > self::MAX_AGE_MS) {
            $why[] = 'stale';
        }
        $app = $p['appIntegrity']['appRecognitionVerdict'] ?? 'UNEVALUATED';
        if ($app !== 'PLAY_RECOGNIZED') {
            $why[] = 'app:'.$app;
        }
        $device = (array) ($p['deviceIntegrity']['deviceRecognitionVerdict'] ?? []);
        if (! in_array('MEETS_DEVICE_INTEGRITY', $device, true)) {
            $why[] = 'device:'.($device ? implode('+', $device) : 'NONE');
        }
        $licence = $p['accountDetails']['appLicensingVerdict'] ?? 'UNEVALUATED';
        $ok = $why === [];
        if ($licence !== 'LICENSED') {
            $why[] = 'licence:'.$licence; // shown to admins; not a failure on its own
        }

        return ['ok' => $ok, 'detail' => mb_substr(implode(' ', $why), 0, 160)];
    }

    private static function accessToken(): string
    {
        return Cache::remember('play-integrity-access-token', 50 * 60, function () {
            $key = json_decode((string) file_get_contents(config('services.play_integrity.credentials')), true);
            $tokenUri = $key['token_uri'] ?? 'https://oauth2.googleapis.com/token';
            $now = time();
            $b64 = fn (string $s) => rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
            $unsigned = $b64(json_encode(['alg' => 'RS256', 'typ' => 'JWT'])).'.'.$b64(json_encode([
                'iss' => $key['client_email'] ?? '',
                'scope' => 'https://www.googleapis.com/auth/playintegrity',
                'aud' => $tokenUri,
                'iat' => $now,
                'exp' => $now + 3600,
            ]));
            if (! openssl_sign($unsigned, $sig, (string) ($key['private_key'] ?? ''), OPENSSL_ALGO_SHA256)) {
                GameRules::fail(503, 'integrity-off');
            }
            try {
                $res = Http::asForm()->timeout(15)->post($tokenUri, [
                    'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    'assertion' => $unsigned.'.'.$b64($sig),
                ]);
            } catch (Throwable) {
                GameRules::fail(503, 'integrity-unreachable');
            }
            $token = $res->json('access_token');
            if (! $res->ok() || ! $token) {
                GameRules::fail(503, 'integrity-unreachable');
            }

            return $token;
        });
    }
}
