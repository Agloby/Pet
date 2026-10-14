import { fileURLToPath } from "node:url";
import path from "node:path";

function parsePort(value) {
  const port = Number(value || "4173");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return port;
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === "") return fallback;
  if (["1", "true", "yes"].includes(String(value).toLowerCase())) return true;
  if (["0", "false", "no"].includes(String(value).toLowerCase())) return false;
  throw new Error(`Expected a boolean value, received ${value}.`);
}

function optionalOrigin(value) {
  if (!value) return null;
  const origin = new URL(value).origin;
  if (!origin.startsWith("https://") && !origin.startsWith("http://localhost")) {
    throw new Error("KERN_PUBLIC_ORIGIN must use HTTPS outside local development.");
  }
  return origin;
}

export function loadRuntimeConfig(environment = process.env) {
  const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const repositoryRoot = path.resolve(appRoot, "../..");
  const production = environment.NODE_ENV === "production";
  const databaseUrl = environment.DATABASE_URL?.trim() || null;
  const tokenSecret = environment.KERN_SYNC_SECRET?.trim() || null;
  const apnsFields = {
    keyId: environment.KERN_APNS_KEY_ID?.trim() || null,
    teamId: environment.KERN_APNS_TEAM_ID?.trim() || null,
    privateKey: environment.KERN_APNS_PRIVATE_KEY?.trim() || null,
    bundleId: environment.KERN_APNS_BUNDLE_ID?.trim() || null,
  };
  const configuredApnsFields = Object.values(apnsFields).filter(Boolean).length;

  if (production && !databaseUrl) {
    throw new Error("DATABASE_URL is required when NODE_ENV=production.");
  }
  if (databaseUrl && (!tokenSecret || tokenSecret.length < 32)) {
    throw new Error("KERN_SYNC_SECRET must contain at least 32 characters when PostgreSQL is enabled.");
  }
  if (configuredApnsFields > 0 && configuredApnsFields < Object.keys(apnsFields).length) {
    throw new Error(
      "KERN_APNS_KEY_ID, KERN_APNS_TEAM_ID, KERN_APNS_PRIVATE_KEY, and KERN_APNS_BUNDLE_ID are required together.",
    );
  }
  const apnsEnvironment = environment.KERN_APNS_ENVIRONMENT?.trim() || "production";
  if (!["sandbox", "production"].includes(apnsEnvironment)) {
    throw new Error("KERN_APNS_ENVIRONMENT must be sandbox or production.");
  }

  const staticRoot = environment.KERN_STATIC_ROOT
    ? path.resolve(environment.KERN_STATIC_ROOT)
    : production
      ? path.join(appRoot, "dist")
      : appRoot;
  const atlasSource = production
    ? path.join(staticRoot, "assets/kern-spritesheet.png")
    : path.join(repositoryRoot, "Great White Shark/work/final/spritesheet-extended.png");

  return {
    apns: configuredApnsFields === Object.keys(apnsFields).length
      ? { ...apnsFields, environment: apnsEnvironment }
      : null,
    appRoot,
    atlasSource,
    dataFile: environment.KERN_DATA_FILE
      ? path.resolve(environment.KERN_DATA_FILE)
      : path.join(appRoot, ".data/kern-sync.json"),
    databaseUrl,
    host: environment.HOST || (production ? "0.0.0.0" : "127.0.0.1"),
    logLevel: environment.KERN_LOG_LEVEL || (production ? "info" : "pretty"),
    port: parsePort(environment.PORT),
    production,
    publicOrigin: optionalOrigin(
      environment.KERN_PUBLIC_ORIGIN || environment.RENDER_EXTERNAL_URL,
    ),
    requireHttps: parseBoolean(environment.KERN_REQUIRE_HTTPS, production),
    staticRoot,
    tokenSecret,
    trustProxy: parseBoolean(environment.KERN_TRUST_PROXY, production),
  };
}
