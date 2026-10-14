import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

import {
  createPasswordRecord,
  issueToken,
  normalizeUsername,
  tokenFromRequest,
  validatePassword,
  verifyPassword,
  verifyToken,
} from "./auth.mjs";
import { FixedWindowRateLimiter } from "./rate-limit.mjs";
import { JsonAccountStore } from "./store.mjs";
import {
  normalizeAccountNotifications,
  normalizeNotificationSettings,
  normalizePushSubscription,
} from "./notifications.mjs";
import {
  advancePetState,
  normalizePetName,
  normalizePetState,
  renamePet,
  shareSnack,
} from "../src/pet-state.js";

const MAX_BODY_BYTES = 64 * 1_024;
const MAX_PROCESSED_ACTIONS = 100;

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
]);

const silentLogger = { info() {}, error() {} };

function sendJson(response, statusCode, body) {
  const serialized = JSON.stringify(body);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(serialized),
    "Cache-Control": "no-store",
  });
  response.end(serialized);
}

function securityHeaders(response, secureTransport) {
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'",
  );
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=()");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  if (secureTransport) {
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Request body is too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body must be valid JSON");
    error.statusCode = 400;
    throw error;
  }
}

function publicAccount(account) {
  return {
    id: account.id,
    username: account.username,
  };
}

function publicNotificationState(account, notificationService) {
  normalizeAccountNotifications(account);
  const { lastAttemptAt: _lastAttemptAt, ...preferences } = account.notificationSettings;
  return {
    available: Boolean(notificationService),
    publicKey: notificationService?.publicKey || null,
    preferences,
    subscriptionCount: account.pushSubscriptions.length,
  };
}

function validNotificationPreferences(candidate, { allowEnabled = true } = {}) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
  if (candidate.enabled !== undefined && (!allowEnabled || typeof candidate.enabled !== "boolean")) {
    return false;
  }
  if (
    candidate.fullnessThreshold !== undefined &&
    (!Number.isInteger(candidate.fullnessThreshold) ||
      candidate.fullnessThreshold < 15 ||
      candidate.fullnessThreshold > 60)
  ) return false;
  if (
    candidate.cooldownHours !== undefined &&
    (!Number.isInteger(candidate.cooldownHours) ||
      candidate.cooldownHours < 4 ||
      candidate.cooldownHours > 48)
  ) return false;
  return true;
}

function requestIsSecure(request, trustProxy) {
  if (request.socket.encrypted) return true;
  if (!trustProxy) return false;
  const forwarded = request.headers["x-forwarded-proto"];
  return typeof forwarded === "string" && forwarded.split(",")[0].trim() === "https";
}

function clientAddress(request, trustProxy) {
  if (trustProxy) {
    const forwarded = request.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
      return forwarded.split(",")[0].trim().slice(0, 80);
    }
  }
  return request.socket.remoteAddress || "unknown";
}

function requestOriginAllowed(request, context, secureTransport) {
  const origin = request.headers.origin;
  if (!origin) return true;
  const expected =
    context.publicOrigin ||
    `${secureTransport ? "https" : "http"}://${request.headers.host || "localhost"}`;
  return origin === expected;
}

function applyRateLimit(response, limiter, key, timestamp) {
  const result = limiter.consume(key, timestamp.getTime());
  response.setHeader("RateLimit-Limit", String(result.limit));
  response.setHeader("RateLimit-Remaining", String(result.remaining));
  if (result.allowed) return true;
  response.setHeader("Retry-After", String(result.retryAfterSeconds));
  sendJson(response, 429, { error: "Too many requests. Wait a moment and try again." });
  return false;
}

async function authAccount(request, store, now) {
  const token = tokenFromRequest(request);
  const claims = verifyToken(token, store.tokenSecret, now);
  if (!claims) return null;
  const account = await store.accountById(claims.sub);
  return account?.username === claims.username ? account : null;
}

