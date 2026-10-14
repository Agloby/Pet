import {
  advancePetState,
  bondLabel,
  createPetState,
  moodFor,
  renamePet,
  shareSnack,
} from "./pet-state.js";
import { clearPetState, loadPetState, savePetState } from "./storage.js";
import { CharacterPlayer } from "./sprite-player.js";
import { SyncClient } from "./sync-client.js";

const elements = {
  moodLabel: document.querySelector("#mood-label"),
  moodMessage: document.querySelector("#mood-message"),
  petNameButton: document.querySelector("#pet-name-button"),
  brandName: document.querySelector("#brand-name"),
  brandMark: document.querySelector("#brand-mark"),
  brandLink: document.querySelector("#brand-link"),
  lagoon: document.querySelector("#lagoon"),
  fullnessValue: document.querySelector("#fullness-value"),
  fullnessMeter: document.querySelector("#fullness-meter"),
  happinessValue: document.querySelector("#happiness-value"),
  happinessMeter: document.querySelector("#happiness-meter"),
  bondValue: document.querySelector("#bond-value"),
  careCount: document.querySelector("#care-count"),
  journalList: document.querySelector("#journal-list"),
  careButton: document.querySelector("#care-button"),
  careDescription: document.querySelector("#care-description"),
  carePanel: document.querySelector("#care-panel"),
  resetButton: document.querySelector("#reset-button"),
  character: document.querySelector("#kern-character"),
  syncButton: document.querySelector("#sync-button"),
  syncDot: document.querySelector("#sync-dot"),
  syncLabel: document.querySelector("#sync-label"),
  persistenceNote: document.querySelector("#persistence-note"),
  syncDialog: document.querySelector("#sync-dialog"),
  syncClose: document.querySelector("#sync-close"),
  signedOutPanel: document.querySelector("#signed-out-panel"),
  signedInPanel: document.querySelector("#signed-in-panel"),
  syncForm: document.querySelector("#sync-form"),
  syncUsername: document.querySelector("#sync-username"),
  syncPassword: document.querySelector("#sync-password"),
  syncMessage: document.querySelector("#sync-message"),
  signInButton: document.querySelector("#sign-in-button"),
  createAccountButton: document.querySelector("#create-account-button"),
  accountUsername: document.querySelector("#account-username"),
  accountAvatar: document.querySelector("#account-avatar"),
  accountSyncState: document.querySelector("#account-sync-state"),
  accountMessage: document.querySelector("#account-message"),
  syncNowButton: document.querySelector("#sync-now-button"),
  signOutButton: document.querySelector("#sign-out-button"),
  nameDialog: document.querySelector("#name-dialog"),
  nameClose: document.querySelector("#name-close"),
  nameForm: document.querySelector("#name-form"),
  nameInput: document.querySelector("#pet-name-input"),
  nameMessage: document.querySelector("#name-message"),
  keepNameButton: document.querySelector("#keep-name-button"),
  syncPetName: document.querySelector("#sync-pet-name"),
  notificationState: document.querySelector("#notification-state"),
  notificationDescription: document.querySelector("#notification-description"),
  notificationThreshold: document.querySelector("#notification-threshold"),
  notificationCooldown: document.querySelector("#notification-cooldown"),
  notificationMessage: document.querySelector("#notification-message"),
  notificationToggle: document.querySelector("#notification-toggle"),
  notificationTest: document.querySelector("#notification-test"),
};

let state = advancePetState(loadPetState(window.localStorage));
let syncState = { kind: "local", label: "Local only" };
let syncInFlight = null;
let notificationState = null;
let notificationBusy = false;
let deviceSubscribed = false;
const syncClient = new SyncClient({ storage: window.localStorage });
const characterPlayer = new CharacterPlayer(elements.character);

const formatTime = (timestamp) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));

function updateMeter(element, value) {
  const rounded = Math.round(value);
  element.style.width = `${rounded}%`;
  element.parentElement.setAttribute("aria-valuenow", String(rounded));
}

function setDialogMessage(element, message = "", tone = "error") {
  element.textContent = message;
  element.dataset.tone = tone;
}

function setSyncState(kind, label) {
  syncState = { kind, label };
  renderSync();
}

function renderSync() {
  const authenticated = syncClient.isAuthenticated;
  const pending = syncClient.pendingCount;

  elements.syncDot.dataset.status = syncState.kind;
  elements.syncLabel.textContent = syncState.label;
  elements.signedOutPanel.hidden = authenticated;
  elements.signedInPanel.hidden = !authenticated;

  if (authenticated) {
    elements.accountUsername.textContent = syncClient.session.username;
    elements.accountSyncState.textContent =
      pending > 0 ? `${pending} waiting` : syncState.kind === "syncing" ? "Syncing…" : "Up to date";
    elements.persistenceNote.textContent = `Synced as ${syncClient.session.username}. Offline changes wait safely on this device.`;
  } else {
    elements.persistenceNote.textContent =
      "Progress stays in this browser until you connect a sync profile.";
  }
  renderNotifications();
}

