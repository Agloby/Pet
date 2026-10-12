import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const TOKEN_LIFETIME_SECONDS = 60 * 60 * 24 * 30;

const encode = (value) => Buffer.from(value).toString("base64url");
const decode = (value) => Buffer.from(value, "base64url").toString("utf8");

function signatureFor(encodedPayload, secret) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function normalizeUsername(value) {
  if (typeof value !== "string") return null;
  const displayName = value.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}$/.test(displayName)) return null;
  return { key: displayName.toLowerCase(), displayName };
}

export function validatePassword(value) {
  return typeof value === "string" && value.length >= 8 && value.length <= 128;
}

export function createPasswordRecord(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return {
    salt: salt.toString("base64"),
    hash: hash.toString("base64"),
  };
}

export function verifyPassword(password, record) {
  try {
    const salt = Buffer.from(record.salt, "base64");
    const expected = Buffer.from(record.hash, "base64");
    const actual = scryptSync(password, salt, expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function issueToken(account, secret, now = new Date()) {
  const issuedAt = Math.floor(now.getTime() / 1_000);
  const payload = encode(
    JSON.stringify({
      sub: account.id,
      username: account.username,
      iat: issuedAt,
      exp: issuedAt + TOKEN_LIFETIME_SECONDS,
    }),
  );
  return `${payload}.${signatureFor(payload, secret)}`;
}

export function verifyToken(token, secret, now = new Date()) {
  if (typeof token !== "string") return null;
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return null;

  const expectedSignature = signatureFor(payload, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const claims = JSON.parse(decode(payload));
    const nowSeconds = Math.floor(now.getTime() / 1_000);
    if (
      typeof claims.sub !== "string" ||
      typeof claims.username !== "string" ||
      typeof claims.exp !== "number" ||
      claims.exp <= nowSeconds
    ) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

export function tokenFromRequest(request) {
  const authorization = request.headers.authorization;
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length).trim();
}
