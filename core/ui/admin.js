// Prayer Times Reminder — Admin page (admins only).
// Requires adapter + platform.js + i18n.js + admin-i18n.js + dedications.js +
// game-sync.js loaded first.
//
// Reached from the game's "My account" when the server says the account is an
// admin. This page is only a view: the server checks admin rights on every
// call (GameAdmin middleware), so a non-admin who opens it just sees "no
// access". Tabs:
//   Requests — players' requests to add a name to the About page: edit,
//              approve (the name goes on the page), decline with a reason.
//   Names    — the names on the About page: add, edit, hide, reorder, delete.
//   Admins   — add an admin by email (their rights start once they sign in
//              with that email confirmed); only the owner removes admins.
//   Accounts — search players; edit their username / display name / email /
//              privacy, ban or unban them (any admin; not other admins), reset
//              their data or delete their account (typing the username
//              confirms, both are irreversible).
//   Log      — every admin action.

let lang = "ar";
let A = adminT(lang);
let apiUrl = GAME_API_DEFAULT;
let account = null;
let me = null; // /v1/me user (admin, superAdmin)
let tab = "requests";
let reqStatus = "pending";

const $ = (id) => document.getElementById(id);
const api = () => gameApi(apiUrl, account && account.token).admin;
const LANG_NAMES = Object.fromEntries((typeof SUPPORTED_LANGS !== "undefined" ? SUPPORTED_LANGS : []).map((l) => [l.code, l]));

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "on") for (const [ev, fn] of Object.entries(v)) node.addEventListener(ev, fn);
    else if (v !== undefined && v !== null) node[k] = v;
  }
  node.append(...kids(children));
  return node;
}

// Children at any depth, without the null/false placeholders of optional parts.
function kids(list) {
  return list.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false);
}

let noticeTimer = 0;
function notice(text, autoHide = true) {
  clearTimeout(noticeTimer);
  $("admin-notice").textContent = text || "";
  $("admin-notice").hidden = !text;
  // A toast: success fades after 4 s, a problem after 7 s; a tap closes either.
  if (text) noticeTimer = setTimeout(() => notice(""), autoHide ? 4000 : 7000);
}

function errorText(e) {
  if (e && e.status === 401) return A.errors["not-admin"];
  return (e && A.errors[e.code]) || A.offline;
}

// Runs an action with its button disabled; shows the server's error, if any.
async function busy(button, fn) {
  if (button) button.disabled = true;
  try {
    await fn();
  } catch (e) {
    notice(errorText(e), false);
  } finally {
    if (button) button.disabled = false;
  }
}

function when(s) {
  if (!s) return "—";
  const d = new Date(String(s).replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? "" : "Z"));
  return isNaN(d) ? String(s) : d.toLocaleString(lang === "ar" || lang === "ur" ? "ar" : "en", { dateStyle: "medium", timeStyle: "short" });
}

function badge(text, cls = "") {
  return el("span", { class: `admin-badge ${cls}`, textContent: text });
}

// ---- a name in every language (read + edit) ---------------------------------

function namesView(names) {
  return el(
    "dl",
    { class: "admin-names" },
    DEDICATION_LANGS.filter((c) => names[c]).map((c) => [
      el("dt", { textContent: (LANG_NAMES[c] && LANG_NAMES[c].name) || c }),
      el("dd", { dir: "auto", textContent: names[c] }),
    ])
  );
}

// Inputs for all languages; read() returns the cleaned map.
function namesEditor(names = {}) {
  const inputs = {};
  const box = el(
    "div",
    { class: "admin-editor" },
    DEDICATION_LANGS.map((c) => {
      const info = LANG_NAMES[c] || { name: c, dir: "auto" };
      inputs[c] = el("input", { value: names[c] || "", dir: info.dir || "auto", lang: c, maxLength: DEDICATION_MAX_NAME, autocomplete: "off" });
      return el("label", {}, el("span", { textContent: info.name }), inputs[c]);
    })
  );
  const read = () => cleanDedicationNames(Object.fromEntries(Object.entries(inputs).map(([c, i]) => [c, i.value])));
  return { box, read };
}

// ---- tabs -------------------------------------------------------------------

