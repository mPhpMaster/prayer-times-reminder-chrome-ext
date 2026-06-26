// Injected into the active tab when prayer time arrives (or on test).
// Shows a full-page lock overlay with a countdown until unlock.

(function () {
  if (window.__prayerTabLockInjected) return;
  window.__prayerTabLockInjected = true;

  const ROOT_ID = "prayer-times-lock-root";
  let tickTimer = null;
  let blockers = [];

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  const HI_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];
  function localizeNum(str, lang, arabicDigits) {
    if (lang === "hi") {
      return String(str).replace(/[0-9]/g, (d) => HI_DIGITS[Number(d)]);
    }
    const rtlDigits = (lang === "ar" || lang === "ur") && arabicDigits;
    if (!rtlDigits) return str;
    return String(str).replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);
  }

  function formatCountdown(ms, lang, arabicDigits) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return localizeNum(`${pad(m)}:${pad(s)}`, lang, arabicDigits);
  }

  function clearLock() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    for (const fn of blockers) {
      window.removeEventListener("keydown", fn, true);
      window.removeEventListener("keyup", fn, true);
      window.removeEventListener("keypress", fn, true);
      window.removeEventListener("wheel", fn, { capture: true });
      window.removeEventListener("touchmove", fn, { capture: true });
    }
    blockers = [];
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    const root = document.getElementById(ROOT_ID);
    if (root) root.remove();
  }

  function blockEvent(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  }

  function activateLock(config) {
    clearLock();

    const {
      prayerName,
      title,
      subtitle,
      countdownPrefix,
      unlockAt,
      dir = "ltr",
      lang = "en",
      arabicDigits = true,
      allowUnlock = false,
      unlockLabel = "Unlock tab",
      theme = "midnight-emerald"
    } = config;

    const uiTheme = theme === "classic" ? "classic" : "midnight-emerald";
    const cardFont = dir === "rtl"
      ? (uiTheme === "classic"
        ? '"Segoe UI", "Tahoma", "Noto Nastaliq Urdu", system-ui, sans-serif'
        : "var(--font-arabic)")
      : (uiTheme === "classic"
        ? '"Segoe UI", system-ui, -apple-system, sans-serif'
        : "var(--font-display)");

    const host = document.createElement("div");
    host.id = ROOT_ID;
    host.dataset.theme = uiTheme;
    const shadow = host.attachShadow({ mode: "closed" });

    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          --foreground: oklch(0.97 0.01 180);
          --muted-foreground: oklch(0.7 0.02 180);
          --teal: oklch(0.78 0.14 170);
          --gold: oklch(0.82 0.14 85);
          --card: oklch(0.23 0.035 185);
          --border: oklch(1 0 0 / 8%);
          --input: oklch(1 0 0 / 10%);
          --gradient-next: linear-gradient(135deg, oklch(0.32 0.09 170 / 0.85), oklch(0.28 0.07 185 / 0.7));
          --shadow-glow: 0 0 40px -10px oklch(0.78 0.14 170 / 0.5);
          --shadow-card: 0 10px 40px -15px oklch(0 0 0 / 0.5);
          --font-display: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
          --font-arabic: "Amiri", "Scheherazade New", serif;
        }
        .lock {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          display: flex;
          align-items: center;
          justify-content: center;
          background: oklch(0.12 0.02 180 / 0.92);
          color: var(--foreground);
          font-family: ${cardFont};
          text-align: center;
          padding: 24px;
          box-sizing: border-box;
          direction: ${dir};
        }
        .card {
          max-width: 420px;
          width: 100%;
          background: var(--gradient-next);
          border: 1px solid oklch(0.78 0.14 170 / 0.35);
          border-radius: 1rem;
          padding: 32px 28px;
          box-shadow: var(--shadow-glow), var(--shadow-card);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .icon { font-size: 48px; line-height: 1; margin-bottom: 12px; }
        .prayer {
          font-size: 28px;
          font-weight: 700;
          color: var(--teal);
          margin-bottom: 8px;
        }
        .title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .subtitle {
          font-size: 14px;
          color: var(--muted-foreground);
          line-height: 1.5;
          margin-bottom: 24px;
        }
        .countdown-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--muted-foreground);
          margin-bottom: 6px;
        }
        .countdown {
          font-size: 40px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          color: var(--gold);
        }
        .close-btn {
          position: absolute;
          top: 16px;
          inset-inline-end: 16px;
          width: 40px;
          height: 40px;
          border: 1px solid var(--border);
          border-radius: 0.625rem;
          background: oklch(0.23 0.035 185 / 0.9);
          color: var(--foreground);
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: var(--shadow-card);
        }
        .close-btn:hover {
          background: var(--input);
          border-color: oklch(0.78 0.14 170 / 0.35);
        }
        :host([data-theme="classic"]) .lock {
          background: rgba(0, 0, 0, 0.9);
        }
        :host([data-theme="classic"]) .card {
          background: rgba(15, 32, 39, 0.88);
          border: 1px solid rgba(45, 212, 167, 0.45);
          border-radius: 16px;
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        :host([data-theme="classic"]) .prayer { color: #2dd4a7; }
        :host([data-theme="classic"]) .subtitle,
        :host([data-theme="classic"]) .countdown-label { color: #9fb3b0; }
        :host([data-theme="classic"]) .countdown { color: #f4c95d; }
        :host([data-theme="classic"]) .close-btn {
          border: 1px solid rgba(255, 255, 255, 0.25);
          background: rgba(15, 32, 39, 0.9);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
        }
        :host([data-theme="classic"]) .close-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.35);
        }
      </style>
      <div class="lock" role="dialog" aria-modal="true" aria-labelledby="pt-lock-title">
        <button type="button" class="close-btn" id="pt-lock-close" hidden aria-label="">×</button>
        <div class="card">
          <div class="icon">🕌</div>
          <div class="prayer" id="pt-lock-prayer"></div>
          <div class="title" id="pt-lock-title"></div>
          <div class="subtitle" id="pt-lock-subtitle"></div>
          <div class="countdown-label" id="pt-lock-countdown-label"></div>
          <div class="countdown" id="pt-lock-countdown">05:00</div>
        </div>
      </div>
    `;

    shadow.getElementById("pt-lock-prayer").textContent = prayerName;
    shadow.getElementById("pt-lock-title").textContent = title;
    shadow.getElementById("pt-lock-subtitle").textContent = subtitle;
    shadow.getElementById("pt-lock-countdown-label").textContent = countdownPrefix;
    const countdownEl = shadow.getElementById("pt-lock-countdown");
    const closeBtn = shadow.getElementById("pt-lock-close");

    if (allowUnlock === true) {
      closeBtn.hidden = false;
      closeBtn.setAttribute("aria-label", unlockLabel);
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        clearLock();
        // End the lock window everywhere, not just this tab.
        try {
          chrome.runtime.sendMessage({ type: "UNLOCK_ALL" });
        } catch {
          // Background may be asleep; CLEAR_LOCK broadcast will still arrive.
        }
      });
    } else {
      closeBtn.remove();
    }

    document.documentElement.appendChild(host);
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    const overlay = shadow.querySelector(".lock");
    for (const type of ["mousedown", "mouseup", "dblclick", "contextmenu"]) {
      overlay.addEventListener(type, (e) => {
        if (allowUnlock === true && e.composedPath().includes(closeBtn)) return;
        blockEvent(e);
      }, true);
    }
    overlay.addEventListener("click", (e) => {
      if (allowUnlock === true && e.composedPath().includes(closeBtn)) return;
      blockEvent(e);
    }, true);
    blockers.push(blockEvent);
    window.addEventListener("keydown", blockEvent, true);
    window.addEventListener("keyup", blockEvent, true);
    window.addEventListener("keypress", blockEvent, true);
    window.addEventListener("wheel", blockEvent, { capture: true, passive: false });
    window.addEventListener("touchmove", blockEvent, { capture: true, passive: false });

    function tick() {
      const remaining = unlockAt - Date.now();
      if (remaining <= 0) {
        clearLock();
        return;
      }
      countdownEl.textContent = formatCountdown(remaining, lang, arabicDigits);
    }

    tick();
    tickTimer = setInterval(tick, 1000);
  }

  window.__prayerTabLockActivate = activateLock;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "ACTIVATE_LOCK") {
      activateLock(msg);
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === "CLEAR_LOCK") {
      clearLock();
      sendResponse({ ok: true });
      return true;
    }
  });
})();
