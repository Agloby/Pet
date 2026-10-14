import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { FixedWindowRateLimiter } from "../server/rate-limit.mjs";
import { createKernServer } from "../server/server.mjs";

function testLimiters() {
  return {
    register: new FixedWindowRateLimiter({ limit: 1, windowMs: 60_000 }),
    login: new FixedWindowRateLimiter({ limit: 1, windowMs: 60_000 }),
    actions: new FixedWindowRateLimiter({ limit: 1, windowMs: 60_000 }),
  };
}

async function startServer(context, options = {}) {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "kern-production-test-"));
  const server = createKernServer({
    appRoot: path.resolve("."),
    atlasSource: path.resolve("../../Great White Shark/work/final/spritesheet-extended.png"),
    dataFile: path.join(temporaryRoot, "store.json"),
    rateLimiters: testLimiters(),
    ...options,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => {
    server.close();
    rmSync(temporaryRoot, { recursive: true, force: true });
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test("health checks include storage readiness and browser security headers", async (context) => {
  const baseUrl = await startServer(context, { trustProxy: true });
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: { "X-Forwarded-Proto": "https" },
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(payload, { ok: true, service: "kern-sync", storage: "json", version: 6 });
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(typeof response.headers.get("x-request-id"), "string");
});

test("health checks fail closed when durable storage is unavailable", async (context) => {
  const baseUrl = await startServer(context, {
    store: {
      kind: "postgres",
      tokenSecret: "test-secret",
      health: async () => {
        throw new Error("database unavailable");
      },
    },
  });
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, service: "kern-sync" });
});

test("production transport redirects pages and rejects insecure API requests", async (context) => {
  const baseUrl = await startServer(context, {
    publicOrigin: "https://kern.example.test",
    requireHttps: true,
    trustProxy: true,
  });
  const page = await fetch(`${baseUrl}/reef?name=kern`, { redirect: "manual" });
  assert.equal(page.status, 308);
  assert.equal(page.headers.get("location"), "https://kern.example.test/reef?name=kern");

  const api = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Kern", password: "password-1" }),
  });
  assert.equal(api.status, 426);
});

test("state-changing requests enforce origin checks and rate limits", async (context) => {
  const baseUrl = await startServer(context);
  const rejectedOrigin = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://hostile.example",
    },
    body: JSON.stringify({ username: "ReefKeeper", password: "ocean-current-42" }),
  });
  assert.equal(rejectedOrigin.status, 403);

  const attempt = () => fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "missing-user", password: "incorrect-password" }),
  });
  assert.equal((await attempt()).status, 401);
  const limited = await attempt();
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("ratelimit-remaining"), "0");
  assert.equal(limited.headers.get("retry-after"), "60");
});
