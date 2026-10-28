// ---- Welcome-page wizard embed ----------------------------------------------
// When embedded as popup.html#settings, the popup is the settings surface for
// the welcome wizard: it shows one field group at a time (driven by the parent),
// reports its height so the iframe self-sizes, and commits the location on Finish.

function reportEmbedHeight() {
  // Measure the body's content height, not documentElement.scrollHeight: the
  // latter is floored by the iframe's viewport height, so once the iframe grows
  // (all groups are briefly visible before the wizard hides all but one) it can
  // never shrink back, leaving a tall empty gap below the active group.
  const height = Math.ceil(document.body.getBoundingClientRect().height);
  parent.postMessage({ type: "PTW_HEIGHT", height }, location.origin);
}

let currentWizardGroup = null;

// Show only the field group for the current wizard step; hide the rest plus the
// save/location button row (the wizard drives those). The error line stays.
// The field groups sit inside the settings cards: a card stays visible only
// while it holds the active group (its title is hidden in the embed by CSS).
function showWizardGroup(group) {
  currentWizardGroup = group;
  const showOnly = (node) => {
    const g = node.getAttribute("data-group");
    node.hidden = g ? g !== group : true;
    return !node.hidden;
  };
  for (const child of el.settingsBody.children) {
    if (child === el.error) continue;
    if (child.classList.contains("settings-card")) {
      let any = false;
      for (const inner of child.children) {
        if (inner.classList.contains("settings-card-title")) continue;
        if (showOnly(inner)) any = true;
      }
      child.hidden = !any;
      continue;
    }
    showOnly(child);
  }
  // Respect nested visibility rules within the group we just revealed.
  if (group === "appearance") updateDigitsVisibility();
  if (group === "lock") updateLockOptionsVisibility();
  if (group === "dhikr") updateTasbihOptionsVisibility();
  reportEmbedHeight();
}

function startWizardEmbed() {
  document.body.classList.add("embedded");
  showSettingsView();

  window.addEventListener("message", async (event) => {
    if (event.origin !== location.origin) return;
    const msg = event.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "PTW_GROUP") {
      showWizardGroup(msg.group);
    } else if (msg.type === "PTW_LANG") {
      if (msg.lang) await setLanguage(msg.lang);
      if (currentWizardGroup) showWizardGroup(currentWizardGroup);
      else reportEmbedHeight();
    } else if (msg.type === "PTW_COMMIT") {
      const result = await commitLocation();
      parent.postMessage({ type: "PTW_COMMIT_RESULT", ...result }, location.origin);
    }
  });

  if (window.ResizeObserver) {
    new ResizeObserver(reportEmbedHeight).observe(document.body);
  }

  // Tell the parent we're ready for the initial language + group.
  parent.postMessage({ type: "PTW_READY" }, location.origin);
}

// The desktop shell keeps this popup window alive between opens (hidden +
// suspended, not destroyed), so a dismissal while on Settings would otherwise
// reopen straight into Settings. The shell calls this hook every time it
// re-shows the window. (visibilitychange can't do this: the handler runs after
// resume, when visibilityState already reads "visible" again.) The extension
// popup is torn down on close (never calls this); the wizard embed (#settings)
// must stay on its settings surface.
window.__ptPopupReset = () => {
  if (window.location.hash !== "#settings") showMainView();
};

// Android hardware back: step out of Settings back to the main view. Returns
// true when handled; false means we're already home (or in the wizard embed,
// which owns its own navigation) and the shell should close the app instead.
window.__ptPopupBack = () => {
  if (window.location.hash === "#settings") return false;
  if (el.settingsView.hidden) return false;
  showMainView();
  return true;
};
