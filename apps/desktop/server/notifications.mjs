import { createECDH, createHmac } from "node:crypto";

import webPush from "web-push";

import { advancePetState } from "../src/pet-state.js";
import { normalizeNativeDevice } from "./apns.mjs";

export const DEFAULT_NOTIFICATION_SETTINGS = Object.freeze({
  enabled: false,
  fullnessThreshold: 35,
  cooldownHours: 12,
  lastAttemptAt: null,
  lastSentAt: null,
});

const isoTimestamp = (value) => {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
};

const boundedInteger = (value, fallback, minimum, maximum) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum
    ? number
    : fallback;
};

export function normalizeNotificationSettings(candidate) {
  return {
    enabled: candidate?.enabled === true,
    fullnessThreshold: boundedInteger(candidate?.fullnessThreshold, 35, 15, 60),
    cooldownHours: boundedInteger(candidate?.cooldownHours, 12, 4, 48),
    lastAttemptAt: isoTimestamp(candidate?.lastAttemptAt),
    lastSentAt: isoTimestamp(candidate?.lastSentAt),
  };
}

export function normalizePushSubscription(candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  if (typeof candidate.endpoint !== "string" || candidate.endpoint.length > 2_048) return null;

  let endpoint;
  try {
    endpoint = new URL(candidate.endpoint);
  } catch {
    return null;
  }
  if (endpoint.protocol !== "https:") return null;

  const p256dh = candidate.keys?.p256dh;
  const auth = candidate.keys?.auth;
  const safeKey = (value, maximum) =>
    typeof value === "string" && value.length >= 16 && value.length <= maximum &&
    /^[A-Za-z0-9_-]+$/.test(value);
  if (!safeKey(p256dh, 256) || !safeKey(auth, 128)) return null;

  return {
    endpoint: endpoint.href,
    expirationTime:
      candidate.expirationTime === null || candidate.expirationTime === undefined
        ? null
        : Number(candidate.expirationTime) || null,
    keys: { p256dh, auth },
  };
}

export function normalizeAccountNotifications(account) {
  account.notificationSettings = normalizeNotificationSettings(account.notificationSettings);
  account.pushSubscriptions = Array.isArray(account.pushSubscriptions)
    ? account.pushSubscriptions.map(normalizePushSubscription).filter(Boolean).slice(-10)
    : [];
  account.nativeDevices = Array.isArray(account.nativeDevices)
    ? account.nativeDevices.map(normalizeNativeDevice).filter(Boolean).slice(-10)
    : [];
  return account;
}

export function deriveVapidKeys(secret) {
  if (typeof secret !== "string" || secret.length < 16) {
    throw new TypeError("A stable server secret is required for care notifications.");
  }

  for (let counter = 0; counter < 16; counter += 1) {
    const privateKey = createHmac("sha256", secret)
      .update(`kern-care-notifications-v1:${counter}`)
      .digest();
    const curve = createECDH("prime256v1");
    try {
      curve.setPrivateKey(privateKey);
      return {
        privateKey: privateKey.toString("base64url"),
        publicKey: curve.getPublicKey(null, "uncompressed").toString("base64url"),
      };
    } catch {
      // Try another domain-separated candidate if the scalar is outside the curve order.
    }
  }
  throw new Error("Could not derive a valid notification signing key.");
}

export function careReminderFor(account, now = new Date()) {
  const settings = normalizeNotificationSettings(account.notificationSettings);
  const deliveryTargetCount =
    (Array.isArray(account.pushSubscriptions) ? account.pushSubscriptions.length : 0) +
    (Array.isArray(account.nativeDevices) ? account.nativeDevices.length : 0);
  if (!settings.enabled || deliveryTargetCount === 0) {
    return null;
  }

  const state = advancePetState(account.petState, now);
  if (state.fullness > settings.fullnessThreshold) return null;

  const lastAttempt = Date.parse(settings.lastAttemptAt || settings.lastSentAt || 0);
  const cooldownMs = settings.cooldownHours * 60 * 60 * 1_000;
  if (Number.isFinite(lastAttempt) && now.getTime() - lastAttempt < cooldownMs) return null;

  return {
    state,
    payload: {
      title: `${state.name} is getting hungry`,
      body: `A quick reef check-in will lift ${state.name}’s mood and refill their belly.`,
      tag: "kern-care-reminder",
      url: "/",
    },
  };
}

