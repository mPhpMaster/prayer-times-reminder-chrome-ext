// google-auth-chrome.js — "Sign in with Google" for the Chrome extension.
// ES module, imported lazily by adapter.js.
//
// Runs Google's OpenID Connect implicit flow in Chrome's own sign-in window
// (chrome.identity.launchWebAuthFlow) and returns the ID token. The client id
// is the game server's public web client id (GET /v1/auth/config), so the
// token's audience is exactly what the server verifies. Nothing secret lives
// in the extension. The Google Cloud web client must list this extension's
// redirect URL — https://<extension-id>.chromiumapp.org/ — as an authorized
// redirect URI (see store-release/README.md).
//
// Rejections carry .code: "canceled" | "failed" (same as the Android shell).

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

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

// Closing Chrome's sign-in window reports "The user did not approve access."
function isCancel(message) {
  return /did not approve|cancel|closed|user interaction required/i.test(String(message || ""));
}

function launch(url) {
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url, interactive: true }, (responseUrl) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) reject(authError(isCancel(lastError.message) ? "canceled" : "failed", lastError.message));
      else if (!responseUrl) reject(authError("canceled"));
      else resolve(responseUrl);
    });
  });
}

export async function signIn(clientId) {
  if (!clientId) throw authError("failed", "no-client-id");
  if (!chrome.identity || !chrome.identity.launchWebAuthFlow) throw authError("failed", "no-identity-api");

  const nonce = randomToken();
  const state = randomToken();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "id_token",
    redirect_uri: chrome.identity.getRedirectURL(),
    scope: "openid email profile",
    nonce,
    state,
    prompt: "select_account",
  });

  const responseUrl = await launch(`${AUTH_ENDPOINT}?${params}`);
  const answer = new URLSearchParams(new URL(responseUrl).hash.slice(1));
  const error = answer.get("error");
  if (error) throw authError(error === "access_denied" ? "canceled" : "failed", error);
  if (answer.get("state") !== state) throw authError("failed", "state-mismatch");
  const idToken = answer.get("id_token");
  const claims = idToken && jwtPayload(idToken);
  if (!claims || claims.nonce !== nonce) throw authError("failed", "nonce-mismatch");
  return idToken;
}

// Forget the Google session used by the sign-in window, so the next sign-in
// offers the account chooser again. Best effort.
export async function signOut() {
  try {
    if (chrome.identity && chrome.identity.clearAllCachedAuthTokens) await chrome.identity.clearAllCachedAuthTokens();
  } catch {
    // nothing cached
  }
}