function showTab(name) {
  tab = name;
  for (const b of document.querySelectorAll(".admin-tabs button")) b.setAttribute("aria-selected", String(b.dataset.tab === name));
  for (const s of document.querySelectorAll(".admin-tab")) s.hidden = s.id !== `tab-${name}`;
  notice("");
  ({ requests: loadRequests, names: loadNames, admins: loadAdmins, users: () => {}, log: loadLog })[name]();
}

function loadingInto(list) {
  list.replaceChildren(el("li", { class: "admin-msg", textContent: A.loading }));
}

function emptyInto(list, items) {
  if (!items.length) list.replaceChildren(el("li", { class: "admin-msg", textContent: A.empty }));
  return !items.length;
}

// ---- Requests -----------------------------------------------------------------

async function loadRequests() {
  const list = $("req-list");
  loadingInto(list);
  try {
    const { requests } = await api().requests(reqStatus);
    if (emptyInto(list, requests)) return;
    list.replaceChildren(...requests.map(requestCard));
  } catch (e) {
    list.replaceChildren(el("li", { class: "admin-msg", textContent: errorText(e) }));
  }
  refreshPendingCount();
}

function requestCard(r) {
  const li = el("li", { class: "admin-card" });
  const statusName = { pending: A.statusPending, approved: A.statusApproved, rejected: A.statusRejected }[r.status];
  const who = r.user ? [r.user.username, r.user.email].filter(Boolean).join(" · ") : "—";

  const render = () => {
    const actions =
      r.status === "pending"
        ? el(
            "div",
            { class: "admin-actions" },
            el("button", { type: "button", class: "primary", textContent: A.approve, on: { click: (ev) => approve(ev.target) } }),
            el("button", { type: "button", class: "ghost", textContent: A.edit, on: { click: edit } }),
            el("button", { type: "button", class: "danger", textContent: A.reject, on: { click: (ev) => reject(ev.target) } })
          )
        : null;
    li.replaceChildren(
      ...kids([el("div", { class: "admin-card-head" }, badge(statusName, `st-${r.status}`)),
      namesView(r.names),
      r.note ? el("p", { class: "note", dir: "auto", textContent: A.note(r.note) }) : null,
      el("p", { class: "muted", dir: "auto", textContent: A.from(who) }),
      el("p", { class: "muted", textContent: A.at(when(r.createdAt)) }),
      r.reason ? el("p", { class: "muted", dir: "auto", textContent: A.reason(r.reason) }) : null,
      r.reviewedBy ? el("p", { class: "muted", textContent: A.reviewedBy(r.reviewedBy) }) : null,
      actions])
    );
  };

  const edit = () => {
    const ed = namesEditor(r.names);
    const save = el("button", {
      type: "button",
      class: "primary",
      textContent: A.save,
      on: {
        click: () => {
          const names = ed.read();
          if (!Object.keys(names).length) return notice(A.atLeastOne, false);
          busy(save, async () => {
            const res = await api().updateRequest(r.id, { names });
            r = res.request;
            notice(A.saved);
            render();
          });
        },
      },
    });
    li.replaceChildren(ed.box, el("div", { class: "admin-actions" }, save, el("button", { type: "button", class: "ghost", textContent: A.cancel, on: { click: render } })));
  };

  const approve = (button) =>
    busy(button, async () => {
      await api().approve(r.id);
      notice(A.approved);
      loadRequests();
    });

  const reject = (button) => {
    const reason = window.prompt(A.rejectPrompt, "");
    if (reason === null) return;
    busy(button, async () => {
      await api().reject(r.id, reason.trim() || undefined);
      notice(A.rejected);
      loadRequests();
    });
  };

  render();
  return li;
}

async function refreshPendingCount() {
  try {
    const { pendingRequests } = await api().overview();
    const b = document.querySelector('.admin-tabs button[data-tab="requests"]');
    b.textContent = pendingRequests ? `${A.tabRequests} (${pendingRequests})` : A.tabRequests;
  } catch {
    // keep the plain label
  }
}

// ---- Names ------------------------------------------------------------------------

let names = [];

