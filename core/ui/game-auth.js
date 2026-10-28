// ---- tabs: account (settings + sign-in) --------------------------------------
let authMode = "in"; // "in" | "up"
let pendingGoogleToken = null; // ID token waiting for a new player's public name
let pendingApple = null; // the same for Apple: { identityToken, authorizationCode?, nonce? }
let myMethods = null; // { google, apple, hasPassword } from /v1/me

function authErrorText(e) {
  const map = {
    "bad-email": G.badEmail,
    "weak-password": G.weakPassword,
    "email-taken": G.emailTaken,
    "bad-credentials": G.badCredentials,
    banned: G.accountBanned,
    "bad-username": G.badUsername,
    "username-taken": G.usernameTaken,
    "account-conflict": G.accountConflict,
    "google-invalid": G.googleFailed,
    "google-unavailable": G.googleFailed,
    "apple-invalid": G.appleFailed,
    "apple-unavailable": G.appleFailed,
    "apple-unreachable": G.appleFailed,
    "bad-code": G.badCode,
    "code-expired": G.codeExpired,
    "too-many-attempts": G.tooMany,
    "mail-failed": G.mailFailed,
    "http-429": G.tooMany,
    canceled: G.googleCanceled,
    "no-account": G.googleNoAccount,
    failed: G.googleFailed,
  };
  return (e && map[e.code]) || G.offline;
}

function showAuthPane(which) {
  $("auth-main").hidden = which !== "main";
  $("google-name").hidden = which !== "google-name";
  $("reset").hidden = which !== "reset";
}

function setAuthMode(mode) {
  authMode = mode;
  $("mode-in").setAttribute("aria-pressed", String(mode === "in"));
  $("mode-up").setAttribute("aria-pressed", String(mode === "up"));
  $("name-field").hidden = mode !== "up";
  $("password").autocomplete = mode === "up" ? "new-password" : "current-password";
  $("auth-submit").textContent = mode === "up" ? G.submitSignUp : G.submitSignIn;
}

async function loadAuthConfig() {
  if (authCfg || !apiUrl) return authCfg;
  try {
    authCfg = await gameApi(apiUrl).authConfig();
  } catch {
    authCfg = null; // offline: try again next time
  }
  return authCfg;
}

async function renderMe() {
  const s = await Platform.store.get(["gameAlerts"]);
  $("alerts").checked = s.gameAlerts !== false;
  $("journey-on").checked = journeyOn;
  $("sound-on").checked = soundOn;
  $("disputed-on").checked = disputedOn;
  $("newtab-on").checked = (await Platform.store.get(["newTabPage"])).newTabPage !== false;
  if (!apiUrl) {
    $("auth").hidden = false;
    $("auth-main").hidden = true;
    $("auth-intro").textContent = G.noServer;
    $("account").hidden = true;
    return;
  }
  if (account) {
    try {
      const { user } = await api().me();
      account = {
        ...account,
        username: user.username,
        email: user.email,
        legacy: user.legacy,
        emailVerified: user.emailVerified,
        admin: user.admin,
      };
      myMethods = { google: !!user.google, apple: !!user.apple, hasPassword: !!user.hasPassword };
      await Platform.store.set({ [GAME_ACCOUNT_KEY]: account });
      $("hide-progress").checked = user.hideProgress;
      await adoptAccountSettings(user.settings);
    } catch (e) {
      if (e.status === 401) await forgetAccount();
    }
  }
  const signedIn = account && !account.legacy;
  $("auth").hidden = !!signedIn;
  $("account").hidden = !account;
  refreshFamilyButton();
  $("logout").hidden = !signedIn; // a name-only account has nothing to sign back in with
  $("legacy-note").hidden = !(account && account.legacy);
  if (account && account.legacy) $("legacy-note").textContent = G.legacyNote(account.username);
  if (!signedIn && $("google-name").hidden && $("reset").hidden) showAuthPane("main");

  // Google sign-in is offered wherever the shell can do it (Android plugin,
  // Chrome identity); its client id is fetched when the button is pressed.
  $("google-btn").hidden = !Platform.googleAuth;
  // Apple only when the server has it on (and the shell can do it).
  $("apple-btn").hidden = !appleReady(authCfg);
  loadAuthConfig().then((cfg) => {
    $("apple-btn").hidden = !appleReady(cfg);
    renderMethods(signedIn, cfg);
  });
  renderMethods(signedIn, authCfg);

  // Admin link and email confirmation follow the server's answer above.
  $("admin-link").hidden = !(signedIn && account.admin);
  $("verify").hidden = !(signedIn && account.email && account.emailVerified === false);
  if ($("verify").hidden) $("verify-step2").hidden = true;

  if (!account) return;
  $("me-name").textContent = account.username;
  $("me-email").textContent = account.email ? G.signedInEmail(account.email) : "";
  try {
    const { users } = await api().following();
    $("following").replaceChildren(...(users.length ? users.map(personItem) : [messageItem(G.notFollowing)]));
  } catch {
    // offline: the list stays as it was
  }
}

