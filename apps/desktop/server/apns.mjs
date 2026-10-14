import { createPrivateKey, sign } from "node:crypto";
import http2 from "node:http2";

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

export function normalizeNativeDevice(candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  const token = typeof candidate.token === "string" ? candidate.token.toLowerCase() : "";
  if (!/^[a-f0-9]{64,200}$/.test(token)) return null;
  if (!(["sandbox", "production"].includes(candidate.environment))) return null;
  return {
    token,
    environment: candidate.environment,
    createdAt:
      typeof candidate.createdAt === "string" && Number.isFinite(Date.parse(candidate.createdAt))
        ? new Date(candidate.createdAt).toISOString()
        : new Date().toISOString(),
  };
}

export class ApnsNotificationService {
  constructor({ keyId, teamId, privateKey, bundleId, environment = "production", now = () => new Date() }) {
    if (!keyId || !teamId || !privateKey || !bundleId) {
      throw new TypeError("APNs key ID, team ID, private key, and bundle ID are required together.");
    }
    if (!["sandbox", "production"].includes(environment)) {
      throw new TypeError("APNs environment must be sandbox or production.");
    }
    this.keyId = keyId;
    this.teamId = teamId;
    this.privateKey = createPrivateKey(privateKey.replace(/\\n/g, "\n"));
    this.bundleId = bundleId;
    this.environment = environment;
    this.now = now;
    this.cachedToken = null;
  }

  providerToken() {
    const issuedAt = Math.floor(this.now().getTime() / 1_000);
    if (this.cachedToken && issuedAt - this.cachedToken.issuedAt < 50 * 60) {
      return this.cachedToken.value;
    }
    const header = encode({ alg: "ES256", kid: this.keyId });
    const claims = encode({ iss: this.teamId, iat: issuedAt });
    const unsigned = `${header}.${claims}`;
    const signature = sign("sha256", Buffer.from(unsigned), {
      key: this.privateKey,
      dsaEncoding: "ieee-p1363",
    }).toString("base64url");
    const value = `${unsigned}.${signature}`;
    this.cachedToken = { issuedAt, value };
    return value;
  }

  async send(device, payload) {
    const host = device.environment === "sandbox"
      ? "https://api.sandbox.push.apple.com"
      : "https://api.push.apple.com";
    const client = http2.connect(host);
    try {
      return await new Promise((resolve, reject) => {
        client.once("error", reject);
        const request = client.request({
          ":method": "POST",
          ":path": `/3/device/${device.token}`,
          authorization: `bearer ${this.providerToken()}`,
          "apns-topic": this.bundleId,
          "apns-push-type": "alert",
          "apns-priority": "10",
          "content-type": "application/json",
        });
        const chunks = [];
        let status = 0;
        request.on("response", (headers) => {
          status = Number(headers[":status"] || 0);
        });
        request.on("data", (chunk) => chunks.push(chunk));
        request.on("error", reject);
        request.on("end", () => {
          let reason = null;
          try {
            reason = JSON.parse(Buffer.concat(chunks).toString("utf8")).reason || null;
          } catch {
            // Successful APNs responses have no body.
          }
          resolve({
            delivered: status === 200,
            expired: status === 410 || ["BadDeviceToken", "DeviceTokenNotForTopic", "Unregistered"].includes(reason),
            reason,
            status,
          });
        });
        request.end(JSON.stringify({
          aps: {
            alert: { title: payload.title, body: payload.body },
            sound: "default",
            "thread-id": payload.tag,
          },
          url: payload.url,
        }));
      });
    } finally {
      client.close();
    }
  }

  async deliver(devices, payload) {
    const expired = [];
    let delivered = 0;
    for (const device of devices.filter((item) => item.environment === this.environment)) {
      try {
        const result = await this.send(device, payload);
        if (result.delivered) delivered += 1;
        if (result.expired) expired.push(device.token);
      } catch {
        // A transient APNs connection failure must not stop reminders for other accounts.
      }
    }
    return { delivered, expired };
  }
}