async function handleApi(request, response, url, context) {
  const { store, now } = context;
  const timestamp = now();
  const address = clientAddress(request, context.trustProxy);

  if (request.method === "GET" && url.pathname === "/api/health") {
    try {
      await store.health();
      sendJson(response, 200, {
        ok: true,
        service: "kern-sync",
        storage: store.kind,
        version: 5,
      });
    } catch {
      sendJson(response, 503, { ok: false, service: "kern-sync" });
    }
    return true;
  }

  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    const secureTransport = requestIsSecure(request, context.trustProxy);
    if (!requestOriginAllowed(request, context, secureTransport)) {
      sendJson(response, 403, { error: "This request origin is not allowed." });
      return true;
    }
  }

  if (request.method === "POST" && url.pathname === "/api/auth/register") {
    if (!applyRateLimit(response, context.rateLimiters.register, address, timestamp)) return true;
    const body = await readJson(request);
    const username = normalizeUsername(body.username);
    if (!username || !validatePassword(body.password)) {
      sendJson(response, 400, {
        error: "Use a 3–32 character username and a password of at least 8 characters.",
      });
      return true;
    }
    if (await store.accountByUsername(username.key)) {
      sendJson(response, 409, { error: "That username is already registered." });
      return true;
    }

    const petState = normalizePetState(body.initialState, timestamp);
    petState.lastUpdatedAt = timestamp.toISOString();
    const account = await store.createAccount({
      usernameKey: username.key,
      displayName: username.displayName,
      passwordRecord: createPasswordRecord(body.password),
      petState,
      now: timestamp,
    });
    if (!account) {
      sendJson(response, 409, { error: "That username is already registered." });
      return true;
    }
    const token = issueToken(account, store.tokenSecret, timestamp);
    sendJson(response, 201, {
      account: publicAccount(account),
      token,
      petState: account.petState,
      revision: account.revision,
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    if (!applyRateLimit(response, context.rateLimiters.login, address, timestamp)) return true;
    const body = await readJson(request);
    const username = normalizeUsername(body.username);
    let account = username ? await store.accountByUsername(username.key) : null;
    if (!account || !validatePassword(body.password) || !verifyPassword(body.password, account.password)) {
      sendJson(response, 401, { error: "The username or password is incorrect." });
      return true;
    }

    const loginMutation = await store.mutateAccount(account.id, timestamp, (current) => {
      current.petState = advancePetState(current.petState, timestamp);
    });
    account = loginMutation.account;
    sendJson(response, 200, {
      account: publicAccount(account),
      token: issueToken(account, store.tokenSecret, timestamp),
      petState: account.petState,
      revision: account.revision,
    });
    return true;
  }

  if (url.pathname.startsWith("/api/")) {
    const account = await authAccount(request, store, timestamp);
    if (!account) {
      sendJson(response, 401, { error: "Sign in again to continue syncing." });
      return true;
    }

    if (request.method === "GET" && url.pathname === "/api/pet") {
      const petMutation = await store.mutateAccount(account.id, timestamp, (current) => {
        current.petState = advancePetState(current.petState, timestamp);
      });
      const savedAccount = petMutation.account;
      sendJson(response, 200, {
        account: publicAccount(savedAccount),
        petState: savedAccount.petState,
        revision: savedAccount.revision,
      });
      return true;
    }


    if (request.method === "GET" && url.pathname === "/api/notifications") {
      sendJson(response, 200, publicNotificationState(account, context.notificationService));
      return true;
    }

    if (request.method === "PUT" && url.pathname === "/api/notifications/preferences") {
      if (
        !applyRateLimit(
          response,
          context.rateLimiters.actions,
          `${account.id}:${address}`,
          timestamp,
        )
      ) return true;
      const body = await readJson(request);
      if (!validNotificationPreferences(body)) {
        sendJson(response, 400, { error: "The notification preferences are invalid." });
        return true;
      }
      const mutation = await store.mutateAccount(account.id, timestamp, (current) => {
        normalizeAccountNotifications(current);
        current.notificationSettings = normalizeNotificationSettings({
          ...current.notificationSettings,
          ...body,
        });
      });
      sendJson(response, 200, publicNotificationState(mutation.account, context.notificationService));
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/notifications/subscriptions") {
      if (!context.notificationService) {
        sendJson(response, 503, { error: "Care notifications are not available." });
        return true;
      }
      if (
        !applyRateLimit(
          response,
          context.rateLimiters.actions,
          `${account.id}:${address}`,
          timestamp,
        )
      ) return true;
      const body = await readJson(request);
      const subscription = normalizePushSubscription(body.subscription);
      if (!subscription || !validNotificationPreferences(body.preferences || {}, { allowEnabled: false })) {
        sendJson(response, 400, { error: "The push subscription or preferences are invalid." });
        return true;
      }
      const mutation = await store.mutateAccount(account.id, timestamp, (current) => {
        normalizeAccountNotifications(current);
        current.pushSubscriptions = [
          ...current.pushSubscriptions.filter((item) => item.endpoint !== subscription.endpoint),
          subscription,
        ].slice(-10);
        current.notificationSettings = normalizeNotificationSettings({
          ...current.notificationSettings,
          ...body.preferences,
          enabled: true,
        });
      });
      sendJson(response, 201, publicNotificationState(mutation.account, context.notificationService));
      return true;
    }

    if (request.method === "DELETE" && url.pathname === "/api/notifications/subscriptions") {
      if (
        !applyRateLimit(
          response,
          context.rateLimiters.actions,
          `${account.id}:${address}`,
          timestamp,
        )
      ) return true;
      const body = await readJson(request);
      if (typeof body.endpoint !== "string" || body.endpoint.length > 2_048) {
        sendJson(response, 400, { error: "The push subscription endpoint is invalid." });
        return true;
      }
      const mutation = await store.mutateAccount(account.id, timestamp, (current) => {
        normalizeAccountNotifications(current);
        current.pushSubscriptions = current.pushSubscriptions.filter(
          (subscription) => subscription.endpoint !== body.endpoint,
        );
        if (current.pushSubscriptions.length === 0) current.notificationSettings.enabled = false;
      });
      sendJson(response, 200, publicNotificationState(mutation.account, context.notificationService));
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/notifications/test") {
      if (!context.notificationService) {
        sendJson(response, 503, { error: "Care notifications are not available." });
        return true;
      }
      if (
        !applyRateLimit(
          response,
          context.rateLimiters.actions,
          `${account.id}:${address}`,
          timestamp,
        )
      ) return true;
      const result = await context.notificationService.sendTest(account);
      const mutation = await store.mutateAccount(account.id, timestamp, (current) => {
        normalizeAccountNotifications(current);
        current.pushSubscriptions = current.pushSubscriptions.filter(
          (subscription) => !result.expired.includes(subscription.endpoint),
        );
        if (current.pushSubscriptions.length === 0) current.notificationSettings.enabled = false;
      });
      sendJson(response, result.delivered > 0 ? 200 : 502, {
        ...publicNotificationState(mutation.account, context.notificationService),
        delivered: result.delivered,
        error: result.delivered > 0 ? undefined : "No active browser could receive the test alert.",
      });
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/pet/actions") {
      if (
        !applyRateLimit(
          response,
          context.rateLimiters.actions,
          `${account.id}:${address}`,
          timestamp,
        )
      ) {
        return true;
      }
      const body = await readJson(request);
      const validActionType = ["share_snack", "rename_pet"].includes(body.type);
      const validRename = body.type !== "rename_pet" || normalizePetName(body.name);
      if (
        typeof body.actionId !== "string" ||
        body.actionId.length < 8 ||
        body.actionId.length > 100 ||
        !validActionType ||
        !validRename
      ) {
        sendJson(response, 400, { error: "The pet action is invalid." });
        return true;
      }

      const mutation = await store.mutateAccount(account.id, timestamp, (current) => {
        const duplicate = current.processedActions.includes(body.actionId);
        if (!duplicate) {
          current.petState =
            body.type === "rename_pet"
              ? renamePet(current.petState, body.name, timestamp)
              : shareSnack(current.petState, timestamp);
          current.revision += 1;
          current.processedActions = [body.actionId, ...current.processedActions].slice(
            0,
            MAX_PROCESSED_ACTIONS,
          );
        }
        return { duplicate };
      });

      if (!mutation) {
        sendJson(response, 401, { error: "Sign in again to continue syncing." });
        return true;
      }
      sendJson(response, 200, {
        petState: mutation.account.petState,
        revision: mutation.account.revision,
        duplicate: mutation.value.duplicate,
      });
      return true;
    }

    sendJson(response, 404, { error: "API route not found." });
    return true;
  }

  return false;
}

function localPathFor(pathname, appRoot, atlasSource) {
  if (pathname === "/assets/kern-spritesheet.png") return atlasSource;
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const candidate = path.resolve(appRoot, relativePath);
  return candidate.startsWith(`${appRoot}${path.sep}`) ? candidate : null;
}

async function serveStatic(request, response, url, context) {
  if (!["GET", "HEAD"].includes(request.method || "GET")) {
    response.writeHead(404).end("Not found");
    return;
  }

  const filePath = localPathFor(url.pathname, context.appRoot, context.atlasSource);
  if (!filePath) {
    response.writeHead(404).end("Not found");
    return;
  }

  try {
    const details = await stat(filePath);
    if (!details.isFile()) throw new Error("Not a file");
    const extension = path.extname(filePath);
    response.writeHead(200, {
      "Content-Length": details.size,
      "Content-Type": contentTypes.get(extension) || "application/octet-stream",
      "Cache-Control": extension === ".png" ? "public, max-age=86400" : "no-cache",
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
}

export function createKernServer({
  appRoot,
  atlasSource,
  dataFile,
  store = new JsonAccountStore(dataFile),
  now = () => new Date(),
  logger = silentLogger,
  publicOrigin = null,
  notificationService = null,
  requireHttps = false,
  trustProxy = false,
  rateLimiters = {
    register: new FixedWindowRateLimiter({ limit: 5, windowMs: 60 * 60 * 1_000 }),
    login: new FixedWindowRateLimiter({ limit: 10, windowMs: 15 * 60 * 1_000 }),
    actions: new FixedWindowRateLimiter({ limit: 120, windowMs: 60 * 1_000 }),
  },
}) {
  const context = {
    appRoot,
    atlasSource,
    logger,
    now,
    notificationService,
    publicOrigin,
    rateLimiters,
    requireHttps,
    store,
    trustProxy,
  };

  const server = createServer(async (request, response) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    const url = new URL(request.url || "/", "http://localhost");
    const secureTransport = requestIsSecure(request, trustProxy);
    response.setHeader("X-Request-ID", requestId);
    securityHeaders(response, secureTransport);
    response.on("finish", () => {
      logger.info({
        event: "request",
        durationMs: Date.now() - startedAt,
        method: request.method,
        path: url.pathname,
        requestId,
        status: response.statusCode,
      });
    });

    try {
      if (requireHttps && !secureTransport && url.pathname !== "/api/health") {
        if (["GET", "HEAD"].includes(request.method) && publicOrigin) {
          response.writeHead(308, { Location: `${publicOrigin}${url.pathname}${url.search}` });
          response.end();
        } else {
          sendJson(response, 426, { error: "Use HTTPS to connect to Kern." });
        }
        return;
      }

      const handled = await handleApi(request, response, url, context);
      if (!handled) await serveStatic(request, response, url, context);
    } catch (error) {
      const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
      logger.error({
        event: "request_error",
        message: error?.message || "Unknown error",
        requestId,
        status: statusCode,
      });
      if (!response.headersSent) {
        sendJson(response, statusCode, {
          error: statusCode === 500 ? "The sync service could not complete the request." : error.message,
        });
      } else {
        response.destroy();
      }
    }
  });
  server.accountStore = store;
  return server;
}
