// ---- Sign in with Apple -------------------------------------------------------
// Off unless the server has Apple configured (GET /v1/auth/config .apple). Web
// shells need its Services ID; the native iOS sign-in needs only the switch.
function appleReady(cfg) {
  const a = Platform.appleAuth;
  return !!(a && cfg && cfg.apple && (cfg.apple.servicesId || a.native));
}

function appleErrorText(e) {
  if (e && e.code === "canceled") return G.appleCanceled;
  if (e && e.code === "failed") return G.appleFailed;
  if (e && e.code === "account-conflict") return G.appleConflict;
  return authErrorText(e);
}

function signInWithApple() {
  const btn = $("apple-btn");
  btn.disabled = true;
  (async () => {
    const cfg = await loadAuthConfig();
    if (!cfg) throw { code: "offline" };
    if (!appleReady(cfg)) throw { code: "apple-unavailable" };
    // Website / Android leave the page here; resumeApple() finishes on return.
    await finishAppleSignIn(await Platform.appleAuth.signIn(cfg.apple, { intent: "signin" }));
  })()
    .catch((e) => showNotice(appleErrorText(e)))
    .finally(() => (btn.disabled = false));
}

async function finishAppleSignIn(a) {
  try {
    await signedIn(await gameApi(apiUrl).apple(a, undefined, legacyToken()));
  } catch (e) {
    if (e.code !== "username-required") throw e;
    pendingApple = a; // new player: ask for a public name first
    pendingGoogleToken = null;
    showAuthPane("google-name");
    $("google-username").focus();
  }
}

// Website / Android: Apple's answer arrives when this page opens again.
async function resumeApple() {
  if (!Platform.appleAuth || !Platform.appleAuth.pending) return;
  let a = null;
  try {
    a = await Platform.appleAuth.pending();
  } catch (e) {
    showNotice(appleErrorText(e));
    return;
  }
  if (!a) return;
  try {
    if (a.intent === "link") {
      if (!account || !account.token) return;
      const { user } = await api().linkApple(a);
      await afterLinkChange(user, G.linked("Apple"));
    } else {
      await finishAppleSignIn(a);
    }
  } catch (e) {
    showNotice(a.intent === "link" ? linkErrorText(e, "apple") : appleErrorText(e));
  }
}