const notificationSupportAvailable = () =>
  "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;

function renderNotifications() {
  const supported = notificationSupportAvailable();
  const signedIn = syncClient.isAuthenticated;
  const enabled = signedIn && supported && deviceSubscribed;
  elements.notificationState.textContent = enabled ? "On" : "Off";
  elements.notificationState.dataset.enabled = String(enabled);
  elements.notificationToggle.textContent = enabled ? "Disable on this device" : "Enable alerts";
  elements.notificationToggle.disabled =
    notificationBusy || !signedIn || !supported || Notification.permission === "denied";
  elements.notificationTest.hidden = !enabled;
  elements.notificationTest.disabled = notificationBusy;
  elements.notificationThreshold.disabled = notificationBusy || !enabled;
  elements.notificationCooldown.disabled = notificationBusy || !enabled;

  if (!supported) {
    elements.notificationDescription.textContent =
      "This browser does not support care alerts. On iPhone, install Kern to the Home Screen first.";
  } else if (Notification.permission === "denied") {
    elements.notificationDescription.textContent =
      "Alerts are blocked in this browser. Allow notifications in the site settings to turn them on.";
  } else if (enabled) {
    elements.notificationDescription.textContent =
      `This device will hear from ${state.name} when fullness drops below ${elements.notificationThreshold.value}%.`;
  } else {
    elements.notificationDescription.textContent =
      "Get a private browser alert when your companion is getting hungry.";
  }
}

function applicationServerKey(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const bytes = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
}

async function currentPushSubscription() {
  if (!notificationSupportAvailable()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

async function refreshNotifications() {
  if (!syncClient.isAuthenticated || !notificationSupportAvailable()) {
    notificationState = null;
    deviceSubscribed = false;
    renderNotifications();
    return;
  }

  try {
    const [remote, subscription] = await Promise.all([
      syncClient.notificationState(),
      currentPushSubscription(),
    ]);
    notificationState = remote;
    deviceSubscribed = Boolean(subscription && remote.preferences.enabled);
    elements.notificationThreshold.value = String(remote.preferences.fullnessThreshold);
    elements.notificationCooldown.value = String(remote.preferences.cooldownHours);
    setDialogMessage(elements.notificationMessage);
  } catch (error) {
    setDialogMessage(elements.notificationMessage, error.message);
  }
  renderNotifications();
}

async function enableNotifications() {
  notificationBusy = true;
  renderNotifications();
  setDialogMessage(elements.notificationMessage, "Preparing care alerts…", "success");
  try {
    const remote = notificationState || await syncClient.notificationState();
    if (!remote.available || !remote.publicKey) throw new Error("Care alerts are unavailable right now.");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Allow notifications in this browser to enable alerts.");

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription() ||
      await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(remote.publicKey),
      });
    notificationState = await syncClient.registerNotificationSubscription(subscription.toJSON(), {
      fullnessThreshold: Number(elements.notificationThreshold.value),
      cooldownHours: Number(elements.notificationCooldown.value),
    });
    deviceSubscribed = true;
    setDialogMessage(elements.notificationMessage, "Care alerts are active on this device.", "success");
  } catch (error) {
    setDialogMessage(elements.notificationMessage, error.message);
  } finally {
    notificationBusy = false;
    renderNotifications();
  }
}

async function disableNotifications({ silent = false } = {}) {
  notificationBusy = true;
  renderNotifications();
  let subscription = null;
  try {
    subscription = await currentPushSubscription();
    if (subscription && syncClient.isAuthenticated) {
      notificationState = await syncClient.removeNotificationSubscription(subscription.endpoint);
    }
    if (!silent) setDialogMessage(elements.notificationMessage, "Care alerts are off on this device.", "success");
  } catch (error) {
    if (!silent) setDialogMessage(elements.notificationMessage, error.message);
  } finally {
    await subscription?.unsubscribe().catch(() => {});
    deviceSubscribed = false;
    notificationBusy = false;
    renderNotifications();
  }
}

async function saveNotificationPreferences() {
  if (!deviceSubscribed || notificationBusy) return;
  notificationBusy = true;
  renderNotifications();
  try {
    notificationState = await syncClient.saveNotificationPreferences({
      enabled: true,
      fullnessThreshold: Number(elements.notificationThreshold.value),
      cooldownHours: Number(elements.notificationCooldown.value),
    });
    setDialogMessage(elements.notificationMessage, "Reminder timing saved.", "success");
  } catch (error) {
    setDialogMessage(elements.notificationMessage, error.message);
  } finally {
    notificationBusy = false;
    renderNotifications();
  }
}

