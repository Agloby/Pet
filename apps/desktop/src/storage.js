import { createPetState, normalizePetState } from "./pet-state.js";

export const PET_STORAGE_KEY = "kern.desktop.pet-state.v1";
export const SYNC_SESSION_KEY = "kern.desktop.sync-session.v1";
export const PENDING_ACTIONS_KEY = "kern.desktop.pending-actions.v1";

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

export function loadSyncSession(storage) {
  try {
    const candidate = JSON.parse(storage.getItem(SYNC_SESSION_KEY));
    if (
      typeof candidate?.token !== "string" ||
      typeof candidate?.accountId !== "string" ||
      typeof candidate?.username !== "string"
    ) {
      return null;
    }
    return candidate;
  } catch {
    return null;
  }
}

export function saveSyncSession(storage, session) {
  storage.setItem(SYNC_SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearSyncSession(storage) {
  storage.removeItem(SYNC_SESSION_KEY);
}

export function loadPendingActions(storage) {
  try {
    const candidate = JSON.parse(storage.getItem(PENDING_ACTIONS_KEY));
    if (!Array.isArray(candidate)) return [];
    return candidate.filter(
      (action) =>
        typeof action?.id === "string" &&
        typeof action?.accountId === "string" &&
        ["share_snack", "rename_pet"].includes(action.type) &&
        (action.type !== "rename_pet" || typeof action.name === "string") &&
        typeof action?.occurredAt === "string",
    );
  } catch {
    return [];
  }
}

export function savePendingActions(storage, actions) {
  storage.setItem(PENDING_ACTIONS_KEY, JSON.stringify(actions));
  return actions;
}
