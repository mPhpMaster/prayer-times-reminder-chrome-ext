<?php

namespace App\Support;

use App\Models\GameUser;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Sign in with Apple: configuration (services.apple), the web flow's return
 * hop, and the optional server key.
 *
 * Web flow (Chrome, website, Windows, Android): the app opens
 * appleid.apple.com/auth/authorize for the Services ID with
 * response_mode=form_post, so Apple POSTs the result to our Return URL
 * (POST /v1/auth/apple/callback). That route only forwards it: it 303s to the
 * app's own return address, picked from a fixed allow-list by the `state`
 * prefix, with the token in the URL fragment. The app checks state + nonce and
 * then signs in with POST /v1/auth/apple like the native iOS app does.
 *
 * Server key (optional): with APPLE_TEAM_ID / APPLE_KEY_ID /
 * APPLE_PRIVATE_KEY_PATH set, the one-time authorization code is exchanged for
 * a refresh token, kept encrypted, and revoked with Apple when the player
 * unlinks Apple or deletes the account (App Store review guideline 5.1.1(v)).
 */
final class AppleSignIn
{
    private const TOKEN_URL = 'https://appleid.apple.com/auth/token';

    private const REVOKE_URL = 'https://appleid.apple.com/auth/revoke';

    /** Desktop loopback ports (targets/desktop/src-tauri/src/google_auth.rs). */
    private const DESKTOP_PORTS = [53917, 53918, 53919];

    /** Accepted identity-token audiences: native bundle ids + the web Services ID. */
    public static function audiences(): array
    {
        $ids = (array) config('services.apple.client_ids', []);
        if ($sid = self::servicesId()) {
            $ids[] = $sid;
        }

        return array_values(array_unique(array_filter(array_map('strval', $ids))));
    }

    public static function enabled(): bool
    {
        return self::audiences() !== [];
    }

    public static function servicesId(): ?string
    {
        return config('services.apple.services_id') ?: null;
    }

    public static function redirectUri(): string
    {
        return config('services.apple.redirect_uri') ?: rtrim((string) config('app.url'), '/').'/v1/auth/apple/callback';
    }

    /** For GET /v1/auth/config: null = off. servicesId null = native (iOS) sign-in only. */
    public static function publicConfig(): ?array
    {
        if (! self::enabled()) {
            return null;
        }
        $sid = self::servicesId();

        return ['servicesId' => $sid, 'redirectUri' => $sid ? self::redirectUri() : null];
    }

    /**
     * Where the callback may send the player back, from the `state` the app
     * chose: "<target>.<random>". Only these targets exist:
     *   ext-<id>     the Chrome extension (APPLE_EXTENSION_IDS) -> https://<id>.chromiumapp.org/apple
     *   web          the website (APPLE_WEB_RETURN)
     *   desk-<port>  the Windows app's loopback listener -> http://127.0.0.1:<port>/
     *   app          the Android app's own WebView origin -> https://localhost/apple-callback.html
     */
    public static function returnUrl(string $state): ?string
    {
        if (! preg_match('/^(ext-[a-p]{32}|web|app|desk-\d{5})\.[A-Za-z0-9_-]{16,128}$/', $state, $m)) {
            return null;
        }
        $target = $m[1];
        if ($target === 'web') {
            return config('services.apple.web_return') ?: null;
        }
        if ($target === 'app') {
            return 'https://localhost/apple-callback.html';
        }
        if (str_starts_with($target, 'desk-')) {
            $port = (int) substr($target, 5);

            return in_array($port, self::DESKTOP_PORTS, true) ? "http://127.0.0.1:$port/" : null;
        }
        $id = substr($target, 4);

        return in_array($id, (array) config('services.apple.extension_ids', []), true) ? "https://$id.chromiumapp.org/apple" : null;
    }

    // ---- server key: refresh token + revocation (optional) ---------------------

    public static function hasKey(): bool
    {
        $path = config('services.apple.private_key_path');

        return config('services.apple.team_id') && config('services.apple.key_id') && $path && is_readable($path);
    }

