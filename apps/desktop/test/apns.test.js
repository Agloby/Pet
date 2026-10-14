import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";

import { ApnsNotificationService, normalizeNativeDevice } from "../server/apns.mjs";

const token = "a".repeat(64);

function service(environment = "sandbox") {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  return new ApnsNotificationService({
    keyId: "KEY1234567",
    teamId: "TEAM123456",
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
    bundleId: "com.agloby.kern",
    environment,
    now: () => new Date("2026-10-14T18:00:00.000Z"),
  });
}

test("native device tokens are normalized and constrained", () => {
  const device = normalizeNativeDevice({ token: token.toUpperCase(), environment: "sandbox" });
  assert.equal(device.token, token);
  assert.equal(device.environment, "sandbox");
  assert.match(device.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(normalizeNativeDevice({ token: "not-a-token", environment: "sandbox" }), null);
  assert.equal(normalizeNativeDevice({ token, environment: "preview" }), null);
});

test("APNs provider tokens are signed, cached, and scoped by environment", async () => {
  const sender = service();
  const first = sender.providerToken();
  assert.equal(first.split(".").length, 3);
  assert.equal(sender.providerToken(), first);

  const attempts = [];
  sender.send = async (device) => {
    attempts.push(device.token);
    return device.token === token
      ? { delivered: true, expired: false }
      : { delivered: false, expired: true };
  };
  const expiredToken = "b".repeat(64);
  const result = await sender.deliver([
    { token, environment: "sandbox" },
    { token: expiredToken, environment: "sandbox" },
    { token: "c".repeat(64), environment: "production" },
  ], { title: "Kern", body: "Hello", tag: "test", url: "/" });
  assert.deepEqual(attempts, [token, expiredToken]);
  assert.deepEqual(result, { delivered: 1, expired: [expiredToken] });
});
