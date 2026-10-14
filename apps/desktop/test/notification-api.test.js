import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createKernServer } from "../server/server.mjs";
import { createPetState } from "../src/pet-state.js";

async function request(baseUrl, route, { method = "GET", body, token } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, payload: await response.json() };
}

test("authenticated profiles can manage and test a browser notification subscription", async (context) => {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "kern-notification-api-test-"));
  const notificationService = {
    publicKey: "test-public-key",
    async sendTest(account) {
      return { delivered: account.pushSubscriptions.length, expired: [] };
    },
  };
  const server = createKernServer({
    appRoot: path.resolve("."),
    atlasSource: path.resolve("../../Great White Shark/work/final/spritesheet-extended.png"),
    dataFile: path.join(temporaryRoot, "store.json"),
    notificationService,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => {
    server.close();
    rmSync(temporaryRoot, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const registration = await request(baseUrl, "/api/auth/register", {
    method: "POST",
    body: {
      username: "AlertKeeper",
      password: "ocean-current-42",
      initialState: createPetState(new Date("2026-10-14T10:00:00.000Z")),
    },
  });
  const token = registration.payload.token;
  const subscription = {
    endpoint: "https://push.example.test/subscriptions/device-1",
    keys: {
      p256dh: "A1234567890_abcdefghijklmnopqrstuvwxyz-ABCDE",
      auth: "B1234567890_auth-token",
    },
  };

  const created = await request(baseUrl, "/api/notifications/subscriptions", {
    method: "POST",
    token,
    body: { subscription, preferences: { fullnessThreshold: 45, cooldownHours: 8 } },
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.preferences.enabled, true);
  assert.equal(created.payload.preferences.fullnessThreshold, 45);
  assert.equal(created.payload.subscriptionCount, 1);
  assert.equal(created.payload.publicKey, "test-public-key");

  const invalidPreferences = await request(baseUrl, "/api/notifications/preferences", {
    method: "PUT",
    token,
    body: { fullnessThreshold: 99 },
  });
  assert.equal(invalidPreferences.response.status, 400);

  const testAlert = await request(baseUrl, "/api/notifications/test", {
    method: "POST",
    token,
    body: {},
  });
  assert.equal(testAlert.response.status, 200);
  assert.equal(testAlert.payload.delivered, 1);

  const removed = await request(baseUrl, "/api/notifications/subscriptions", {
    method: "DELETE",
    token,
    body: { endpoint: subscription.endpoint },
  });
  assert.equal(removed.response.status, 200);
  assert.equal(removed.payload.subscriptionCount, 0);
  assert.equal(removed.payload.preferences.enabled, false);
});
