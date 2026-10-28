<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Verifies a "Sign in with Apple" identity token (a JWT signed RS256 by Apple)
 * locally against Apple's published keys (JWKS, cached a day; fetched again
 * when Apple signs with a key we don't have yet). No secret is involved: the
 * token must be signed by Apple, issued by https://appleid.apple.com for one
 * of our audiences (AppleSignIn::audiences(): the iOS bundle id or the web
 * Services ID), unexpired, and carry the caller's nonce when one is given.
 *
 * Apple puts the email in the token only when the player shared it (always on
 * the first authorization; it may be a private relay address
 * xyz@privaterelay.appleid.com). The account is keyed by `sub`, never by email.
 */
final class AppleIdToken
{
    public const ISSUER = 'https://appleid.apple.com';

    public const JWKS_URL = 'https://appleid.apple.com/auth/keys';

    private const CACHE_KEY = 'apple-jwks';

    /**
     * @return array{sub:string,email:?string,aud:string,privateRelay:bool}|null  null = not a valid token for us
     */
    public static function verify(string $jwt, ?string $nonce = null): ?array
    {
        $audiences = AppleSignIn::audiences();
        if (! $audiences || $jwt === '' || strlen($jwt) > 8192) {
            return null;
        }
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) {
            return null;
        }
        $header = json_decode(self::b64($parts[0]) ?? '', true);
        $claims = json_decode(self::b64($parts[1]) ?? '', true);
        $signature = self::b64($parts[2]);
        if (! is_array($header) || ! is_array($claims) || $signature === null || ($header['alg'] ?? '') !== 'RS256') {
            return null;
        }
        $key = self::key((string) ($header['kid'] ?? ''));
        if (! $key || openssl_verify($parts[0].'.'.$parts[1], $signature, $key, OPENSSL_ALGO_SHA256) !== 1) {
            return null;
        }

        $aud = $claims['aud'] ?? null;
        $aud = is_array($aud) ? array_values(array_intersect($aud, $audiences))[0] ?? null : $aud;
        $now = now()->getTimestamp();
        $ok = ($claims['iss'] ?? '') === self::ISSUER
            && is_string($aud) && in_array($aud, $audiences, true)
            && (int) ($claims['exp'] ?? 0) > $now
            && (int) ($claims['iat'] ?? 0) <= $now + 300
            && is_string($claims['sub'] ?? null) && $claims['sub'] !== '' && strlen($claims['sub']) <= 64;
        if (! $ok) {
            return null;
        }
        if ($nonce !== null && $nonce !== '') {
            // Web flows send the nonce as is; native iOS sends its SHA-256 (hex)
            // to Apple and the raw value to us.
            $got = (string) ($claims['nonce'] ?? '');
            if ($got === '' || ! (hash_equals($got, $nonce) || hash_equals($got, hash('sha256', $nonce)))) {
                return null;
            }
        }

        $email = is_string($claims['email'] ?? null) ? mb_strtolower(trim($claims['email'])) : null;
        $verified = in_array($claims['email_verified'] ?? true, [true, 'true'], true); // Apple only sends verified addresses
        if (! $email || ! $verified || ! filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 191) {
            $email = null;
        }

        return [
            'sub' => $claims['sub'],
            'email' => $email,
            'aud' => $aud,
            'privateRelay' => in_array($claims['is_private_email'] ?? false, [true, 'true'], true),
        ];
    }

    /** Apple's public key `kid` as an OpenSSL key, from the cached JWKS (refetched once for an unknown kid). */
    private static function key(string $kid)
    {
        if ($kid === '') {
            return null;
        }
        $keys = Cache::get(self::CACHE_KEY);
        if (! is_array($keys) || ! isset($keys[$kid])) {
            // Apple rotates keys: fetch again, at most once a minute.
            if (is_array($keys) && ! Cache::add(self::CACHE_KEY.'-refetch', 1, 60)) {
                return null;
            }
            $fresh = self::fetch();
            if ($fresh === null) {
                if (! is_array($keys)) {
                    GameRules::fail(503, 'apple-unreachable');
                }

                return null;
            }
            Cache::put(self::CACHE_KEY, $keys = $fresh, 86400);
        }
        $jwk = $keys[$kid] ?? null;
        if (! is_array($jwk) || ($jwk['kty'] ?? '') !== 'RSA' || empty($jwk['n']) || empty($jwk['e'])) {
            return null;
        }
        $n = self::b64($jwk['n']);
        $e = self::b64($jwk['e']);

        return $n && $e ? openssl_pkey_get_public(self::pem($n, $e)) : null;
    }

    /** @return array<string,array>|null  kid => JWK */
    private static function fetch(): ?array
    {
        try {
            $res = Http::timeout(10)->get(self::JWKS_URL);
        } catch (Throwable) {
            return null;
        }
        if (! $res->ok() || ! is_array($res->json('keys'))) {
            return null;
        }
        $out = [];
        foreach ($res->json('keys') as $k) {
            if (is_array($k) && isset($k['kid'])) {
                $out[(string) $k['kid']] = $k;
            }
        }

        return $out ?: null;
    }

    private static function b64(string $s): ?string
    {
        $raw = base64_decode(strtr($s, '-_', '+/').str_repeat('=', (4 - strlen($s) % 4) % 4), true);

        return $raw === false ? null : $raw;
    }

    // ---- an RSA public key (SubjectPublicKeyInfo, PEM) from the JWK's n and e ----

    private static function pem(string $n, string $e): string
    {
        $rsa = self::der(0x30, self::der(0x02, self::unsigned($n)).self::der(0x02, self::unsigned($e)));
        $algo = hex2bin('300d06092a864886f70d0101010500'); // rsaEncryption, NULL params
        $spki = self::der(0x30, $algo.self::der(0x03, "\x00".$rsa));

        return "-----BEGIN PUBLIC KEY-----\n".chunk_split(base64_encode($spki), 64, "\n")."-----END PUBLIC KEY-----\n";
    }

    /** A DER INTEGER is signed: a leading 0x00 keeps a high first bit positive. */
    private static function unsigned(string $bytes): string
    {
        $bytes = ltrim($bytes, "\x00");

        return ($bytes === '' || ord($bytes[0]) > 0x7F) ? "\x00".$bytes : $bytes;
    }

    private static function der(int $tag, string $body): string
    {
        $len = strlen($body);
        if ($len < 0x80) {
            return chr($tag).chr($len).$body;
        }
        $bytes = ltrim(pack('N', $len), "\x00");

        return chr($tag).chr(0x80 | strlen($bytes)).$bytes.$body;
    }
}
