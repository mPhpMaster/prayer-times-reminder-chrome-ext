// ---- sync -----------------------------------------------------------------
// Sends finished items the server hasn't acknowledged, in batches, and marks
// each batch synced only after the server accepted it. If the account changes
// mid-sync, nothing is marked for the old one: the new account re-sends
// everything (adoptSyncAccount) and the server keeps one row per item.
let syncing = false;
async function syncNow() {
  if (!account || !apiUrl || syncing) return;
  const token = account.token;
  const rows = pendingCompletions(state);
  if (!rows.length) return;
  syncing = true;
  try {
    const unlocked = [];
    for (const batch of syncBatches(rows)) {
      const res = await gameApi(apiUrl, token).pushProgress(batch);
      if (!account || account.token !== token) return;
      markSynced(state, batch);
      await save();
      // The server reports an achievement only in the call that earned it,
      // so a resent batch never repeats the note.
      unlocked.push(...((res && res.newAchievements) || []).filter((id) => G.ach[id]));
    }
    if (unlocked.length) showNotice(unlocked.map((id) => G.achUnlocked(G.ach[id][0])).join(" · "), { autoHide: true });
  } catch (e) {
    if (e.status === 401 && account && account.token === token) await forgetAccount(); // token no longer valid
  } finally {
    syncing = false;
    if (account && account.token !== token) syncNow();
  }
}

async function forgetAccount() {
  account = null;
  await Platform.store.remove(GAME_ACCOUNT_KEY);
}

// ---- the game's options, kept with the account ---------------------------------
// Task alerts, the day's journey, the soft sound, the optional disputed adhkar and the Chrome new tab are saved on the server
// (PATCH /v1/me settings) and read back at sign-in, so they follow the player
// to any device. The first time an account has none, this device's choices
// become the account's.
function pushSettings(patch) {
  if (account && apiUrl) api().updateMe({ settings: patch }).catch(() => {});
}

async function adoptAccountSettings(s) {
  if (!s) {
    const { gameAlerts, newTabPage } = await Platform.store.get(["gameAlerts", "newTabPage"]);
    return pushSettings({ alerts: gameAlerts !== false, journey: journeyOn, sound: soundOn, newTab: newTabPage !== false, disputed: disputedOn });
  }
  if (typeof s.newTab === "boolean") {
    await Platform.store.set({ newTabPage: s.newTab });
    $("newtab-on").checked = s.newTab;
  }
  if (typeof s.alerts === "boolean") {
    await Platform.store.set({ gameAlerts: s.alerts });
    $("alerts").checked = s.alerts;
    if (Platform.gameAlerts) Platform.gameAlerts.refresh();
  }
  if (typeof s.journey === "boolean") {
    journeyOn = s.journey;
    await Platform.store.set({ gameJourney: journeyOn });
    $("journey-on").checked = journeyOn;
  }
  if (typeof s.disputed === "boolean") await setDisputed(s.disputed);
  if (typeof s.sound === "boolean") {
    soundOn = s.sound;
    await Platform.store.set({ gameSound: soundOn });
    $("sound-on").checked = soundOn;
  }
}

// The optional disputed adhkar under the side card: saved on this device and
// with the account (settings.disputed), off by default.
async function setDisputed(on) {
  disputedOn = on === true;
  await Platform.store.set({ gameDisputed: disputedOn });
  $("disputed-on").checked = disputedOn;
  disputedTasks = side ? disputedForSide(side.kind, disputedOn) : [];
  if (current) renderList();
}