async function sendTestNotification() {
  notificationBusy = true;
  renderNotifications();
  setDialogMessage(elements.notificationMessage, "Sending a test alert…", "success");
  try {
    await syncClient.sendTestNotification();
    setDialogMessage(elements.notificationMessage, "Test sent. It may take a few seconds to arrive.", "success");
  } catch (error) {
    setDialogMessage(elements.notificationMessage, error.message);
  } finally {
    notificationBusy = false;
    renderNotifications();
  }
}

function render() {
  const mood = moodFor(state);
  const fullness = Math.round(state.fullness);
  const happiness = Math.round(state.happiness);
  const habitatMood = state.fullness < 25 ? "hungry" : happiness >= 88 ? "joyful" : "calm";

  elements.petNameButton.textContent = state.name;
  elements.petNameButton.title = `Rename ${state.name}`;
  elements.brandName.textContent = state.name;
  const initial = Array.from(state.name)[0]?.toLocaleUpperCase() || "K";
  elements.brandMark.textContent = initial;
  elements.accountAvatar.textContent = initial;
  elements.brandLink.setAttribute("aria-label", `${state.name} home`);
  elements.lagoon.setAttribute("aria-label", `Animated ${state.name} in a coral lagoon`);
  elements.carePanel.setAttribute("aria-label", `${state.name}’s current state`);
  elements.lagoon.dataset.mood = habitatMood;
  elements.careDescription.textContent = `Build trust and refill ${state.name}’s belly`;
  elements.syncPetName.textContent = state.name;
  document.title = `${state.name} — Reef Companion`;
  elements.moodLabel.textContent = mood.label;
  elements.moodMessage.textContent = mood.message;
  elements.fullnessValue.textContent = `${fullness}%`;
  elements.happinessValue.textContent = `${happiness}%`;
  elements.bondValue.textContent = bondLabel(state.bond);
  elements.careCount.textContent = `${state.careCount} ${state.careCount === 1 ? "check-in" : "check-ins"}`;
  updateMeter(elements.fullnessMeter, state.fullness);
  updateMeter(elements.happinessMeter, state.happiness);

  elements.journalList.replaceChildren();
  if (state.journal.length === 0) {
    const empty = document.createElement("li");
    empty.className = "journal-empty";
    empty.textContent = `Your first shared moment with ${state.name} will appear here.`;
    elements.journalList.append(empty);
  } else {
    for (const entry of state.journal) {
      const item = document.createElement("li");
      item.className = "journal-entry";

      const message = document.createElement("span");
      message.textContent = entry.message;

      const time = document.createElement("time");
      time.dateTime = entry.at;
      time.textContent = formatTime(entry.at);

      item.append(message, time);
      elements.journalList.append(item);
    }
  }
}

function adoptRemoteState(remoteState) {
  if (!remoteState) return;
  state = advancePetState(remoteState);
  savePetState(window.localStorage, state);
  render();
}

async function synchronize() {
  if (!syncClient.isAuthenticated) {
    setSyncState("local", "Local only");
    return { status: "local" };
  }
  if (syncInFlight) return syncInFlight;

  setSyncState("syncing", "Syncing…");
  syncInFlight = (async () => {
    try {
      const result = await syncClient.flush();
      adoptRemoteState(result.petState);
      setSyncState("synced", "Synced");
      setDialogMessage(elements.accountMessage, `${state.name} is up to date.`, "success");
      return result;
    } catch (error) {
      if (error.code === "offline") {
        const pending = syncClient.pendingCount;
        setSyncState(pending ? "pending" : "offline", pending ? `${pending} waiting` : "Offline");
        setDialogMessage(
          elements.accountMessage,
          pending
            ? `${pending} change${pending === 1 ? " is" : "s are"} waiting for a connection.`
            : "The sync service is currently unreachable.",
        );
      } else if (error.code === "unauthorized") {
        setSyncState("local", "Sign in again");
        setDialogMessage(elements.syncMessage, error.message);
      } else {
        setSyncState("pending", "Sync issue");
        setDialogMessage(elements.accountMessage, error.message);
      }
      return { status: error.code };
    } finally {
      syncInFlight = null;
      renderSync();
    }
  })();
  return syncInFlight;
}

async function handleCare() {
  elements.careButton.disabled = true;
  state = shareSnack(state);
  savePetState(window.localStorage, state);

  if (syncClient.isAuthenticated) {
    syncClient.enqueueSnack();
    setSyncState("pending", `${syncClient.pendingCount} waiting`);
  }

  render();
  await Promise.all([characterPlayer.celebrate(), synchronize()]);
  elements.careButton.disabled = false;
  elements.careButton.focus({ preventScroll: true });
}

