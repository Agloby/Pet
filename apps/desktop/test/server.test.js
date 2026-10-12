import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createKernServer } from "../server/server.mjs";
import { createPetState, shareSnack } from "../src/pet-state.js";

const timestamp = new Date("2026-10-12T09:00:00.000Z");

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

test("authenticated sync API persists state and deduplicates care actions", async (context) => {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "kern-sync-test-"));
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

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const initialState = shareSnack(createPetState(timestamp), timestamp);

  const registration = await jsonRequest(baseUrl, "/api/auth/register", {
    method: "POST",
    body: {
      username: "ReefKeeper",
      password: "ocean-current-42",
      initialState,
    },
  });
  assert.equal(registration.response.status, 201);
  assert.equal(registration.payload.account.username, "ReefKeeper");
  assert.equal(registration.payload.petState.careCount, 1);
  assert.equal(registration.payload.revision, 1);
  assert.equal(typeof registration.payload.token, "string");
  assert.doesNotMatch(readFileSync(dataFile, "utf8"), /ocean-current-42/);

  const duplicateAccount = await jsonRequest(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { username: "reefkeeper", password: "another-password", initialState },
  });
  assert.equal(duplicateAccount.response.status, 409);

  const unauthorized = await jsonRequest(baseUrl, "/api/pet");
  assert.equal(unauthorized.response.status, 401);

  const invalidLogin = await jsonRequest(baseUrl, "/api/auth/login", {
    method: "POST",
    body: { username: "ReefKeeper", password: "incorrect-password" },
  });
  assert.equal(invalidLogin.response.status, 401);

  const login = await jsonRequest(baseUrl, "/api/auth/login", {
    method: "POST",
    body: { username: "ReefKeeper", password: "ocean-current-42" },
  });
  assert.equal(login.response.status, 200);
  assert.equal(login.payload.petState.careCount, 1);

  const actionId = "action-00000001";
  const firstAction = await jsonRequest(baseUrl, "/api/pet/actions", {
    method: "POST",
    token: login.payload.token,
    body: { actionId, type: "share_snack", occurredAt: timestamp.toISOString() },
  });
  assert.equal(firstAction.response.status, 200);
  assert.equal(firstAction.payload.duplicate, false);
  assert.equal(firstAction.payload.petState.careCount, 2);
  assert.equal(firstAction.payload.revision, 2);

  const duplicateAction = await jsonRequest(baseUrl, "/api/pet/actions", {
    method: "POST",
    token: login.payload.token,
    body: { actionId, type: "share_snack", occurredAt: timestamp.toISOString() },
  });
  assert.equal(duplicateAction.response.status, 200);
  assert.equal(duplicateAction.payload.duplicate, true);
  assert.equal(duplicateAction.payload.petState.careCount, 2);
  assert.equal(duplicateAction.payload.revision, 2);

  const secondDevice = await jsonRequest(baseUrl, "/api/auth/login", {
    method: "POST",
    body: { username: "reefkeeper", password: "ocean-current-42" },
  });
  assert.equal(secondDevice.payload.petState.careCount, 2);
  assert.equal(secondDevice.payload.revision, 2);
});
