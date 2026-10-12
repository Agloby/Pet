import {
  advancePetState,
  bondLabel,
  createPetState,
  moodFor,
  shareSnack,
} from "./pet-state.js";
import { clearPetState, loadPetState, savePetState } from "./storage.js";
import { SpritePlayer } from "./sprite-player.js";
import { SyncClient } from "./sync-client.js";

const elements = {
  moodLabel: document.querySelector("#mood-label"),
  moodMessage: document.querySelector("#mood-message"),
  fullnessValue: document.querySelector("#fullness-value"),
  fullnessMeter: document.querySelector("#fullness-meter"),
  happinessValue: document.querySelector("#happiness-value"),
  happinessMeter: document.querySelector("#happiness-meter"),
  bondValue: document.querySelector("#bond-value"),
  careCount: document.querySelector("#care-count"),
  journalList: document.querySelector("#journal-list"),
  careButton: document.querySelector("#care-button"),
  resetButton: document.querySelector("#reset-button"),
  canvas: document.querySelector("#kern-canvas"),
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
  accountSyncState: document.querySelector("#account-sync-state"),
  accountMessage: document.querySelector("#account-message"),
  syncNowButton: document.querySelector("#sync-now-button"),
  signOutButton: document.querySelector("#sign-out-button"),
};

let state = advancePetState(loadPetState(window.localStorage));
let syncState = { kind: "local", label: "Local only" };
let syncInFlight = null;
const syncClient = new SyncClient({ storage: window.localStorage });
const spritePlayer = new SpritePlayer(elements.canvas, "./assets/kern-spritesheet.png");

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
}

function render() {
  const mood = moodFor(state);
  const fullness = Math.round(state.fullness);
  const happiness = Math.round(state.happiness);

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
    empty.textContent = "Your first shared moment with Kern will appear here.";
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
      setDialogMessage(elements.accountMessage, "Kern is up to date.", "success");
      return result;
    } catch (error) {
      if (error.code === "offline") {
        const pending = syncClient.pendingCount;
        setSyncState(pending ? "pending" : "offline", pending ? `${pending} waiting` : "Offline");
        setDialogMessage(
          elements.accountMessage,
          pending
            ? `${pending} care action${pending === 1 ? " is" : "s are"} waiting for a connection.`
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
  await Promise.all([spritePlayer.celebrate(), synchronize()]);
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
    setDialogMessage(elements.accountMessage, "Kern is connected to this profile.", "success");
    renderSync();
    await synchronize();
  } catch (error) {
    setDialogMessage(elements.syncMessage, error.message);
  } finally {
    setAuthBusy(false);
  }
}

function handleSignOut() {
  syncClient.logout();
  setSyncState("local", "Local only");
  setDialogMessage(elements.syncMessage, "Signed out. Local progress remains on this device.", "success");
  setDialogMessage(elements.accountMessage);
  renderSync();
}

elements.careButton.addEventListener("click", handleCare);
elements.resetButton.addEventListener("click", handleReset);
elements.syncButton.addEventListener("click", () => {
  renderSync();
  elements.syncDialog.showModal();
});
elements.syncClose.addEventListener("click", () => elements.syncDialog.close());
elements.syncForm.addEventListener("submit", (event) => {
  event.preventDefault();
  authenticate("login");
});
elements.createAccountButton.addEventListener("click", () => authenticate("register"));
elements.syncNowButton.addEventListener("click", synchronize);
elements.signOutButton.addEventListener("click", handleSignOut);

render();
renderSync();
savePetState(window.localStorage, state);

spritePlayer
  .start()
  .then(() => {
    elements.careButton.disabled = false;
  })
  .catch(() => {
    elements.moodMessage.textContent = "Kern’s atlas could not be loaded. Refresh to try again.";
    elements.careButton.disabled = true;
  });

if (syncClient.isAuthenticated) synchronize();

window.setInterval(() => {
  state = advancePetState(state);
  savePetState(window.localStorage, state);
  render();
}, 60_000);

window.addEventListener("online", () => synchronize());

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // The app still works online when service worker registration is unavailable.
    });
  });
}
