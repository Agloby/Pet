import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

const PAIRING_LIFETIME_MS = 10 * 60 * 1_000;
const MAX_GARMIN_DEVICES = 5;

const encode = (value) => Buffer.from(value).toString("base64url");
const decode = (value) => Buffer.from(value, "base64url").toString("utf8");
const digest = (value) => createHash("sha256").update(value).digest("base64url");
const signature = (value, secret) =>
  createHmac("sha256", secret).update(`kern-garmin-v1:${value}`).digest("base64url");

const safeEqual = (left, right) => {
  const first = Buffer.from(left || "");
  const second = Buffer.from(right || "");
  return first.length === second.length && timingSafeEqual(first, second);
};

const timestamp = (value) => {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
};

export function normalizeGarminDevice(candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  if (typeof candidate.id !== "string" || !/^[a-zA-Z0-9._-]{8,80}$/.test(candidate.id)) {
    return null;
  }
  if (typeof candidate.tokenHash !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(candidate.tokenHash)) {
    return null;
  }
  if (
    typeof candidate.clientId !== "string" ||
    !/^[a-zA-Z0-9._-]{8,80}$/.test(candidate.clientId)
  ) return null;
  const name = typeof candidate.name === "string"
    ? candidate.name.replace(/\s+/gu, " ").trim().slice(0, 40)
    : "Garmin watch";
  const createdAt = timestamp(candidate.createdAt) || new Date().toISOString();
  return {
    id: candidate.id,
    clientId: candidate.clientId,
    name: name || "Garmin watch",
    tokenHash: candidate.tokenHash,
    createdAt,
    lastSeenAt: timestamp(candidate.lastSeenAt) || createdAt,
  };
}

export function normalizeGarminAccount(account) {
  account.garminDevices = Array.isArray(account.garminDevices)
    ? account.garminDevices.map(normalizeGarminDevice).filter(Boolean).slice(-MAX_GARMIN_DEVICES)
    : [];
  const pairing = account.garminPairing;
  account.garminPairing =
    pairing &&
    typeof pairing.nonceHash === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(pairing.nonceHash) &&
    timestamp(pairing.expiresAt)
      ? { nonceHash: pairing.nonceHash, expiresAt: timestamp(pairing.expiresAt) }
      : null;
  return account;
}

export function issueGarminPairing(account, secret, now = new Date()) {
  const nonce = randomBytes(18).toString("base64url");
  const expiresAt = new Date(now.getTime() + PAIRING_LIFETIME_MS);
  const payload = encode(JSON.stringify({
    sub: account.id,
    username: account.username,
    nonce,
    exp: Math.floor(expiresAt.getTime() / 1_000),
  }));
  return {
    code: `kp1.${payload}.${signature(payload, secret)}`,
    expiresAt: expiresAt.toISOString(),
    pairing: { nonceHash: digest(nonce), expiresAt: expiresAt.toISOString() },
  };
}

export function verifyGarminPairing(code, secret, now = new Date()) {
  if (typeof code !== "string" || code.length > 512) return null;
  const [prefix, payload, suppliedSignature, extra] = code.trim().split(".");
  if (prefix !== "kp1" || !payload || !suppliedSignature || extra) return null;
  if (!safeEqual(suppliedSignature, signature(payload, secret))) return null;
  try {
    const claims = JSON.parse(decode(payload));
    if (
      typeof claims.sub !== "string" ||
      typeof claims.username !== "string" ||
      typeof claims.nonce !== "string" ||
      typeof claims.exp !== "number" ||
      claims.exp <= Math.floor(now.getTime() / 1_000)
    ) return null;
    return claims;
  } catch {
    return null;
  }
}

export function issueGarminDeviceToken(accountId) {
  const deviceRecordId = randomUUID();
  const secret = randomBytes(32).toString("base64url");
  const token = `kg1.${encode(accountId)}.${encode(deviceRecordId)}.${secret}`;
  return { deviceRecordId, token, tokenHash: digest(token) };
}

export function garminTokenIdentity(token) {
  if (typeof token !== "string" || token.length > 512) return null;
  const [prefix, encodedAccountId, encodedDeviceId, secret, extra] = token.split(".");
  if (prefix !== "kg1" || !encodedAccountId || !encodedDeviceId || !secret || extra) return null;
  try {
    const accountId = decode(encodedAccountId);
    const deviceRecordId = decode(encodedDeviceId);
    if (!accountId || !deviceRecordId || secret.length < 32) return null;
    return { accountId, deviceRecordId, tokenHash: digest(token) };
  } catch {
    return null;
  }
}

export function verifyGarminDeviceToken(token, account) {
  const identity = garminTokenIdentity(token);
  if (!identity || identity.accountId !== account?.id) return null;
  normalizeGarminAccount(account);
  const device = account.garminDevices.find((candidate) =>
    candidate.id === identity.deviceRecordId && safeEqual(candidate.tokenHash, identity.tokenHash));
  return device ? { identity, device } : null;
}

export function publicGarminState(account) {
  normalizeGarminAccount(account);
  return {
    devices: account.garminDevices.map(({ tokenHash: _tokenHash, ...device }) => device),
    pairingExpiresAt: account.garminPairing?.expiresAt || null,
  };
}

export function garminPairingMatches(account, claims, now = new Date()) {
  normalizeGarminAccount(account);
  return Boolean(
    claims &&
    claims.sub === account.id &&
    claims.username === account.username &&
    account.garminPairing &&
    Date.parse(account.garminPairing.expiresAt) > now.getTime() &&
    safeEqual(account.garminPairing.nonceHash, digest(claims.nonce)),
  );
}
