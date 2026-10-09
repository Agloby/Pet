import {
  advancePetState,
  bondLabel,
  createPetState,
  moodFor,
  shareSnack,
} from "./pet-state.js";
import { clearPetState, loadPetState, savePetState } from "./storage.js";
import { SpritePlayer } from "./sprite-player.js";

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
};

let state = advancePetState(loadPetState(window.localStorage));
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
    return;
  }

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

async function handleCare() {
  elements.careButton.disabled = true;
  state = shareSnack(state);
  savePetState(window.localStorage, state);
  render();
  await spritePlayer.celebrate();
  elements.careButton.disabled = false;
  elements.careButton.focus({ preventScroll: true });
}

function handleReset() {
  clearPetState(window.localStorage);
  state = createPetState();
  savePetState(window.localStorage, state);
  render();
}

elements.careButton.addEventListener("click", handleCare);
elements.resetButton.addEventListener("click", handleReset);

render();
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

window.setInterval(() => {
  state = advancePetState(state);
  savePetState(window.localStorage, state);
  render();
}, 60_000);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // The app still works online when service worker registration is unavailable.
    });
  });
}