async function loadNames() {
  const list = $("name-list");
  loadingInto(list);
  try {
    ({ dedications: names } = await api().dedications());
    renderNames();
  } catch (e) {
    list.replaceChildren(el("li", { class: "admin-msg", textContent: errorText(e) }));
  }
}

function renderNames() {
  const list = $("name-list");
  if (emptyInto(list, names)) return;
  list.replaceChildren(...names.map((d, i) => nameRow(d, i)));
}

function nameRow(d, i) {
  const li = el("li", { class: `admin-card${d.hidden ? " is-hidden" : ""}` });
  const { primary, secondary } = dedicationLines(d.names, lang === "ar" ? "en" : lang);

  const render = () => {
    li.replaceChildren(
      el(
        "div",
        { class: "admin-name-line" },
        el("b", { dir: "auto", textContent: primary }),
        secondary ? el("span", { class: "muted", dir: "auto", textContent: secondary }) : null,
        d.hidden ? badge(A.hidden, "st-rejected") : null
      ),
      el(
        "div",
        { class: "admin-actions" },
        el("button", { type: "button", class: "ghost", textContent: "▲", title: A.up, ariaLabel: A.up, disabled: i === 0, on: { click: (ev) => move(ev.target, -1) } }),
        el("button", { type: "button", class: "ghost", textContent: "▼", title: A.down, ariaLabel: A.down, disabled: i === names.length - 1, on: { click: (ev) => move(ev.target, 1) } }),
        el("button", { type: "button", class: "ghost", textContent: A.edit, on: { click: edit } }),
        el("button", { type: "button", class: "ghost", textContent: d.hidden ? A.show : A.hide, on: { click: (ev) => toggleHidden(ev.target) } }),
        el("button", { type: "button", class: "danger", textContent: A.remove, on: { click: (ev) => remove(ev.target) } })
      )
    );
  };

  const edit = () => {
    const ed = namesEditor(d.names);
    const save = el("button", {
      type: "button",
      class: "primary",
      textContent: A.save,
      on: {
        click: () => {
          const n = ed.read();
          if (!Object.keys(n).length) return notice(A.atLeastOne, false);
          busy(save, async () => {
            await api().updateDedication(d.id, { names: n });
            notice(A.saved);
            loadNames();
          });
        },
      },
    });
    li.replaceChildren(ed.box, el("div", { class: "admin-actions" }, save, el("button", { type: "button", class: "ghost", textContent: A.cancel, on: { click: render } })));
  };

  const move = (button, by) =>
    busy(button, async () => {
      const ids = names.map((x) => x.id);
      [ids[i], ids[i + by]] = [ids[i + by], ids[i]];
      ({ dedications: names } = await api().reorder(ids));
      renderNames();
    });

  const toggleHidden = (button) =>
    busy(button, async () => {
      await api().updateDedication(d.id, { hidden: !d.hidden });
      loadNames();
    });

  const remove = (button) => {
    if (!window.confirm(A.removeNameConfirm(primary))) return;
    busy(button, async () => {
      await api().deleteDedication(d.id);
      loadNames();
    });
  };

  render();
  return li;
}

function openNewName() {
  const box = $("name-new");
  const ed = namesEditor();
  const save = el("button", {
    type: "button",
    class: "primary",
    textContent: A.save,
    on: {
      click: () => {
        const n = ed.read();
        if (!Object.keys(n).length) return notice(A.atLeastOne, false);
        busy(save, async () => {
          await api().addDedication(n);
          box.hidden = true;
          $("name-add").hidden = false;
          notice(A.saved);
          loadNames();
        });
      },
    },
  });
  const cancel = el("button", {
    type: "button",
    class: "ghost",
    textContent: A.cancel,
    on: {
      click: () => {
        box.hidden = true;
        $("name-add").hidden = false;
      },
    },
  });
  box.replaceChildren(el("div", { class: "admin-card" }, ed.box, el("div", { class: "admin-actions" }, save, cancel)));
  box.hidden = false;
  $("name-add").hidden = true;
}

// ---- Admins -----------------------------------------------------------------------

