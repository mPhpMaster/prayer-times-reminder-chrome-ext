// ---- celebration ------------------------------------------------------------
// A short, calm card when a prayer's adhkar are all done. Motion follows the
// system "reduce motion" setting (CSS); the soft sound is opt-in.
let celebrateTimer = 0;
function celebrate(prayer) {
  const allFive = dayJourney(state, current.day, GAME_PRAYERS, idsFor).every((s) => s.status === "done");
  $("celebrate-title").textContent = G.celebrateTitle(prayerName(prayer));
  $("celebrate-body").textContent = allFive ? G.dayAll : G.celebrateBody;
  $("celebrate").hidden = false;
  $("celebrate-ok").focus();
  if (soundOn) softChime();
  clearTimeout(celebrateTimer);
  celebrateTimer = setTimeout(closeCelebration, CELEBRATE_HIDE_MS);
}
function closeCelebration() {
  clearTimeout(celebrateTimer);
  $("celebrate").hidden = true;
}
// Two quiet sine notes (no bundled sound file).
function softChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [523.25, 659.25].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t0 = ctx.currentTime + i * 0.22;
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.06, t0 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 0.95);
    });
    setTimeout(() => ctx.close(), 1600);
  } catch {
    // no audio: the card alone is enough
  }
}
