import assert from "node:assert/strict";
import test from "node:test";

import { newDb } from "pg-mem";

import { PostgresAccountStore } from "../server/postgres-store.mjs";
import { createPetState, shareSnack } from "../src/pet-state.js";

test("PostgreSQL store creates, retrieves, and atomically mutates accounts", async (context) => {
  const database = newDb();
  const adapter = database.adapters.createPg();
  const pool = new adapter.Pool();
  const store = new PostgresAccountStore({
    pool,
    tokenSecret: "production-test-secret-with-enough-entropy",
  });
  context.after(() => store.close());
  await store.initialize();

  const now = new Date("2026-10-14T10:00:00.000Z");
  const account = await store.createAccount({
    usernameKey: "reefkeeper",
    displayName: "ReefKeeper",
    passwordRecord: { salt: "salt", hash: "hash" },
    petState: createPetState(now),
    now,
  });
  assert.equal(account.username, "ReefKeeper");
  assert.equal(account.revision, 1);
  assert.equal(await store.createAccount({
    usernameKey: "reefkeeper",
    displayName: "Duplicate",
    passwordRecord: { salt: "salt", hash: "hash" },
    petState: createPetState(now),
    now,
  }), null);

  const mutation = await store.mutateAccount(account.id, now, (current) => {
    current.petState = shareSnack(current.petState, now);
    current.revision += 1;
    current.processedActions = ["postgres-action-1"];
    current.notificationSettings = {
      ...current.notificationSettings,
      enabled: true,
      fullnessThreshold: 45,
      cooldownHours: 8,
    };
    current.pushSubscriptions = [{
      endpoint: "https://push.example.test/device-1",
      expirationTime: null,
      keys: {
        p256dh: "A1234567890_abcdefghijklmnopqrstuvwxyz-ABCDE",
        auth: "B1234567890_auth-token",
      },
    }];
    current.nativeDevices = [{
      token: "a".repeat(64),
      environment: "sandbox",
      createdAt: now.toISOString(),
    }];
    return { duplicate: false };
  });
  assert.equal(mutation.value.duplicate, false);
  assert.equal(mutation.account.petState.careCount, 1);
  assert.equal(mutation.account.revision, 2);

  const restored = await store.accountByUsername("reefkeeper");
  assert.equal(restored.id, account.id);
  assert.deepEqual(restored.processedActions, ["postgres-action-1"]);
  assert.equal(restored.notificationSettings.fullnessThreshold, 45);
  assert.equal(restored.pushSubscriptions.length, 1);
  assert.equal(restored.nativeDevices.length, 1);
  assert.equal((await store.notificationAccounts()).length, 1);
  assert.equal(await store.health(), true);
});