async function loadAdmins() {
  const list = $("admin-list");
  loadingInto(list);
  try {
    const { admins } = await api().admins();
    list.replaceChildren(...admins.map(adminRow));
  } catch (e) {
    list.replaceChildren(el("li", { class: "admin-msg", textContent: errorText(e) }));
  }
}

function adminRow(a) {
  const canRemove = me && me.superAdmin && !a.super;
  const remove = el("button", {
    type: "button",
    class: "danger",
    textContent: A.remove,
    on: {
      click: () => {
        if (!window.confirm(A.removeAdminConfirm(a.email))) return;
        busy(remove, async () => {
          await api().removeAdmin(a.email);
          loadAdmins();
        });
      },
    },
  });
  return el(
    "li",
    { class: "admin-card" },
    el(
      "div",
      { class: "admin-name-line" },
      el("b", { dir: "ltr", textContent: a.email }),
      a.username ? el("span", { class: "muted", textContent: a.username }) : null,
      a.super ? badge(A.superBadge, "st-approved") : null,
      !a.username ? badge(A.notSignedUp) : !a.verified ? badge(A.notVerified, "st-pending") : null
    ),
    a.addedBy ? el("p", { class: "muted", dir: "ltr", textContent: A.addedBy(a.addedBy) }) : null,
    canRemove ? el("div", { class: "admin-actions" }, remove) : null
  );
}

function addAdmin(ev) {
  ev.preventDefault();
  const email = $("admin-email").value.trim();
  if (!email) return;
  busy($("admin-add-btn"), async () => {
    await api().addAdmin(email);
    $("admin-email").value = "";
    notice(A.adminAdded);
    loadAdmins();
  });
}

// ---- Accounts ---------------------------------------------------------------------

function searchUsers(ev) {
  if (ev) ev.preventDefault();
  const list = $("user-list");
  loadingInto(list);
  busy($("user-search-btn"), async () => {
    try {
      const { users } = await api().users($("user-q").value.trim());
      if (emptyInto(list, users)) return;
      list.replaceChildren(...users.map(userRow));
    } catch (e) {
      list.replaceChildren(el("li", { class: "admin-msg", textContent: errorText(e) }));
    }
  });
}

// Irreversible: the admin types the username to confirm.
function confirmTyped(action, username) {
  const typed = window.prompt(A.typeToConfirm(action, username), "");
  return typed !== null && typed.trim().toLowerCase() === String(username).toLowerCase();
}

// Inline form in a player's card: username, display name, email, privacy.
function userEditor(u, li, onDone) {
  const field = (label, input) => el("label", {}, el("span", { textContent: label }), input);
  const username = el("input", { value: u.username, dir: "auto", maxLength: 20, autocomplete: "off" });
  const display = el("input", { value: u.displayName || "", dir: "auto", maxLength: 40, autocomplete: "off" });
  const email = u.email ? el("input", { value: u.email, dir: "ltr", type: "email", maxLength: 191, autocomplete: "off" }) : null;
  const hide = el("input", { type: "checkbox", checked: !!u.hideProgress });
  const save = el("button", {
    type: "button",
    class: "primary",
    textContent: A.save,
    on: {
      click: () => {
        const patch = {};
        if (username.value.trim() !== u.username) patch.username = username.value.trim();
        if (display.value.trim() !== (u.displayName || "")) patch.displayName = display.value.trim();
        if (email && email.value.trim().toLowerCase() !== u.email) patch.email = email.value.trim();
        if (hide.checked !== !!u.hideProgress) patch.hideProgress = hide.checked;
        if (!Object.keys(patch).length) return onDone();
        busy(save, async () => {
          await api().updateUser(u.id, patch);
          notice(A.saved);
          searchUsers();
        });
      },
    },
  });
  const cancel = el("button", { type: "button", class: "ghost", textContent: A.cancel, on: { click: onDone } });
  return el(
    "div",
    { class: "admin-user-edit" },
    el(
      "div",
      { class: "admin-editor" },
      field(A.usernameLabel, username),
      field(A.displayNameLabel, display),
      email ? field(A.emailLabel, email) : null
    ),
    el("label", { class: "admin-check" }, hide, el("span", { textContent: A.hideProgressLabel })),
    email ? el("p", { class: "muted note", textContent: A.emailChangeNote }) : null,
    el("div", { class: "admin-actions" }, save, cancel)
  );
}

