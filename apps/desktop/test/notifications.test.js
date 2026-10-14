import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  CareNotificationService,
  careReminderFor,
  deriveVapidKeys,
  normalizeNotificationSettings,
  normalizePushSubscription,
} from "../server/notifications.mjs";
import { JsonAccountStore } from "../server/store.mjs";
import { createPetState } from "../src/pet-state.js";

const subscription = {
  endpoint: "https://push.example.test/subscriptions/device-1",
  expirationTime: null,
  keys: {
    p256dh: "A1234567890_abcdefghijklmnopqrstuvwxyz-ABCDE",
    auth: "B1234567890_auth-token",
  },
};

test("notification settings and subscriptions are normalized safely", () => {
  assert.deepEqual(normalizeNotificationSettings({
    enabled: true,
    fullnessThreshold: 45,
    cooldownHours: 8,
  }), {
    enabled: true,
    fullnessThreshold: 45,
    cooldownHours: 8,
    lastAttemptAt: null,
    lastSentAt: null,
  });
  assert.equal(normalizeNotificationSettings({ fullnessThreshold: 99 }).fullnessThreshold, 35);
  assert.deepEqual(normalizePushSubscription(subscription), subscription);
  assert.equal(normalizePushSubscription({ ...subscription, endpoint: "http://push.example.test" }), null);
});

test("VAPID keys are deterministic and domain-separated from the server secret", () => {
  const secret = "stable-test-secret-with-more-than-thirty-two-characters";
  const first = deriveVapidKeys(secret);
  const second = deriveVapidKeys(secret);
  assert.deepEqual(first, second);
  assert.equal(first.privateKey.length, 43);
  assert.equal(first.publicKey.length, 87);
  assert.notEqual(first.privateKey, secret);
});

test("care reminders respect fullness and cooldown settings", () => {
  const now = new Date("2026-10-14T18:00:00.000Z");
  const account = {
    petState: { ...createPetState(now), name: "Ripple", fullness: 20 },
    notificationSettings: { enabled: true, fullnessThreshold: 35, cooldownHours: 12 },
    pushSubscriptions: [subscription],
  };
  assert.match(careReminderFor(account, now).payload.title, /Ripple/);
  account.notificationSettings.lastAttemptAt = "2026-10-14T12:00:00.000Z";
  assert.equal(careReminderFor(account, now), null);
  account.notificationSettings.lastAttemptAt = "2026-10-14T05:00:00.000Z";
  account.petState.fullness = 80;
  assert.equal(careReminderFor(account, now), null);
});

test("the reminder sweep claims and delivers a due alert once", async (context) => {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "kern-notifications-test-"));
  context.after(() => rmSync(temporaryRoot, { recursive: true, force: true }));
  const store = new JsonAccountStore(path.join(temporaryRoot, "store.json"));
  const now = new Date("2026-10-14T18:00:00.000Z");
  const account = await store.createAccount({
    usernameKey: "reefkeeper",
    displayName: "ReefKeeper",
    passwordRecord: { salt: "salt", hash: "hash" },
    petState: { ...createPetState(now), name: "Ripple", fullness: 20 },
    now,
  });
  await store.mutateAccount(account.id, now, (current) => {
    current.notificationSettings = { enabled: true, fullnessThreshold: 35, cooldownHours: 12 };
    current.pushSubscriptions = [subscription];
  });

  const deliveries = [];
  const sender = {
    setVapidDetails(subject, publicKey, privateKey) {
      assert.match(subject, /^mailto:/);
      assert.equal(typeof publicKey, "string");
      assert.equal(typeof privateKey, "string");
    },
    async sendNotification(target, payload) {
      deliveries.push({ target, payload: JSON.parse(payload) });
    },
  };
  const service = new CareNotificationService({
    store,
    tokenSecret: store.tokenSecret,
    sender,
    now: () => now,
  });
  await service.sweep();
  await service.sweep();

  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].payload.tag, "kern-care-reminder");
  const restored = await store.accountById(account.id);
  assert.equal(restored.notificationSettings.lastSentAt, now.toISOString());
});
