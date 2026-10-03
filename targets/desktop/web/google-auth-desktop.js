// google-auth-desktop.js — "Sign in with Google" for the Windows app.
// ES module, imported lazily by adapter.js.
//
// Same OpenID Connect implicit request as the Chrome extension, for the game
// server's public web client id (GET /v1/auth/config), so the server checks
// the token exactly as it does for Chrome. Google won't sign in inside
// WebView2, so the Rust side (google_auth.rs) opens the request in the default
// browser, catches the redirect on a 127.0.0.1 loopback port and returns the
// response parameters. Nothing secret lives in the app.
//
// Rejections carry .code: "canceled" | "failed" (same as the other shells).

function authError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

function randomToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// The JWT payload, unverified — only used to check our own nonce; the server
// verifies the token with Google.
function jwtPayload(token) {
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

// `invoke` is Tauri's command bridge, passed in by adapter.js (the only file
// that touches window.__TAURI__).
export async function signIn(clientId, invoke) {
  if (!clientId) throw authError("failed", "no-client-id");

  const nonce = randomToken();
  const state = randomToken();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "id_token",
    scope: "openid email profile",
    nonce,
    state,
    prompt: "select_account",
  });

  let response;
  try {
    response = await invoke("google_sign_in", { query: params.toString() });
  } catch (e) {
    // "timeout": the browser tab was left without finishing.
    throw authError(String(e) === "timeout" ? "canceled" : "failed", String(e));
  }
  const answer = new URLSearchParams(response);
  const error = answer.get("error");
  if (error) throw authError(error === "access_denied" ? "canceled" : "failed", error);
  if (answer.get("state") !== state) throw authError("failed", "state-mismatch");
  const idToken = answer.get("id_token");
  const claims = idToken && jwtPayload(idToken);
  if (!claims || claims.nonce !== nonce) throw authError("failed", "nonce-mismatch");
  return idToken;
}

// The Google session lives in the user's browser, not in the app, so there is
// nothing to clear; prompt=select_account shows the chooser every time.
export async function signOut() {}
