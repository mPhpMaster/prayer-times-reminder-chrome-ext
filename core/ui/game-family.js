// game-family.js — the game's Family screens (loaded before game.js; uses its
// globals at call time: $, G, api, account, go, goBack, showNotice,
// messageItem, prayerName, fmtNum, locale, lang, localDay, Platform).
//
//   #family          the family: invitations, members, today's adhkar of each
//                    child, invite / remove / leave, alert settings (parents)
//   #member/<name>   a member's whole year, day by day (parents only)
//
// Rules are the server's (FamilyController): joining needs the invitee's yes,
// children can't leave (a parent removes them), and the last parent out
// dissolves the family. Parents choose their alerts: none, after each prayer,
// or a daily summary — planned on this device by family-alerts.js.

const FAMILY_PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
let inviteRole = "child";
let memberName = null;
let memberYear = new Date().getFullYear();

function fel(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "on") for (const [ev, fn] of Object.entries(v)) node.addEventListener(ev, fn);
    else if (k === "role" || k.startsWith("aria-")) node.setAttribute(k, v);
    else if (v !== undefined && v !== null) node[k] = v;
  }
  node.append(...children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

function familyErrorText(e) {
  const map = {
    "in-a-family": G.familyErrInFamily,
    "already-invited": G.familyErrInvited,
    "family-full": G.familyErrFull,
    self: G.familyErrSelf,
    "no-such-user": G.familyErrNoUser,
    "children-cant-leave": G.familyChildNote,
    "http-429": G.tooMany,
  };
  return (e && map[e.code]) || G.offline;
}

// Runs a family action; on success re-renders, on failure says why.
async function familyAction(button, fn, done) {
  if (button) button.disabled = true;
  try {
    await fn();
    if (done) showNotice(done, { autoHide: true });
    await renderFamily();
  } catch (e) {
    showNotice(familyErrorText(e));
  } finally {
    if (button) button.disabled = false;
  }
}

// What background alerts need to know (no network there to find out).
async function cacheFamilyAlerts(fam) {
  const v = fam && fam.role === "parent" ? { mode: fam.notify || "off", role: "parent" } : { mode: "off", role: fam ? fam.role : null };
  await Platform.store.set({ familyAlerts: v });
  if (Platform.familyAlerts) Platform.familyAlerts.refresh();
}

// The account screen's button: shows how many invitations wait.
async function refreshFamilyButton() {
  const btn = $("family-btn");
  if (!btn) return;
  btn.hidden = !(account && !account.legacy);
  if (btn.hidden) return;
  try {
    const st = await api().family.get();
    $("family-badge").hidden = !st.invites.length;
    $("family-badge").textContent = st.invites.length ? fmtNum(st.invites.length) : "";
    await cacheFamilyAlerts(st.family);
  } catch {
    // offline: the button still opens the screen, which says so
  }
}

function roleName(role) {
  return role === "parent" ? G.roleParent : G.roleChild;
}

function inviteCard(inv) {
  const accept = fel("button", { type: "button", class: "primary", textContent: G.familyAccept });
  const decline = fel("button", { type: "button", class: "ghost", textContent: G.familyDecline });
  accept.addEventListener("click", () => familyAction(accept, () => api().family.accept(inv.id), G.familyJoined));
  decline.addEventListener("click", () => familyAction(decline, () => api().family.dropInvite(inv.id)));
  return fel(
    "div",
    { class: "family-card" },
    fel("p", { dir: "auto", textContent: G.familyInviteFrom(inv.from.displayName, roleName(inv.role)) }),
    fel("div", { class: "family-actions" }, accept, decline)
  );
}

// "Fajr ✓ · Dhuhr ✗ …" for one child today.
function todayLine(windows) {
  const day = localDay();
  return FAMILY_PRAYERS.map((p) => {
    const w = windows && windows[`${day}:${p}`];
    return `${prayerName(p)} ${w && w.complete ? "✓" : w && w.done ? `${fmtNum(w.done)}/${fmtNum(w.total)}` : "—"}`;
  }).join(" · ");
}

function memberRow(m, fam, today) {
  const isParent = fam.role === "parent";
  const label = `${m.displayName}${m.me ? ` ${G.familyYou}` : ""}`;
  const head = fel("span", { class: "name", dir: "auto", textContent: label });
  const badge = fel("span", { class: `family-role ${m.role}`, textContent: roleName(m.role) });
  const child = today && m.role === "child" ? today.find((c) => c.username === m.username) : null;
  const sub = child ? fel("span", { class: "family-today", textContent: todayLine(child.windows) }) : null;
  const li = fel("li", { class: "family-member" });
  if (isParent && !m.me) {
    const open = fel("button", { type: "button", class: "row-btn", "aria-label": G.familyOpenYear(m.displayName) }, fel("span", { class: "family-who" }, head, sub), badge);
    open.addEventListener("click", () => go({ name: "member", arg: m.username }));
    li.append(open);
  } else {
    li.append(fel("div", { class: "row-btn static" }, fel("span", { class: "family-who" }, head, sub), badge));
  }
  if (isParent && m.role === "child") {
    const rm = fel("button", { type: "button", class: "link danger-link", textContent: G.familyRemove });
    rm.addEventListener("click", () => {
      if (!window.confirm(G.familyRemoveConfirm(m.displayName))) return;
      familyAction(rm, () => api().family.remove(m.username), G.familyRemoved);
    });
    li.append(rm);
  }
  return li;
}

function inviteForm() {
  const input = fel("input", { id: "family-invite-name", maxLength: 20, autocomplete: "off", placeholder: G.familyInvitePh, "aria-label": G.familyInvitePh });
  const asChild = fel("button", { type: "button", textContent: G.familyAsChild });
  const asParent = fel("button", { type: "button", textContent: G.familyAsParent });
  const sync = () => {
    asChild.setAttribute("aria-pressed", String(inviteRole === "child"));
    asParent.setAttribute("aria-pressed", String(inviteRole === "parent"));
  };
  asChild.addEventListener("click", () => ((inviteRole = "child"), sync()));
  asParent.addEventListener("click", () => ((inviteRole = "parent"), sync()));
  sync();
  const send = fel("button", { type: "submit", class: "primary", textContent: G.familyInviteSend });
  const form = fel("form", { class: "family-form", noValidate: true }, input, fel("div", { class: "seg", role: "group" }, asChild, asParent), send);
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const name = input.value.trim();
    if (!name) return input.focus();
    familyAction(send, () => api().family.invite(name, inviteRole), G.familyInviteSent);
  });
  return form;
}