function userRow(u) {
  const isMe = me && u.username === me.username;
  const isAdmin = u.admin || u.superAdmin;
  const editBtn = el("button", {
    type: "button",
    class: "ghost",
    textContent: A.edit,
    on: {
      click: () => {
        const form = userEditor(u, li, () => {
          form.remove();
          actions.hidden = false;
        });
        actions.hidden = true;
        li.append(form);
      },
    },
  });
  const banBtn = el("button", {
    type: "button",
    class: u.banned ? "ghost" : "danger",
    textContent: u.banned ? A.unban : A.ban,
    on: {
      click: () => {
        if (u.banned) {
          busy(banBtn, async () => {
            await api().unbanUser(u.id);
            notice(A.unbanDone);
            searchUsers();
          });
          return;
        }
        const reason = window.prompt(A.banReasonPrompt(u.username), "");
        if (reason === null) return;
        busy(banBtn, async () => {
          await api().banUser(u.id, reason.trim());
          notice(A.banDone);
          searchUsers();
        });
      },
    },
  });
  const reset = el("button", {
    type: "button",
    class: "ghost",
    textContent: A.resetData,
    on: {
      click: () => {
        if (!confirmTyped(A.resetData, u.username)) return;
        busy(reset, async () => {
          await api().resetUser(u.id);
          notice(A.resetDone);
          searchUsers();
        });
      },
    },
  });
  const del = el("button", {
    type: "button",
    class: "danger",
    textContent: A.deleteAccount,
    on: {
      click: () => {
        if (!confirmTyped(A.deleteAccount, u.username)) return;
        busy(del, async () => {
          await api().deleteUser(u.id);
          notice(A.deletedUser);
          searchUsers();
        });
      },
    },
  });
  const actions = isMe || u.superAdmin
    ? null
    : el("div", { class: "admin-actions" }, isAdmin ? null : editBtn, isAdmin ? null : banBtn, reset, del);
  const li = el(
    "li",
    { class: u.banned ? "admin-card is-banned" : "admin-card" },
    el(
      "div",
      { class: "admin-name-line" },
      el("b", { textContent: u.username }),
      u.banned ? badge(A.bannedBadge, "st-rejected") : null,
      u.displayName ? el("span", { class: "muted", dir: "auto", textContent: u.displayName }) : null,
      u.superAdmin ? badge(A.superBadge, "st-approved") : u.admin ? badge(A.adminBadge, "st-approved") : null,
      u.google ? badge(A.googleBadge) : null,
      u.legacy ? badge(A.legacyBadge) : u.email && !u.emailVerified ? badge(A.notVerified, "st-pending") : null
    ),
    u.email ? el("p", { class: "muted", dir: "ltr", textContent: u.email }) : null,
    el("p", { class: "muted", textContent: `${A.points(u.points)} · ${A.joined(when(u.createdAt))} · ${A.lastSeen(when(u.lastSeen))}` }),
    u.banned ? el("p", { class: "muted", dir: "auto", textContent: A.bannedInfo(when(u.bannedAt), u.bannedBy || "—", u.banReason) }) : null,
    actions
  );
  return li;
}

// What changed, for the log: "username: old → new", "reason: …".
function logDetails(r) {
  const d = r.details;
  if (!d || typeof d !== "object") return null;
  if (r.action === "user.edit") {
    const labels = { username: A.usernameLabel, displayName: A.displayNameLabel, email: A.emailLabel, hideProgress: A.hideProgressLabel };
    return Object.entries(d)
      .map(([k, v]) => `${labels[k] || k}: ${Array.isArray(v) ? v.map((x) => (x === null || x === "" ? "—" : x === true ? "✓" : x === false ? "✗" : String(x))).join(" → ") : String(v)}`)
      .join(" · ");
  }
  if (r.action === "user.ban" && d.reason) return `${A.reasonLabel}: ${d.reason}`;
  return null;
}

// ---- Log --------------------------------------------------------------------------

