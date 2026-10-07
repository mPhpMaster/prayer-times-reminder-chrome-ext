// google-auth-web.js — "Sign in with Google" for the website build. ES module,
// imported lazily by adapter.js.
//
// Google's OpenID Connect implicit flow in a popup window. Google redirects
// the popup to google-callback.html on THIS origin, which hands the URL
// fragment back with postMessage restricted to this origin; we check the
// sender window, the state and the nonce, and return the ID token. The
// server verifies the token with Google (audience = its public web client id,
// from GET /v1/auth/config). The Google Cloud web client must list
//   https://mphpmaster.github.io/prayer-times-reminder-chrome-ext/app/google-callback.html
// as an authorized redirect URI.
//
// Rejections carry .code: "canceled" | "failed" (same as the other shells).

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const CALLBACK = "google-callback.html";

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

// The JWT payload, unverified — only used to check our own nonce.
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

export function signIn(clientId) {
  if (!clientId) return Promise.reject(authError("failed", "no-client-id"));
  const nonce = randomToken();
  const state = randomToken();
  const redirect = new URL(CALLBACK, location.href).href;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "id_token",
    redirect_uri: redirect,
    scope: "openid email profile",
    nonce,
    state,
    prompt: "select_account",
  });
  const popup = window.open(`${AUTH_ENDPOINT}?${params}`, "google-sign-in", "popup,width=480,height=640");
  if (!popup) return Promise.reject(authError("failed", "popup-blocked"));

  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn) => {
      if (done) return;
      done = true;
      clearInterval(closedPoll);
      window.removeEventListener("message", onMessage);
      try { popup.close(); } catch {}
      fn();
    };
    function onMessage(e) {
      // Only our own callback page, in the popup we opened.
      if (e.origin !== location.origin || e.source !== popup) return;
      const data = e.data;
      if (!data || data.type !== "google-auth" || typeof data.fragment !== "string") return;
      const p = new URLSearchParams(data.fragment.replace(/^#/, ""));
      if (p.get("state") !== state) return finish(() => reject(authError("failed", "bad-state")));
      if (p.get("error")) {
        const code = p.get("error") === "access_denied" ? "canceled" : "failed";
        return finish(() => reject(authError(code, p.get("error"))));
      }
      const token = p.get("id_token");
      const claims = token && jwtPayload(token);
      if (!claims || claims.nonce !== nonce) return finish(() => reject(authError("failed", "bad-token")));
      finish(() => resolve(token));
    }
    window.addEventListener("message", onMessage);
    // Closing the popup without finishing = canceled.
    const closedPoll = setInterval(() => {
      if (popup.closed) finish(() => reject(authError("canceled")));
    }, 500);
  });
}