function notifySettings(fam) {
  const modes = [
    ["off", G.familyNotifyOff],
    ["window", G.familyNotifyWindow],
    ["daily", G.familyNotifyDaily],
  ];
  const seg = fel(
    "div",
    { class: "seg family-notify", role: "group", "aria-label": G.familyNotifyTitle },
    modes.map(([mode, text]) => {
      const b = fel("button", { type: "button", textContent: text });
      b.setAttribute("aria-pressed", String(fam.notify === mode));
      b.addEventListener("click", () => {
        if (fam.notify === mode) return;
        familyAction(b, () => api().family.settings(mode), G.familySaved);
      });
      return b;
    })
  );
  return [fel("h3", { textContent: G.familyNotifyTitle }), seg, fel("p", { class: "note", textContent: G.familyNotifyNote })];
}

async function renderFamily() {
  const body = $("family-body");
  if (!account || account.legacy) {
    body.replaceChildren(fel("p", { class: "muted", textContent: G.familySignIn }));
    return;
  }
  if (!body.childElementCount) body.replaceChildren(fel("ul", { class: "people" }, skeletonItems(4)));
  let st;
  try {
    st = await api().family.get();
  } catch (e) {
    if (e.status === 401) return body.replaceChildren(fel("p", { class: "muted", textContent: G.familySignIn }));
    return body.replaceChildren(fel("p", { class: "muted", textContent: G.offline }), retryButton(renderFamily));
  }
  await cacheFamilyAlerts(st.family);
  $("family-badge").hidden = !st.invites.length;
  const fam = st.family;
  const parts = [];

  if (st.invites.length) {
    parts.push(fel("h3", { textContent: G.familyInvitesTitle }), st.invites.map(inviteCard));
  }

  if (!fam) {
    const create = fel("button", { type: "button", class: "primary wide", textContent: G.familyCreate });
    create.addEventListener("click", () => familyAction(create, () => api().family.create(), G.familyCreated));
    parts.push(fel("p", { class: "note", textContent: G.familyIntro }), create);
    return body.replaceChildren(...parts.flat());
  }

  let today = null;
  if (fam.role === "parent") {
    try {
      today = (await api().family.status(FAMILY_PRAYERS.map((p) => `${localDay()}:${p}`))).children;
    } catch {
      today = null;
    }
  }
  parts.push(
    fel("h3", { textContent: G.familyMembers }),
    fel("ul", { class: "people family-list" }, fam.members.map((m) => memberRow(m, fam, today)))
  );

  if (fam.role === "parent") {
    parts.push(fel("h3", { textContent: G.familyInviteTitle }), inviteForm());
    if (st.sent.length) {
      parts.push(
        fel("h3", { textContent: G.familyPending }),
        fel(
          "ul",
          { class: "people" },
          st.sent.map((s) => {
            const cancel = fel("button", { type: "button", class: "link", textContent: G.familyCancelInvite });
            cancel.addEventListener("click", () => familyAction(cancel, () => api().family.dropInvite(s.id)));
            return fel("li", { class: "family-member" }, fel("div", { class: "row-btn static" }, fel("span", { class: "name", dir: "auto", textContent: s.to.displayName }), fel("span", { class: "family-role", textContent: roleName(s.role) })), cancel);
          })
        )
      );
    }
    parts.push(notifySettings(fam));
    const leave = fel("button", { type: "button", class: "danger wide-danger", textContent: G.familyLeave });
    leave.addEventListener("click", () => {
      const parents = fam.members.filter((m) => m.role === "parent").length;
      if (!window.confirm(parents > 1 ? G.familyLeaveConfirm : G.familyLeaveLastConfirm)) return;
      familyAction(leave, () => api().family.leave(), G.familyLeft);
    });
    parts.push(leave);
  } else {
    parts.push(fel("p", { class: "note", textContent: G.familyChildNote }));
  }
  body.replaceChildren(...parts.flat());
}

