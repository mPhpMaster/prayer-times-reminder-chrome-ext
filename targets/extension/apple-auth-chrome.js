// apple-auth-chrome.js — "Sign in with Apple" for the Chrome extension.
// ES module, imported lazily by adapter.js; uses AppleAuthFlow (apple-auth.js,
// loaded by game.html).
//
// Apple's web flow in Chrome's own sign-in window (chrome.identity.launchWebAuthFlow).
// Apple posts its answer to the game server's Return URL, which forwards it
// to https://<extension-id>.chromiumapp.org/apple — the window closes there and
// hands us the URL. The server only forwards to extension ids on its
// allow-list (APPLE_EXTENSION_IDS); see docs/APPLE-SIGNIN.md.
//
// Rejections carry .code: "canceled" | "failed" (same as the other shells).

function authError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

function isCancel(message) {
  return /did not approve|cancel|closed|user interaction required/i.test(String(message || ""));
}

// cfg = GET /v1/auth/config .apple ({ servicesId, redirectUri }).
export async function signIn(cfg) {
  if (!chrome.identity || !chrome.identity.launchWebAuthFlow) throw authError("failed", "no-identity-api");
  const req = AppleAuthFlow.request(cfg, `ext-${chrome.runtime.id}`);
  const responseUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: req.url, interactive: true }, (url) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) reject(authError(isCancel(lastError.message) ? "canceled" : "failed", lastError.message));
      else if (!url) reject(authError("canceled"));
      else resolve(url);
    });
  });
  return AppleAuthFlow.answer(new URL(responseUrl).hash, req);
}
