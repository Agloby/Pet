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
import { JsonAccountStore } from "./store.mjs";
import { advancePetState, normalizePetState, shareSnack } from "../src/pet-state.js";

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

function sendJson(response, statusCode, body) {
  const serialized = JSON.stringify(body);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(serialized),
    "Cache-Control": "no-store",
  });
  response.end(serialized);
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

function authAccount(request, store, now) {
  const token = tokenFromRequest(request);
  const claims = verifyToken(token, store.tokenSecret, now);
  if (!claims) return null;
  const account = store.accountById(claims.sub);
  return account?.username === claims.username ? account : null;
}

async function handleApi(request, response, url, context) {
  const { store, now } = context;
  const timestamp = now();

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true, service: "kern-sync", version: 1 });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/register") {
    const body = await readJson(request);
    const username = normalizeUsername(body.username);
    if (!username || !validatePassword(body.password)) {
      sendJson(response, 400, {
        error: "Use a 3–32 character username and a password of at least 8 characters.",
      });
      return true;
    }
    if (store.accountByUsername(username.key)) {
      sendJson(response, 409, { error: "That username is already registered." });
      return true;
    }

    const petState = normalizePetState(body.initialState, timestamp);
    petState.lastUpdatedAt = timestamp.toISOString();
    const account = store.createAccount({
      usernameKey: username.key,
      displayName: username.displayName,
      passwordRecord: createPasswordRecord(body.password),
      petState,
      now: timestamp,
    });
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
    const body = await readJson(request);
    const username = normalizeUsername(body.username);
    const account = username ? store.accountByUsername(username.key) : null;
    if (!account || !validatePassword(body.password) || !verifyPassword(body.password, account.password)) {
      sendJson(response, 401, { error: "The username or password is incorrect." });
      return true;
    }

    account.petState = advancePetState(account.petState, timestamp);
    store.saveAccount(account, timestamp);
    sendJson(response, 200, {
      account: publicAccount(account),
      token: issueToken(account, store.tokenSecret, timestamp),
      petState: account.petState,
      revision: account.revision,
    });
    return true;
  }

  if (url.pathname.startsWith("/api/")) {
    const account = authAccount(request, store, timestamp);
    if (!account) {
      sendJson(response, 401, { error: "Sign in again to continue syncing." });
      return true;
    }

    if (request.method === "GET" && url.pathname === "/api/pet") {
      account.petState = advancePetState(account.petState, timestamp);
      store.saveAccount(account, timestamp);
      sendJson(response, 200, {
        account: publicAccount(account),
        petState: account.petState,
        revision: account.revision,
      });
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/pet/actions") {
      const body = await readJson(request);
      if (
        typeof body.actionId !== "string" ||
        body.actionId.length < 8 ||
        body.actionId.length > 100 ||
        body.type !== "share_snack"
      ) {
        sendJson(response, 400, { error: "The pet action is invalid." });
        return true;
      }

      const duplicate = account.processedActions.includes(body.actionId);
      if (!duplicate) {
        account.petState = shareSnack(account.petState, timestamp);
        account.revision += 1;
        account.processedActions = [body.actionId, ...account.processedActions].slice(
          0,
          MAX_PROCESSED_ACTIONS,
        );
        store.saveAccount(account, timestamp);
      }

      sendJson(response, 200, {
        petState: account.petState,
        revision: account.revision,
        duplicate,
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
    response.writeHead(200, {
      "Content-Length": details.size,
      "Content-Type": contentTypes.get(path.extname(filePath)) || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
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
  now = () => new Date(),
}) {
  const store = new JsonAccountStore(dataFile);
  const context = { appRoot, atlasSource, store, now };
  return createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://localhost");
    try {
      const handled = await handleApi(request, response, url, context);
      if (!handled) await serveStatic(request, response, url, context);
    } catch (error) {
      const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
      sendJson(response, statusCode, {
        error: statusCode === 500 ? "The sync service could not complete the request." : error.message,
      });
    }
  });
}
