import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createKernServer } from "../server/server.mjs";
import { createPetState } from "../src/pet-state.js";

const timestamp = new Date("2026-10-15T09:00:00.000Z");

async function jsonRequest(baseUrl, route, { method = "GET", body, token } = {}) {
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

test("Garmin pairs once, syncs care, deduplicates actions, and can be revoked", async (context) => {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "kern-garmin-test-"));
  const dataFile = path.join(temporaryRoot, "store.json");
  const server = createKernServer({
    appRoot: path.resolve("."),
    atlasSource: path.resolve("../../Great White Shark/work/final/spritesheet-extended.png"),
    dataFile,
    now: () => new Date(timestamp),
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => {
    server.close();
    rmSync(temporaryRoot, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const registration = await jsonRequest(baseUrl, "/api/auth/register", {
    method: "POST",
    body: {
      username: "GarminKeeper",
      password: "ocean-current-42",
      initialState: createPetState(timestamp),
    },
  });
  assert.equal(registration.response.status, 201);

  const pairing = await jsonRequest(baseUrl, "/api/garmin/pairing-codes", {
    method: "POST",
    token: registration.payload.token,
    body: {},
  });
  assert.equal(pairing.response.status, 201);
  assert.match(pairing.payload.code, /^kp1\./);

  const paired = await jsonRequest(baseUrl, "/api/garmin/pair", {
    method: "POST",
    body: {
      code: pairing.payload.code,
      clientId: "fenix7-client-01",
      name: "Fenix 7",
    },
  });
  assert.equal(paired.response.status, 201);
  assert.match(paired.payload.token, /^kg1\./);
  assert.equal(paired.payload.petState.name, "Kern");
  assert.doesNotMatch(readFileSync(dataFile, "utf8"), new RegExp(paired.payload.token));

  const reused = await jsonRequest(baseUrl, "/api/garmin/pair", {
    method: "POST",
    body: {
      code: pairing.payload.code,
      clientId: "fenix7-client-02",
      name: "Other watch",
    },
  });
  assert.equal(reused.response.status, 401);

  const watchState = await jsonRequest(baseUrl, "/api/garmin/pet", {
    token: paired.payload.token,
  });
  assert.equal(watchState.response.status, 200);
  assert.equal(watchState.payload.petState.careCount, 0);

  const actionId = "garmin-action-0001";
  const snack = await jsonRequest(baseUrl, "/api/garmin/actions", {
    method: "POST",
    token: paired.payload.token,
    body: { actionId, type: "share_snack" },
  });
  assert.equal(snack.response.status, 200);
  assert.equal(snack.payload.duplicate, false);
  assert.equal(snack.payload.petState.careCount, 1);

  const duplicate = await jsonRequest(baseUrl, "/api/garmin/actions", {
    method: "POST",
    token: paired.payload.token,
    body: { actionId, type: "share_snack" },
  });
  assert.equal(duplicate.payload.duplicate, true);
  assert.equal(duplicate.payload.petState.careCount, 1);

  const devices = await jsonRequest(baseUrl, "/api/garmin/devices", {
    token: registration.payload.token,
  });
  assert.equal(devices.response.status, 200);
  assert.equal(devices.payload.devices[0].name, "Fenix 7");
  assert.equal("tokenHash" in devices.payload.devices[0], false);

  const revoked = await jsonRequest(baseUrl, "/api/garmin/devices", {
    method: "DELETE",
    token: registration.payload.token,
    body: { id: devices.payload.devices[0].id },
  });
  assert.equal(revoked.response.status, 200);
  assert.equal(revoked.payload.devices.length, 0);

  const rejected = await jsonRequest(baseUrl, "/api/garmin/pet", {
    token: paired.payload.token,
  });
  assert.equal(rejected.response.status, 401);
});
