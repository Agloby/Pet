import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { loadRuntimeConfig } from "../server/config.mjs";

test("development configuration remains local and dependency-light", () => {
  const config = loadRuntimeConfig({});
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 4173);
  assert.equal(config.production, false);
  assert.equal(config.requireHttps, false);
  assert.equal(config.databaseUrl, null);
  assert.equal(config.staticRoot, config.appRoot);
  assert.throws(() => loadRuntimeConfig({ PORT: "4173abc" }), /PORT must be an integer/);
});

test("production configuration requires durable storage and a signing secret", () => {
  assert.throws(
    () => loadRuntimeConfig({ NODE_ENV: "production" }),
    /DATABASE_URL is required/,
  );
  assert.throws(
    () => loadRuntimeConfig({ NODE_ENV: "production", DATABASE_URL: "postgres://db/kern" }),
    /KERN_SYNC_SECRET must contain at least 32 characters/,
  );

  assert.throws(
    () => loadRuntimeConfig({ DATABASE_URL: "postgres://db/kern" }),
    /when PostgreSQL is enabled/,
  );

  const config = loadRuntimeConfig({
    NODE_ENV: "production",
    DATABASE_URL: "postgres://db/kern",
    KERN_SYNC_SECRET: "a".repeat(48),
    RENDER_EXTERNAL_URL: "https://kern.example.test/path",
  });
  assert.equal(config.host, "0.0.0.0");
  assert.equal(config.publicOrigin, "https://kern.example.test");
  assert.equal(config.requireHttps, true);
  assert.equal(config.trustProxy, true);
  assert.equal(config.staticRoot, path.join(config.appRoot, "dist"));
});

test("production public origins reject insecure remote URLs", () => {
  assert.throws(
    () =>
      loadRuntimeConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://db/kern",
        KERN_SYNC_SECRET: "a".repeat(48),
        KERN_PUBLIC_ORIGIN: "http://kern.example.test",
      }),
    /must use HTTPS/,
  );
});