// ---- a member's year ----------------------------------------------------------

function yearCalendar(y) {
  const months = [];
  for (let m = 0; m < 12; m++) {
    const first = new Date(y.year, m, 1);
    const daysIn = new Date(y.year, m + 1, 0).getDate();
    const cells = [];
    // Leading blanks so columns are weekdays (week starts Saturday in Arabic, else Sunday/Monday by locale).
    const startDay = lang === "ar" || lang === "ur" ? 6 : 0;
    const lead = (first.getDay() - startDay + 7) % 7;
    for (let i = 0; i < lead; i++) cells.push(fel("span", { class: "cal-cell blank" }));
    for (let d = 1; d <= daysIn; d++) {
      const key = `${y.year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const info = y.days[key];
      const n = info ? info.windows : 0;
      const tip = G.familyDayTip(fmtDay(key), n, info ? info.points : 0);
      cells.push(fel("span", { class: `cal-cell w${n}${info ? " active" : ""}`, title: tip, "aria-label": tip }));
    }
    months.push(
      fel(
        "div",
        { class: "cal-month" },
        fel("div", { class: "cal-head" }, fel("b", { textContent: monthLabel(first) }), fel("span", { class: "muted", textContent: G.familyPoints(y.months[m]) })),
        fel("div", { class: "cal-grid" }, cells)
      )
    );
  }
  const cal = fel("div", { class: "cal" }, months);
  // Phones have no hover: a tap on a day says what that day held.
  cal.addEventListener("click", (e) => {
    const cell = e.target.closest && e.target.closest(".cal-cell[title]");
    if (cell) showNotice(cell.title, { autoHide: true });
  });
  return cal;
}

const fmtDay = (key) => {
  const d = new Date(`${key}T12:00:00`);
  return DATE_NAMES[lang] ? `${d.getDate()} ${monthName(lang, locale, d, false)}` : d.toLocaleDateString(locale, { day: "numeric", month: "long" });
};
const monthLabel = (d) => (DATE_NAMES[lang] ? monthName(lang, locale, d, true) : d.toLocaleDateString(locale, { month: "long" }));

function legend() {
  return fel(
    "div",
    { class: "cal-legend" },
    fel("span", { class: "muted", textContent: G.familyLegend }),
    [0, 1, 2, 3, 4, 5].map((n) => fel("span", { class: "cal-key" }, fel("span", { class: `cal-cell w${n}${n ? " active" : ""}` }), fel("span", { textContent: fmtNum(n) })))
  );
}

async function openMember(name) {
  memberName = name;
  const body = $("member-body");
  body.replaceChildren(fel("div", { class: "skeleton-block" }), fel("ul", { class: "people" }, skeletonItems(3)));
  if (!account) return body.replaceChildren(fel("p", { class: "muted", textContent: G.familySignIn }));
  let y;
  try {
    y = await api().family.year(name, memberYear);
  } catch (e) {
    if (memberName !== name) return;
    if (e.status === 404 || e.status === 403) return body.replaceChildren(fel("p", { class: "muted", textContent: G.familyNotMember }));
    return body.replaceChildren(fel("p", { class: "muted", textContent: G.offline }), retryButton(() => openMember(name)));
  }
  if (memberName !== name) return; // another member was opened meanwhile
  const thisYear = new Date().getFullYear();
  const rtl = lang === "ar" || lang === "ur";
  const prev = fel("button", { type: "button", class: "ghost", textContent: rtl ? "›" : "‹", "aria-label": String(memberYear - 1), disabled: memberYear <= 2026 });
  const next = fel("button", { type: "button", class: "ghost", textContent: rtl ? "‹" : "›", "aria-label": String(memberYear + 1), disabled: memberYear >= thisYear });
  prev.addEventListener("click", () => ((memberYear -= 1), openMember(name)));
  next.addEventListener("click", () => ((memberYear += 1), openMember(name)));
  body.replaceChildren(
    fel("h2", { dir: "auto", textContent: y.user.displayName }),
    fel("p", { class: "muted", textContent: roleName(y.role) }),
    fel("div", { class: "family-year-nav" }, prev, fel("b", { textContent: String(y.year) }), next),
    fel("p", { class: "family-summary", textContent: G.familyYearSummary(y.points, y.windows, y.activeDays) }),
    legend(),
    yearCalendar(y)
  );
}
