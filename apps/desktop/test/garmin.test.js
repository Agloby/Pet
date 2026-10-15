import assert from "node:assert/strict";
import test from "node:test";

import {
  garminPairingMatches,
  garminTokenIdentity,
  issueGarminDeviceToken,
  issueGarminPairing,
  normalizeGarminAccount,
  publicGarminState,
  verifyGarminDeviceToken,
  verifyGarminPairing,
} from "../server/garmin.mjs";

const now = new Date("2026-10-15T09:00:00.000Z");
const secret = "garmin-test-secret-with-enough-entropy";

test("Garmin pairing codes are signed, expiring, and one-time account matches", () => {
  const account = normalizeGarminAccount({
    id: "account-1",
    username: "ReefKeeper",
    garminPairing: null,
    garminDevices: [],
  });
  const issued = issueGarminPairing(account, secret, now);
  account.garminPairing = issued.pairing;

  const claims = verifyGarminPairing(issued.code, secret, now);
  assert.equal(claims.sub, account.id);
  assert.equal(garminPairingMatches(account, claims, now), true);
  assert.equal(
    verifyGarminPairing(`${issued.code.slice(0, -1)}x`, secret, now),
    null,
  );
  assert.equal(
    verifyGarminPairing(issued.code, secret, new Date("2026-10-15T09:10:00.000Z")),
    null,
  );

  account.garminPairing = null;
  assert.equal(garminPairingMatches(account, claims, now), false);
});

test("Garmin device tokens are stored as hashes and omitted from public state", () => {
  const account = normalizeGarminAccount({
    id: "account-1",
    username: "ReefKeeper",
    garminPairing: null,
    garminDevices: [],
  });
  const issued = issueGarminDeviceToken(account.id);
  account.garminDevices.push({
    id: issued.deviceRecordId,
    clientId: "watch-client-0001",
    name: "Reef watch",
    tokenHash: issued.tokenHash,
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
  });

  assert.equal(garminTokenIdentity(issued.token).accountId, account.id);
  assert.equal(verifyGarminDeviceToken(issued.token, account).device.name, "Reef watch");
  assert.equal(verifyGarminDeviceToken(`${issued.token}x`, account), null);
  const state = publicGarminState(account);
  assert.equal(state.devices.length, 1);
  assert.equal(state.devices[0].clientId, "watch-client-0001");
  assert.equal("tokenHash" in state.devices[0], false);
  assert.doesNotMatch(JSON.stringify(state), new RegExp(issued.tokenHash));
});
