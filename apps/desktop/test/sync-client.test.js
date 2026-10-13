import assert from "node:assert/strict";
import test from "node:test";

import { createPetState } from "../src/pet-state.js";
import {
  loadPendingActions,
  loadSyncSession,
  saveSyncSession,
} from "../src/storage.js";
import { SyncClient } from "../src/sync-client.js";

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

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const now = new Date("2026-10-12T09:00:00.000Z");
const session = { token: "signed-token", accountId: "account-1", username: "ReefKeeper" };

test("queued care actions flush once and are removed after acknowledgement", async () => {
  const storage = memoryStorage();
  saveSyncSession(storage, session);
  const requests = [];
  const client = new SyncClient({
    storage,
    fetchFn: async (url, options) => {
      requests.push({ url, options });
      return jsonResponse({ petState: { ...createPetState(now), careCount: 1 }, revision: 2 });
    },
  });

  client.enqueueSnack(now);
  assert.equal(client.pendingCount, 1);
  const result = await client.flush();

  assert.equal(result.status, "synced");
  assert.equal(client.pendingCount, 0);
  assert.equal(loadPendingActions(storage).length, 0);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "./api/pet/actions");
  assert.equal(requests[0].options.headers.Authorization, "Bearer signed-token");
});

test("offline delivery leaves the action queued for a later retry", async () => {
  const storage = memoryStorage();
  saveSyncSession(storage, session);
  const client = new SyncClient({
    storage,
    fetchFn: async () => {
      throw new Error("offline");
    },
  });
  client.enqueueSnack(now);

  await assert.rejects(client.flush(), (error) => error.code === "offline");
  assert.equal(client.pendingCount, 1);
  assert.equal(loadPendingActions(storage).length, 1);
});

test("a queued rename includes the chosen name and clears after sync", async () => {
  const storage = memoryStorage();
  saveSyncSession(storage, session);
  let deliveredBody;
  const client = new SyncClient({
    storage,
    fetchFn: async (_url, options) => {
      deliveredBody = JSON.parse(options.body);
      return jsonResponse({
        petState: { ...createPetState(now), name: "Mako Blue", named: true },
        revision: 2,
      });
    },
  });

  client.enqueueRename("Mako Blue", now);
  assert.equal(loadPendingActions(storage)[0].name, "Mako Blue");
  await client.flush();

  assert.equal(deliveredBody.type, "rename_pet");
  assert.equal(deliveredBody.name, "Mako Blue");
  assert.equal(client.pendingCount, 0);
});

test("an unauthorized response clears the expired session", async () => {
  const storage = memoryStorage();
  saveSyncSession(storage, session);
  const client = new SyncClient({
    storage,
    fetchFn: async () => jsonResponse({ error: "Sign in again." }, 401),
  });

  await assert.rejects(client.pull(), (error) => error.code === "unauthorized");
  assert.equal(client.isAuthenticated, false);
  assert.equal(loadSyncSession(storage), null);
});

test("registration adopts the returned sync session and state", async () => {
  const storage = memoryStorage();
  const state = createPetState(now);
  const client = new SyncClient({
    storage,
    fetchFn: async () =>
      jsonResponse(
        {
          account: { id: "account-2", username: "Navigator" },
          token: "new-token",
          petState: state,
          revision: 1,
        },
        201,
      ),
  });

  const result = await client.register({
    username: "Navigator",
    password: "long-password",
    initialState: state,
  });

  assert.equal(result.revision, 1);
  assert.equal(client.session.accountId, "account-2");
  assert.equal(loadSyncSession(storage).token, "new-token");
});