function handleReset() {
  if (syncClient.isAuthenticated) {
    setDialogMessage(
      elements.accountMessage,
      "Sign out before resetting this browser’s local progress.",
    );
    elements.syncDialog.showModal();
    return;
  }

  clearPetState(window.localStorage);
  state = createPetState();
  savePetState(window.localStorage, state);
  render();
  openNameDialog();
}

function openNameDialog() {
  elements.nameInput.value = state.name;
  setDialogMessage(elements.nameMessage);
  if (!elements.nameDialog.open) {
    elements.nameDialog.showModal();
    elements.nameInput.select();
  }
}

async function handleRename(name) {
  try {
    state = renamePet(state, name);
  } catch (error) {
    setDialogMessage(elements.nameMessage, error.message);
    elements.nameInput.focus();
    return;
  }

  savePetState(window.localStorage, state);
  if (syncClient.isAuthenticated) {
    syncClient.enqueueRename(state.name);
    setSyncState("pending", `${syncClient.pendingCount} waiting`);
  }
  render();
  elements.nameDialog.close();
  await synchronize();
}

function setAuthBusy(busy) {
  elements.signInButton.disabled = busy;
  elements.createAccountButton.disabled = busy;
  elements.syncUsername.disabled = busy;
  elements.syncPassword.disabled = busy;
}

async function authenticate(mode) {
  if (!elements.syncForm.reportValidity()) return;
  setAuthBusy(true);
  setDialogMessage(elements.syncMessage, mode === "register" ? "Creating profile…" : "Signing in…", "success");

  try {
    const credentials = {
      username: elements.syncUsername.value,
      password: elements.syncPassword.value,
    };
    const result =
      mode === "register"
        ? await syncClient.register({ ...credentials, initialState: state })
        : await syncClient.login(credentials);

    adoptRemoteState(result.petState);
    elements.syncPassword.value = "";
    setSyncState("synced", "Synced");
    setDialogMessage(elements.accountMessage, `${state.name} is connected to this profile.`, "success");
    renderSync();
    await synchronize();
    await refreshNotifications();
  } catch (error) {
    setDialogMessage(elements.syncMessage, error.message);
  } finally {
    setAuthBusy(false);
  }
}

async function handleSignOut() {
  await disableNotifications({ silent: true });
  syncClient.logout();
  setSyncState("local", "Local only");
  setDialogMessage(elements.syncMessage, "Signed out. Local progress remains on this device.", "success");
  setDialogMessage(elements.accountMessage);
  renderSync();
}

elements.careButton.addEventListener("click", handleCare);
elements.resetButton.addEventListener("click", handleReset);
elements.petNameButton.addEventListener("click", openNameDialog);
elements.nameClose.addEventListener("click", () => elements.nameDialog.close());
elements.nameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handleRename(elements.nameInput.value);
});
elements.keepNameButton.addEventListener("click", () => handleRename("Kern"));
elements.syncButton.addEventListener("click", () => {
  renderSync();
  elements.syncDialog.showModal();
  refreshNotifications();
});
elements.syncClose.addEventListener("click", () => elements.syncDialog.close());
elements.syncForm.addEventListener("submit", (event) => {
  event.preventDefault();
  authenticate("login");
});
elements.createAccountButton.addEventListener("click", () => authenticate("register"));
elements.syncNowButton.addEventListener("click", synchronize);
elements.signOutButton.addEventListener("click", handleSignOut);
elements.notificationToggle.addEventListener("click", () => {
  if (deviceSubscribed) disableNotifications();
  else enableNotifications();
});
elements.notificationTest.addEventListener("click", sendTestNotification);
elements.notificationThreshold.addEventListener("change", saveNotificationPreferences);
elements.notificationCooldown.addEventListener("change", saveNotificationPreferences);

render();
renderSync();
savePetState(window.localStorage, state);

characterPlayer
  .start()
  .then(() => {
    elements.careButton.disabled = false;
    if (!syncClient.isAuthenticated && !state.named) openNameDialog();
  })
  .catch(() => {
    elements.moodMessage.textContent = `${state.name}’s artwork could not be loaded. Refresh to try again.`;
    elements.careButton.disabled = true;
  });

if (syncClient.isAuthenticated) {
  synchronize().then(() => {
    if (!state.named) openNameDialog();
    refreshNotifications();
  });
}

window.setInterval(() => {
  state = advancePetState(state);
  savePetState(window.localStorage, state);
  render();
}, 60_000);

window.addEventListener("online", () => synchronize());

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register("./sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => {
        // The app still works online when service worker registration is unavailable.
      });
  });
}
