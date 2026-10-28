// ---- Helpers ----------------------------------------------------------------

function showError(msg) {
  if (!msg) { el.error.hidden = true; el.error.textContent = ""; return; }
  el.error.hidden = false;
  el.error.textContent = msg;
  // The settings are split into cards and the error line sits under the first
  // one, so bring it into view when it was raised from a card further down.
  if (!el.settingsView.hidden && !document.body.classList.contains("embedded")) {
    try { el.error.scrollIntoView({ block: "nearest" }); } catch {}
  }
}
