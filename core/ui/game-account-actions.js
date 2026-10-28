// ---- sign-in methods (My account): link / unlink Google and Apple ---------------
const PROVIDER_NAMES = { google: "Google", apple: "Apple" };

function linkErrorText(e, kind) {
  const name = PROVIDER_NAMES[kind];
  const map = {
    "account-conflict": G.linkConflict(name),
    "already-linked": G.alreadyLinked(name),
    "last-method": G.lastMethod,
  };
  if (e && map[e.code]) return map[e.code];
  return kind === "apple" ? appleErrorText(e) : authErrorText(e);
}

function renderMethods(signedIn, cfg) {
  const box = $("methods");
  box.hidden = !(signedIn && myMethods);
  if (box.hidden) return;
  const can = {
    google: !!(Platform.googleAuth && cfg && cfg.google),
    apple: appleReady(cfg),
  };
  const rows = [];
  for (const kind of ["google", "apple"]) {
    const on = myMethods[kind];
    if (!on && !can[kind]) continue; // nothing to show or do here
    const li = document.createElement("li");
    li.className = "method" + (on ? " on" : "");
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = PROVIDER_NAMES[kind];
    const st = document.createElement("span");
    st.className = "state";
    st.textContent = on ? G.methodOn : G.methodOff;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ghost";
    b.textContent = on ? G.unlinkBtn : G.linkBtn;
    b.addEventListener("click", () => (on ? unlinkProvider(kind, b) : linkProvider(kind, b)));
    li.append(name, st, b);
    rows.push(li);
  }
  const pw = document.createElement("li");
  pw.className = "method" + (myMethods.hasPassword ? " on" : "");
  const pwName = document.createElement("span");
  pwName.className = "name";
  pwName.textContent = G.methodEmail;
  const pwState = document.createElement("span");
  pwState.className = "state";
  pwState.textContent = myMethods.hasPassword ? G.passwordSet : G.passwordNotSet;
  pw.append(pwName, pwState);
  rows.push(pw);
  $("methods-list").replaceChildren(...rows);
}

// A link or unlink changed the account: keep the stored copy and the screen in step.
async function afterLinkChange(user, message) {
  myMethods = { google: !!user.google, apple: !!user.apple, hasPassword: !!user.hasPassword };
  account = { ...account, email: user.email, emailVerified: user.emailVerified, admin: user.admin };
  await Platform.store.set({ [GAME_ACCOUNT_KEY]: account });
  await renderMe();
  showNotice(message, { autoHide: true });
}

async function linkProvider(kind, button) {
  button.disabled = true;
  try {
    const cfg = await loadAuthConfig();
    if (!cfg) throw { code: "offline" };
    let res;
    if (kind === "google") {
      if (!cfg.google || !Platform.googleAuth) throw { code: "google-unavailable" };
      res = await api().linkGoogle(await Platform.googleAuth.signIn(cfg.google.clientId));
    } else {
      if (!appleReady(cfg)) throw { code: "apple-unavailable" };
      // Website / Android leave the page here; resumeApple() finishes the link.
      res = await api().linkApple(await Platform.appleAuth.signIn(cfg.apple, { intent: "link" }));
    }
    await afterLinkChange(res.user, G.linked(PROVIDER_NAMES[kind]));
  } catch (e) {
    showNotice(linkErrorText(e, kind));
  } finally {
    button.disabled = false;
  }
}

async function unlinkProvider(kind, button) {
  if (!confirm(G.unlinkConfirm(PROVIDER_NAMES[kind]))) return;
  button.disabled = true;
  try {
    const { user } = await api().unlink(kind);
    if (kind === "google" && Platform.googleAuth) await Platform.googleAuth.signOut();
    await afterLinkChange(user, G.unlinked(PROVIDER_NAMES[kind]));
  } catch (e) {
    showNotice(linkErrorText(e, kind));
  } finally {
    button.disabled = false;
  }
}

async function logout() {
  try {
    await api().logout();
  } catch {
    // offline: this device forgets the token anyway
  }
  if (Platform.googleAuth) await Platform.googleAuth.signOut();
  await forgetAccount();
  showNotice(G.loggedOut, { autoHide: true });
  renderMe();
}

function sendVerifyCode() {
  withBusy($("verify-send"), async () => {
    await api().sendVerify();
    $("verify-step2").hidden = false;
    $("verify-code").focus();
  });
}

function submitVerify(ev) {
  ev.preventDefault();
  withBusy(ev.submitter || $("verify-send"), async () => {
    const { user } = await api().verifyEmail($("verify-code").value.trim());
    account = { ...account, emailVerified: user.emailVerified, admin: user.admin };
    await Platform.store.set({ [GAME_ACCOUNT_KEY]: account });
    $("verify-code").value = "";
    await renderMe();
    showNotice(G.verifyDone, { autoHide: true });
  });
}

function sendResetCode() {
  const email = $("reset-email").value.trim();
  withBusy($("send-code"), async () => {
    await gameApi(apiUrl).forgot(email);
    $("reset-step2").hidden = false; // shown whether or not the email exists
    $("reset-code").focus();
  });
}

function submitReset(ev) {
  ev.preventDefault();
  withBusy(ev.submitter || $("send-code"), async () => {
    const res = await gameApi(apiUrl).reset($("reset-email").value.trim(), $("reset-code").value.trim(), $("reset-password").value);
    await signedIn(res, G.passwordChanged);
  });
}

// Google Play requires in-app account deletion. Server-side only: the local
// game history on this device stays, it just stops syncing.
async function deleteAccount() {
  if (!confirm(G.deleteConfirm(account.username))) return;
  $("delete-account").disabled = true;
  try {
    await api().deleteMe();
    if (Platform.googleAuth) await Platform.googleAuth.signOut();
    await forgetAccount();
    showNotice(G.deleted, { autoHide: true });
    renderMe();
  } catch (e) {
    if (e.status === 401) {
      await forgetAccount(); // already gone on the server
      renderMe();
    } else {
      showNotice(G.deleteFail);
    }
  } finally {
    $("delete-account").disabled = false;
  }
}
