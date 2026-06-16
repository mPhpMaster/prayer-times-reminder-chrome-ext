// Injected into the active tab for periodic dhikr reminders.
// Shows a floating card; dismiss on click or after 10 seconds.

(function () {
  if (window.__prayerTasbihInjected) return;
  window.__prayerTasbihInjected = true;

  const ROOT_ID = "prayer-times-tasbih-root";
  const DISMISS_MS = 10000;
  const VALID_POSITIONS = new Set([
    "top-left", "top-right", "top-center",
    "bottom-left", "bottom-right", "bottom-center"
  ]);
  let autoDismissTimer = null;
  let isShowing = false;

  function normalizePosition(value) {
    const id = String(value || "bottom-right");
    return VALID_POSITIONS.has(id) ? id : "bottom-right";
  }

  function clearTasbih() {
    if (autoDismissTimer) {
      clearTimeout(autoDismissTimer);
      autoDismissTimer = null;
    }
    isShowing = false;
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const card = root.shadowRoot?.querySelector(".tasbih-card");
    if (card) {
      card.classList.add("fade-out");
      setTimeout(() => root.remove(), 200);
    } else {
      root.remove();
    }
  }

  function lineFont(variant, uiTheme) {
    if (variant === "urdu") {
      return uiTheme === "classic"
        ? '"Noto Nastaliq Urdu", "Segoe UI", "Tahoma", system-ui, sans-serif'
        : '"Noto Nastaliq Urdu", "Amiri", "Scheherazade New", serif';
    }
    if (variant === "arabic") {
      return uiTheme === "classic"
        ? '"Segoe UI", "Tahoma", "Amiri", system-ui, sans-serif'
        : '"Amiri", "Scheherazade New", serif';
    }
    return uiTheme === "classic"
      ? '"Segoe UI", system-ui, -apple-system, sans-serif'
      : '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
  }

  function renderTasbihLines(container, display, legacyText) {
    container.replaceChildren();
    const lines = display?.lines;
    if (Array.isArray(lines) && lines.length) {
      lines.forEach((line) => {
        const el = document.createElement("div");
        el.className = `tasbih-line tasbih-line--${line.variant || "text"}`;
        el.dir = line.dir || "ltr";
        el.textContent = line.text || "";
        container.appendChild(el);
      });
      return;
    }
    if (legacyText) {
      const el = document.createElement("div");
      el.className = "tasbih-line tasbih-line--text";
      el.textContent = legacyText;
      container.appendChild(el);
    }
  }

  function activateTasbih(config) {
    if (isShowing) return;
    clearTasbih();

    const { display, text, label, dir = "ltr", lang = "en", position = "bottom-right", theme = "midnight-emerald" } = config;
    if (!display && !text) return;

    const uiTheme = theme === "classic" ? "classic" : "midnight-emerald";
    const pos = normalizePosition(position);
    const cardFont = dir === "rtl"
      ? (uiTheme === "classic"
        ? '"Segoe UI", "Tahoma", "Noto Nastaliq Urdu", system-ui, sans-serif'
        : '"Amiri", "Scheherazade New", serif')
      : (uiTheme === "classic"
        ? '"Segoe UI", system-ui, -apple-system, sans-serif'
        : '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif');
    isShowing = true;

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
          --gradient-card: linear-gradient(145deg, oklch(0.26 0.04 185 / 0.9), oklch(0.22 0.035 190 / 0.85));
          --shadow-card: 0 10px 40px -15px oklch(0 0 0 / 0.5);
        }
        .tasbih-wrap {
          position: fixed;
          z-index: 2147483646;
          direction: ${dir};
          pointer-events: none;
        }
        .pos-top-left { top: 24px; left: 24px; }
        .pos-top-right { top: 24px; right: 24px; }
        .pos-top-center { top: 24px; left: 50%; translate: -50% 0; }
        .pos-bottom-left { bottom: 24px; left: 24px; }
        .pos-bottom-right { bottom: 24px; right: 24px; }
        .pos-bottom-center { bottom: 24px; left: 50%; translate: -50% 0; }
        .tasbih-card {
          pointer-events: auto;
          max-width: 320px;
          padding: 16px 20px;
          background: var(--gradient-card);
          border: 1px solid oklch(1 0 0 / 0.08);
          border-radius: 1rem;
          box-shadow: var(--shadow-card);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          color: var(--foreground);
          font-family: ${cardFont};
          font-size: 16px;
          line-height: 1.6;
          text-align: center;
          cursor: pointer;
          animation: fadeIn 0.25s ease;
          user-select: none;
        }
        .tasbih-card.fade-out {
          animation: fadeOut 0.2s ease forwards;
        }
        .tasbih-label {
          display: block;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--teal);
          margin-bottom: 8px;
        }
        .tasbih-text {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .tasbih-line {
          font-weight: 600;
          color: var(--foreground);
        }
        .tasbih-line--arabic {
          font-size: 1.05em;
          line-height: 1.7;
        }
        .tasbih-line--urdu {
          font-family: "Noto Nastaliq Urdu", "Amiri", "Scheherazade New", serif;
          font-size: 1.1em;
          line-height: 1.8;
        }
        .tasbih-line--translation {
          font-family: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
          font-size: 0.9em;
          font-weight: 500;
          color: var(--muted-foreground);
          line-height: 1.5;
        }
        .tasbih-line--transliteration {
          font-family: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(8px); }
        }
        :host([data-theme="classic"]) .tasbih-card {
          background: rgba(15, 32, 39, 0.92);
          border: 1px solid rgba(45, 212, 167, 0.5);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        :host([data-theme="classic"]) .tasbih-label { color: #2dd4a7; }
        :host([data-theme="classic"]) .tasbih-line--translation {
          color: rgba(255, 255, 255, 0.72);
        }
      </style>
      <div class="tasbih-wrap pos-${pos}" role="status" aria-live="polite">
        <div class="tasbih-card" tabindex="0">
          <span class="tasbih-label" id="pt-tasbih-label"></span>
          <div class="tasbih-text" id="pt-tasbih-text"></div>
        </div>
      </div>
    `;

    shadow.getElementById("pt-tasbih-label").textContent = label || "Dhikr";
    const textContainer = shadow.getElementById("pt-tasbih-text");
    renderTasbihLines(textContainer, display, text);

    const lines = display?.lines;
    if (Array.isArray(lines)) {
      textContainer.querySelectorAll(".tasbih-line").forEach((el, i) => {
        const variant = lines[i]?.variant;
        if (variant) el.style.fontFamily = lineFont(variant, uiTheme);
      });
    }

    const card = shadow.querySelector(".tasbih-card");
    card.addEventListener("click", (e) => {
      e.stopPropagation();
      clearTasbih();
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        clearTasbih();
      }
    });

    document.documentElement.appendChild(host);
    autoDismissTimer = setTimeout(clearTasbih, DISMISS_MS);
  }

  window.__prayerTasbihActivate = activateTasbih;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "ACTIVATE_TASBIH") {
      activateTasbih(msg);
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === "CLEAR_TASBIH") {
      clearTasbih();
      sendResponse({ ok: true });
      return true;
    }
  });
})();
