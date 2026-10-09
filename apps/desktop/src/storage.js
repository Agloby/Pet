import { createPetState, normalizePetState } from "./pet-state.js";

export const PET_STORAGE_KEY = "kern.desktop.pet-state.v1";

export function loadPetState(storage, now = new Date()) {
  try {
    const serialized = storage.getItem(PET_STORAGE_KEY);
    if (!serialized) return createPetState(now);
    return normalizePetState(JSON.parse(serialized), now);
  } catch {
    return createPetState(now);
  }
}

export function savePetState(storage, state) {
  storage.setItem(PET_STORAGE_KEY, JSON.stringify(state));
  return state;
}

export function clearPetState(storage) {
  storage.removeItem(PET_STORAGE_KEY);
}
