// apple-callback.js — the website and the Android app come back here from Sign in
// with Apple (AppleAuthFlow.redirect). Keep the answer for this tab only (the
// game page checks state and nonce: AppleAuthFlow.pending), wipe it from the
// address bar, and reopen the game's account tab.
(function () {
  const fragment = location.hash.slice(1);
  history.replaceState(null, "", location.pathname);
  try {
    if (fragment) sessionStorage.setItem("appleAuthReturn", fragment);
  } catch {
    // no storage: the game shows the sign-in screen again
  }
  location.replace("game.html#me");
})();
