// google-callback.js — Google redirects the sign-in popup here with the ID
// token in the URL fragment. Pass the fragment to the opener (same origin
// only — the opener then checks state and nonce), wipe it from the address
// bar, and close.
(function () {
  const fragment = location.hash;
  history.replaceState(null, "", location.pathname);
  if (window.opener && fragment) {
    window.opener.postMessage({ type: "google-auth", fragment }, location.origin);
  }
  window.close();
})();