export class CareNotificationService {
  constructor({
    store,
    tokenSecret,
    publicOrigin,
    logger = { info() {}, error() {} },
    sender = webPush,
    nativeSender = null,
    now = () => new Date(),
    intervalMs = 15 * 60 * 1_000,
  }) {
    this.store = store;
    this.logger = logger;
    this.sender = sender;
    this.nativeSender = nativeSender;
    this.now = now;
    this.intervalMs = intervalMs;
    this.timer = null;
    this.running = null;
    this.keys = deriveVapidKeys(tokenSecret);
    const vapidSubject = publicOrigin?.startsWith("https://")
      ? publicOrigin
      : "mailto:kern-notifications@example.invalid";
    this.sender.setVapidDetails(
      vapidSubject,
      this.keys.publicKey,
      this.keys.privateKey,
    );
  }

  get publicKey() {
    return this.keys.publicKey;
  }

  async deliver(subscriptions, payload) {
    const expired = [];
    let delivered = 0;
    for (const subscription of subscriptions) {
      try {
        await this.sender.sendNotification(subscription, JSON.stringify(payload), {
          TTL: 60 * 60,
          urgency: "normal",
        });
        delivered += 1;
      } catch (error) {
        if ([404, 410].includes(error?.statusCode)) expired.push(subscription.endpoint);
        else {
          this.logger.error({
            event: "notification_delivery_error",
            message: error?.message || "Push delivery failed",
            status: error?.statusCode || 0,
          });
        }
      }
    }
    return { delivered, expired };
  }

  async sendTest(account) {
    const normalized = normalizeAccountNotifications(account);
    const payload = {
      title: `${normalized.petState.name} can reach you`,
      body: "Care alerts are ready. The reef will let you know when it is time to check in.",
      tag: "kern-care-test",
      url: "/",
    };
    const [web, native] = await Promise.all([
      this.deliver(normalized.pushSubscriptions, payload),
      this.nativeSender
        ? this.nativeSender.deliver(normalized.nativeDevices, payload)
        : { delivered: 0, expired: [] },
    ]);
    return {
      delivered: web.delivered + native.delivered,
      expired: web.expired,
      expiredNativeTokens: native.expired,
    };
  }

  async sweep() {
    if (this.running) return this.running;
    this.running = (async () => {
      const now = this.now();
      const accounts = await this.store.notificationAccounts();
      for (const candidate of accounts) {
        const claim = await this.store.mutateAccount(candidate.id, now, (account) => {
          normalizeAccountNotifications(account);
          const reminder = careReminderFor(account, now);
          if (!reminder) return null;
          account.petState = reminder.state;
          account.notificationSettings.lastAttemptAt = now.toISOString();
          return {
            payload: reminder.payload,
            subscriptions: [...account.pushSubscriptions],
            nativeDevices: [...account.nativeDevices],
          };
        });
        if (!claim?.value) continue;

        const [webResult, nativeResult] = await Promise.all([
          this.deliver(claim.value.subscriptions, claim.value.payload),
          this.nativeSender
            ? this.nativeSender.deliver(claim.value.nativeDevices, claim.value.payload)
            : { delivered: 0, expired: [] },
        ]);
        await this.store.mutateAccount(candidate.id, now, (account) => {
          normalizeAccountNotifications(account);
          account.pushSubscriptions = account.pushSubscriptions.filter(
            (subscription) => !webResult.expired.includes(subscription.endpoint),
          );
          account.nativeDevices = account.nativeDevices.filter(
            (device) => !nativeResult.expired.includes(device.token),
          );
          if (webResult.delivered + nativeResult.delivered > 0) {
            account.notificationSettings.lastSentAt = now.toISOString();
          }
          if (account.pushSubscriptions.length + account.nativeDevices.length === 0) {
            account.notificationSettings.enabled = false;
          }
        });
      }
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.sweep().catch((error) => {
      this.logger.error({ event: "notification_sweep_error", message: error.message });
    }), this.intervalMs);
    this.timer.unref?.();
    this.sweep().catch((error) => {
      this.logger.error({ event: "notification_sweep_error", message: error.message });
    });
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
