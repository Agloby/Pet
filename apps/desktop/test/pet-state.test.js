import assert from "node:assert/strict";
import test from "node:test";

import {
  advancePetState,
  bondLabel,
  createPetState,
  moodFor,
  normalizePetName,
  normalizePetState,
  renamePet,
  shareSnack,
} from "../src/pet-state.js";

const start = new Date("2026-10-09T08:00:00.000Z");

test("a new Kern starts with a stable local state", () => {
  const state = createPetState(start);
  assert.equal(state.fullness, 62);
  assert.equal(state.happiness, 74);
  assert.equal(state.careCount, 0);
  assert.equal(state.lastUpdatedAt, start.toISOString());
  assert.deepEqual(state.journal, []);
});

test("elapsed time reduces needs deterministically", () => {
  const state = createPetState(start);
  const fourHoursLater = new Date("2026-10-09T12:00:00.000Z");
  const advanced = advancePetState(state, fourHoursLater);

  assert.equal(advanced.fullness, 54);
  assert.equal(advanced.happiness, 71);
  assert.equal(advanced.lastUpdatedAt, fourHoursLater.toISOString());
});

test("sharing a snack completes a care loop and records it", () => {
  const caredFor = shareSnack(createPetState(start), start);

  assert.equal(caredFor.fullness, 86);
  assert.equal(caredFor.happiness, 83);
  assert.equal(caredFor.bond, 1);
  assert.equal(caredFor.careCount, 1);
  assert.equal(caredFor.journal.length, 1);
  assert.match(caredFor.journal[0].message, /first snack/i);
  assert.equal(caredFor.lastFedAt, start.toISOString());
  assert.equal(bondLabel(caredFor.bond), "First connection");
});

test("a companion can be named and restored without changing care progress", () => {
  const original = shareSnack(createPetState(start), start);
  const named = renamePet(original, "  Mako   Blue  ", start);
  const restored = normalizePetState(named, start);

  assert.equal(named.name, "Mako Blue");
  assert.equal(named.named, true);
  assert.equal(named.careCount, original.careCount);
  assert.match(named.journal[0].message, /Mako Blue has a name/);
  assert.equal(restored.name, "Mako Blue");
  assert.equal(restored.named, true);
  assert.equal(normalizePetName("\u0000hidden"), null);
  assert.equal(normalizePetName("x".repeat(25)), null);
});

test("care values are capped and journal history remains bounded", () => {
  let state = {
    ...createPetState(start),
    fullness: 99,
    happiness: 98,
  };

  for (let index = 0; index < 8; index += 1) {
    state = shareSnack(state, new Date(start.getTime() + index * 1_000));
  }

  assert.equal(state.fullness, 100);
  assert.equal(state.happiness, 100);
  assert.equal(state.careCount, 8);
  assert.equal(state.journal.length, 5);
});

test("invalid stored values are normalized safely", () => {
  const state = normalizePetState(
    {
      fullness: 500,
      happiness: -10,
      bond: -2,
      careCount: "3.9",
      lastUpdatedAt: "invalid",
      journal: [{ message: "Restored", at: "invalid" }, null],
    },
    start,
  );

  assert.equal(state.fullness, 100);
  assert.equal(state.happiness, 0);
  assert.equal(state.bond, 0);
  assert.equal(state.careCount, 3);
  assert.equal(state.lastUpdatedAt, start.toISOString());
  assert.equal(state.journal.length, 1);
});

test("mood communicates the next useful interaction", () => {
  const newPetMood = moodFor(createPetState(start));
  const hungryMood = moodFor({ ...createPetState(start), fullness: 20 });
  const thrivingMood = moodFor({
    ...createPetState(start),
    fullness: 95,
    happiness: 95,
    careCount: 2,
  });

  assert.match(newPetMood.message, /introduce yourself/i);
  assert.equal(hungryMood.label, "getting hungry");
  assert.equal(thrivingMood.label, "making waves");
});