async function loadLog() {
  const list = $("log-list");
  loadingInto(list);
  try {
    const { log } = await api().log();
    if (emptyInto(list, log)) return;
    list.replaceChildren(
      ...log.map((r) =>
        el(
          "li",
          { class: "admin-log-row" },
          el("span", { class: "muted", textContent: when(r.at) }),
          el("b", { textContent: A.actions[r.action] || r.action }),
          r.target ? el("span", { dir: "auto", textContent: r.target }) : null,
          el("span", { class: "muted", dir: "ltr", textContent: r.admin }),
          logDetails(r) ? el("span", { class: "muted admin-log-details", dir: "auto", textContent: logDetails(r) }) : null
        )
      )
    );
  } catch (e) {
    list.replaceChildren(el("li", { class: "admin-msg", textContent: errorText(e) }));
  }
}

// ---- page -------------------------------------------------------------------------

function applyLanguage() {
  A = adminT(lang);
  const info = (typeof SUPPORTED_LANGS !== "undefined" && SUPPORTED_LANGS.find((l) => l.code === (A === ADMIN_I18N.ar ? "ar" : "en"))) || null;
  document.documentElement.lang = A === ADMIN_I18N.ar ? "ar" : "en";
  document.documentElement.dir = info ? info.dir : "rtl";
  document.title = A.title;
  $("admin-title").textContent = A.title;
  $("admin-back").textContent = A.back;
  const tabNames = { requests: A.tabRequests, names: A.tabNames, admins: A.tabAdmins, users: A.tabUsers, log: A.tabLog };
  for (const b of document.querySelectorAll(".admin-tabs button")) b.textContent = tabNames[b.dataset.tab];
  const filters = { pending: A.filterPending, approved: A.filterApproved, rejected: A.filterRejected, all: A.filterAll };
  for (const b of document.querySelectorAll("#req-filter button")) b.textContent = filters[b.dataset.status];
  $("name-add").textContent = A.addName;
  $("admin-email").placeholder = A.adminEmailPh;
  $("admin-add-btn").textContent = A.addAdmin;
  $("user-q").placeholder = A.searchPh;
  $("user-search-btn").textContent = A.search;
}

function denied(text) {
  $("admin-body").hidden = true;
  $("admin-denied").textContent = text;
  $("admin-denied").hidden = false;
}

// Back to the game's "My account" (the page this one is opened from).
$("admin-back").addEventListener("click", () => {
  location.href = "game.html#me";
});
for (const b of document.querySelectorAll(".admin-tabs button")) b.addEventListener("click", () => showTab(b.dataset.tab));
for (const b of document.querySelectorAll("#req-filter button")) {
  b.addEventListener("click", () => {
    reqStatus = b.dataset.status;
    for (const x of document.querySelectorAll("#req-filter button")) x.setAttribute("aria-pressed", String(x === b));
    loadRequests();
  });
}
$("name-add").addEventListener("click", openNewName);
$("admin-add").addEventListener("submit", addAdmin);
$("user-search").addEventListener("submit", searchUsers);

// Cross-shell hooks (see about.js): back / tray-reopen return to the game.
window.__ptPopupReset = () => {
  location.href = "popup.html";
};

// The toast floats over the screen: it lives on <body>, not inside the glass card
// (a backdrop-filter would pin position:fixed to the card instead of the screen).
document.body.appendChild($("admin-notice"));
$("admin-notice").addEventListener("click", () => notice(""));

async function init() {
  const s = await Platform.store.get(["lang", "theme", GAME_ACCOUNT_KEY, GAME_API_KEY]);
  lang = s.lang || "ar";
  apiUrl = s[GAME_API_KEY] || GAME_API_DEFAULT;
  account = s[GAME_ACCOUNT_KEY] || null;
  if (s.theme && typeof normalizeTheme === "function") document.documentElement.dataset.theme = normalizeTheme(s.theme);
  applyLanguage();
  if (!account || !account.token || account.legacy) return denied(A.noAccess);
  try {
    ({ user: me } = await gameApi(apiUrl, account.token).me());
  } catch (e) {
    return denied(e && e.status ? A.noAccess : A.offline);
  }
  if (!me.admin) return denied(A.noAccess);
  $("admin-body").hidden = false;
  showTab("requests");
}

init();