// Every successful sign-in lands here: store the account, move this device's
// local progress to it (re-sent in full; the server ignores duplicates).
// Android only: prove to the server that this is our Play build on a genuine
// device (PlayIntegrityPlugin -> IntegrityController), right after sign-in and
// then about once a day. A pass shows the "verified" mark next to the name;
// failures are only reported to the admins. Silent: nothing here blocks play.
const INTEGRITY_KEY = "gameIntegrityAt"; // { username, at }
async function checkIntegrity(force) {
  if (!Platform.integrity || !account || !account.token || account.legacy) return;
  try {
    const last = (await Platform.store.get([INTEGRITY_KEY]))[INTEGRITY_KEY];
    if (!force && last && last.username === account.username && Date.now() - last.at < 20 * 3600 * 1000) return;
    const { nonce, projectNumber } = await api().integrityChallenge();
    const token = await Platform.integrity.token(nonce, projectNumber);
    await api().integrityVerify(token);
    await Platform.store.set({ [INTEGRITY_KEY]: { username: account.username, at: Date.now() } });
  } catch {
    // Off on this server, no Play services, offline: try again next time.
  }
}

async function signedIn({ user, token }, message) {
  account = {
    username: user.username,
    token,
    email: user.email,
    legacy: user.legacy,
    emailVerified: user.emailVerified,
    admin: user.admin,
  };
  await Platform.store.set({ [GAME_ACCOUNT_KEY]: account });
  if (adoptSyncAccount(state, user.username)) await save();
  pendingGoogleToken = null;
  pendingApple = null;
  $("password").value = "";
  $("reset-password").value = "";
  showAuthPane("main");
  await renderMe();
  syncNow();
  checkIntegrity(true);
  showNotice(message || G.welcome(user.username), { autoHide: true });
}

const legacyToken = () => (account && account.legacy ? account.token : undefined);

async function withBusy(button, fn) {
  button.disabled = true;
  try {
    await fn();
  } catch (e) {
    showNotice(authErrorText(e));
  } finally {
    button.disabled = false;
  }
}

function submitAuth(ev) {
  ev.preventDefault();
  const email = $("email").value.trim();
  const password = $("password").value;
  withBusy($("auth-submit"), async () => {
    const res =
      authMode === "up"
        ? await gameApi(apiUrl).signUp(email, password, $("username").value.trim(), legacyToken())
        : await gameApi(apiUrl).signIn(email, password, legacyToken());
    await signedIn(res);
  });
}

function signInWithGoogle() {
  withBusy($("google-btn"), async () => {
    const cfg = await loadAuthConfig();
    if (!cfg) throw { code: "offline" }; // server unreachable: the connection message
    if (!cfg.google || !Platform.googleAuth) throw { code: "google-unavailable" };
    const idToken = await Platform.googleAuth.signIn(cfg.google.clientId);
    try {
      await signedIn(await gameApi(apiUrl).google(idToken, undefined, legacyToken()));
    } catch (e) {
      if (e.code !== "username-required") throw e;
      pendingGoogleToken = idToken; // new player: ask for a public name first
      showAuthPane("google-name");
      $("google-username").focus();
    }
  });
}

function submitGoogleName(ev) {
  ev.preventDefault();
  const name = $("google-username").value.trim();
  withBusy(ev.submitter || $("google-name").querySelector("button[type=submit]"), async () => {
    // The same name step serves a new Apple player.
    if (pendingApple) await signedIn(await gameApi(apiUrl).apple(pendingApple, name, legacyToken()));
    else await signedIn(await gameApi(apiUrl).google(pendingGoogleToken, name, legacyToken()));
  });
}
