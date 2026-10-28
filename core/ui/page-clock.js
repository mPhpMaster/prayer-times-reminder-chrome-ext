// One clock per visible app page. Hidden pages do no periodic work unless
// an active operation (such as a voice reading) needs a deadline check.
function createPageClock(tick, { intervalMs = 1000, enabled = () => true, runWhenHidden = () => false } = {}) {
  let timer = null;
  let stopped = false;
  let ticking = false;
  const canRun = () => !stopped && enabled() && (!document.hidden || runWhenHidden());

  function pause() {
    if (timer !== null) clearInterval(timer);
    timer = null;
  }

  function run() {
    if (ticking || !canRun()) return;
    ticking = true;
    try { tick(); } finally { ticking = false; }
  }

  function refresh(immediate = true) {
    pause();
    document.body?.classList.toggle("pt-background", !!document.hidden);
    if (!canRun()) return;
    if (immediate !== false) run();
    if (canRun() && timer === null) timer = setInterval(run, intervalMs);
  }

  function pageshow(event) { if (event.persisted) refresh(); }
  function stop() {
    stopped = true;
    pause();
    document.removeEventListener("visibilitychange", refresh);
    window.removeEventListener("pagehide", pause);
    window.removeEventListener("pageshow", pageshow);
  }

  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("pagehide", pause);
  window.addEventListener("pageshow", pageshow);
  refresh();
  return { refresh, stop };
}
