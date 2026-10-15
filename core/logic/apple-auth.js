// apple-auth.js — Sign in with Apple's web flow, shared by the shells that use
// it (Chrome extension, website, Windows app, Android). Classic script: game.html
// loads it, and each adapter calls AppleAuthFlow when the button is pressed.
// Native iOS does not use it (Platform.appleAuth.native, see docs/APPLE-SIGNIN.md).
//
// The request goes to Apple for the game server's Services ID (GET /v1/auth/config)
// with response_mode=form_post, so Apple POSTs the answer to the server's Return
// URL (/v1/auth/apple/callback). The server forwards it, unread, to the return
// address that the `state` prefix names (server allow-list):
//   ext-<extension id>  https://<id>.chromiumapp.org/apple   (chrome.identity)
//   web                 the website's apple-callback.html
//   desk-<port>         the Windows app's loopback listener (google_auth.rs)
//   app                 the Android WebView's own https://localhost/apple-callback.html
// The answer arrives in the URL fragment; we check our state and nonce here and
// the server verifies the identity token itself (POST /v1/auth/apple).
//
//   AppleAuthFlow.request(cfg, target)  -> { url, query, key, nonce }
//   AppleAuthFlow.answer(text, req)     -> { identityToken, authorizationCode, nonce }
//                                          rejects .code "canceled" | "failed"
//   AppleAuthFlow.redirect(cfg, target, intent)  leave this page for Apple (website, Android)
//   AppleAuthFlow.pending()             -> { intent, identityToken, ... } once, after coming back; else null

const AppleAuthFlow = (() => {
  const AUTHORIZE = "https://appleid.apple.com/auth/authorize";
  const PENDING_KEY = "appleAuthPending"; // sessionStorage: { key, nonce, intent, at }
  const RETURN_KEY = "appleAuthReturn"; // sessionStorage: the fragment, set by apple-callback.js
  const MAX_AGE_MS = 15 * 60 * 1000;

  function authError(code, message) {
    const err = new Error(message || code);
    err.code = code;
    return err;
  }

  function random() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  // The JWT payload, unverified — only used to check our own nonce.
  function payload(token) {
    try {
      const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(
        Array.from(atob(part), (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join("")
      );
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function request(cfg, target) {
    if (!cfg || !cfg.servicesId || !cfg.redirectUri) throw authError("failed", "no-services-id");
    const key = random();
    const nonce = random();
    const params = new URLSearchParams({
      client_id: cfg.servicesId,
      redirect_uri: cfg.redirectUri,
      response_type: "code id_token",
      response_mode: "form_post",
      scope: "email", // the name is never used
      state: `${target}.${key}`,
      nonce,
    });
    return { url: `${AUTHORIZE}?${params}`, query: params.toString(), key, nonce };
  }

  function answer(text, req) {
    const p = new URLSearchParams(String(text || "").replace(/^[#?]/, ""));
    const state = p.get("state") || "";
    // Only the random part: the desktop's port is filled in after the request was built.
    if (state.slice(state.lastIndexOf(".") + 1) !== req.key) throw authError("failed", "state-mismatch");
    const error = p.get("error");
    if (error) throw authError(/cancel/i.test(error) ? "canceled" : "failed", error);
    const identityToken = p.get("id_token");
    const claims = identityToken && payload(identityToken);
    if (!claims || claims.nonce !== req.nonce) throw authError("failed", "nonce-mismatch");
    return { identityToken, authorizationCode: p.get("code") || undefined, nonce: req.nonce };
  }

  // Shells that can't keep a window open for the answer leave the page instead;
  // apple-callback.html stores the answer and reopens the game (pending()).
  function redirect(cfg, target, intent) {
    const req = request(cfg, target);
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ key: req.key, nonce: req.nonce, intent: intent || "signin", at: Date.now() }));
    location.assign(req.url);
    return new Promise(() => {}); // the page is going away
  }

  function pending() {
    let back = null;
    let req = null;
    try {
      back = sessionStorage.getItem(RETURN_KEY);
      req = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
      if (back) {
        sessionStorage.removeItem(RETURN_KEY);
        sessionStorage.removeItem(PENDING_KEY);
      }
    } catch {
      return null;
    }
    if (!back || !req || Date.now() - req.at > MAX_AGE_MS) return null;
    return { intent: req.intent, ...answer(back, req) };
  }

  return { request, answer, redirect, pending, payload };
})();