    /** The ES256 client secret Apple wants for /auth/token and /auth/revoke (valid 5 minutes). */
    public static function clientSecret(string $clientId): ?string
    {
        if (! self::hasKey()) {
            return null;
        }
        $key = openssl_pkey_get_private((string) file_get_contents(config('services.apple.private_key_path')));
        if (! $key) {
            return null;
        }
        $b64 = fn (string $s) => rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
        $now = now()->getTimestamp();
        $input = $b64(json_encode(['alg' => 'ES256', 'kid' => (string) config('services.apple.key_id')]))
            .'.'.$b64(json_encode([
                'iss' => (string) config('services.apple.team_id'),
                'iat' => $now,
                'exp' => $now + 300,
                'aud' => AppleIdToken::ISSUER,
                'sub' => $clientId,
            ]));
        if (! openssl_sign($input, $der, $key, OPENSSL_ALGO_SHA256)) {
            return null;
        }
        $raw = self::rawSignature($der);

        return $raw ? $input.'.'.$b64($raw) : null;
    }

    /**
     * After a sign-in or link: swap the one-time code for a refresh token and
     * keep it (encrypted) for revocation. Best effort: sign-in never fails here.
     */
    public static function keepRefreshToken(GameUser $user, ?string $code, string $clientId): void
    {
        if (! $code || strlen($code) > 512 || ! self::hasKey()) {
            return;
        }
        try {
            $form = [
                'client_id' => $clientId,
                'client_secret' => self::clientSecret($clientId),
                'code' => $code,
                'grant_type' => 'authorization_code',
            ];
            if ($clientId === self::servicesId()) {
                $form['redirect_uri'] = self::redirectUri(); // web codes are bound to the Return URL
            }
            $res = Http::asForm()->timeout(10)->post(self::TOKEN_URL, $form);
            $refresh = $res->ok() ? $res->json('refresh_token') : null;
            if (is_string($refresh) && $refresh !== '') {
                $user->apple_refresh_token = Crypt::encryptString(json_encode(['c' => $clientId, 't' => $refresh]));
                $user->save();
            } else {
                Log::warning('apple code exchange failed', ['status' => $res->status(), 'error' => $res->json('error')]);
            }
        } catch (Throwable $e) {
            Log::warning('apple code exchange failed', ['error' => $e->getMessage()]);
        }
    }

    /** Revoke the kept refresh token with Apple and forget it (unlink / account deletion). Best effort. */
    public static function revoke(GameUser $user): void
    {
        $stored = $user->apple_refresh_token;
        if (! $stored) {
            return;
        }
        $user->apple_refresh_token = null;
        try {
            $data = json_decode(Crypt::decryptString($stored), true);
            $secret = is_array($data) ? self::clientSecret((string) $data['c']) : null;
            if ($secret) {
                Http::asForm()->timeout(10)->post(self::REVOKE_URL, [
                    'client_id' => $data['c'],
                    'client_secret' => $secret,
                    'token' => $data['t'],
                    'token_type_hint' => 'refresh_token',
                ]);
            }
        } catch (Throwable $e) {
            Log::warning('apple token revocation failed', ['error' => $e->getMessage()]);
        }
    }

    /** OpenSSL's DER ECDSA signature (SEQUENCE of two INTEGERs) as JOSE's raw r||s, 32 bytes each. */
    private static function rawSignature(string $der): ?string
    {
        $pos = 0;
        $read = function () use ($der, &$pos): ?array {
            if ($pos + 2 > strlen($der)) {
                return null;
            }
            $tag = ord($der[$pos++]);
            $len = ord($der[$pos++]);
            if ($len & 0x80) {
                $n = $len & 0x7F;
                $len = 0;
                for ($i = 0; $i < $n; $i++) {
                    $len = ($len << 8) | ord($der[$pos++]);
                }
            }

            return [$tag, $len];
        };
        $seq = $read();
        if (! $seq || $seq[0] !== 0x30) {
            return null;
        }
        $out = '';
        for ($i = 0; $i < 2; $i++) {
            $int = $read();
            if (! $int || $int[0] !== 0x02) {
                return null;
            }
            $v = ltrim(substr($der, $pos, $int[1]), "\x00");
            $pos += $int[1];
            if (strlen($v) > 32) {
                return null;
            }
            $out .= str_pad($v, 32, "\x00", STR_PAD_LEFT);
        }

        return $out;
    }
}
