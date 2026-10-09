import assert from "node:assert/strict";
import test from "node:test";

import { createPetState, shareSnack } from "../src/pet-state.js";
import {
  clearPetState,
  loadPetState,
  PET_STORAGE_KEY,
  savePetState,
} from "../src/storage.js";

function memoryStorage(initial = new Map()) {
  return {
    getItem(key) {
      return initial.has(key) ? initial.get(key) : null;
    },
    setItem(key, value) {
      initial.set(key, value);
    },
    removeItem(key) {
      initial.delete(key);
    },
  };
}

const now = new Date("2026-10-09T08:00:00.000Z");

test("saved progress survives a storage round trip", () => {
  const storage = memoryStorage();
  const caredFor = shareSnack(createPetState(now), now);

  savePetState(storage, caredFor);
  const restored = loadPetState(storage, now);

  assert.deepEqual(restored, caredFor);
});

test("corrupt storage falls back to a fresh state", () => {
  const storage = memoryStorage(new Map([[PET_STORAGE_KEY, "{broken"]]));
  const restored = loadPetState(storage, now);

  assert.equal(restored.careCount, 0);
  assert.equal(restored.lastUpdatedAt, now.toISOString());
});

test("clearing progress removes the stored pet", () => {
  const backing = new Map();
  const storage = memoryStorage(backing);
  savePetState(storage, createPetState(now));

  clearPetState(storage);

  assert.equal(backing.has(PET_STORAGE_KEY), false);
});
