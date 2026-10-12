import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

const STORE_VERSION = 1;

function freshStore() {
  return {
    version: STORE_VERSION,
    tokenSecret: randomBytes(32).toString("base64url"),
    accounts: {},
  };
}

function validStore(candidate) {
  return (
    candidate &&
    candidate.version === STORE_VERSION &&
    typeof candidate.tokenSecret === "string" &&
    candidate.accounts &&
    typeof candidate.accounts === "object" &&
    !Array.isArray(candidate.accounts)
  );
}

export class JsonAccountStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = this.read();
  }

  read() {
    try {
      const candidate = JSON.parse(readFileSync(this.filePath, "utf8"));
      if (validStore(candidate)) return candidate;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }

    const data = freshStore();
    this.write(data);
    return data;
  }

  write(data = this.data) {
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    renameSync(temporaryPath, this.filePath);
  }

  get tokenSecret() {
    return this.data.tokenSecret;
  }

  accountByUsername(usernameKey) {
    return this.data.accounts[usernameKey] ?? null;
  }

  accountById(accountId) {
    return Object.values(this.data.accounts).find((account) => account.id === accountId) ?? null;
  }

  createAccount({ usernameKey, displayName, passwordRecord, petState, now }) {
    if (this.accountByUsername(usernameKey)) return null;
    const account = {
      id: randomUUID(),
      username: displayName,
      usernameKey,
      password: passwordRecord,
      petState,
      revision: 1,
      processedActions: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    this.data.accounts[usernameKey] = account;
    this.write();
    return account;
  }

  saveAccount(account, now = new Date()) {
    account.updatedAt = now.toISOString();
    this.data.accounts[account.usernameKey] = account;
    this.write();
    return account;
  }
}
