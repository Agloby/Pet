import { randomUUID } from "node:crypto";

import pg from "pg";

import { normalizeAccountNotifications } from "./notifications.mjs";

const { Pool } = pg;

function accountFromRow(row) {
  if (!row) return null;
  return normalizeAccountNotifications({
    id: row.id,
    username: row.username,
    usernameKey: row.username_key,
    password: row.password,
    petState: row.pet_state,
    revision: row.revision,
    processedActions: row.processed_actions,
    notificationSettings: row.notification_settings,
    pushSubscriptions: row.push_subscriptions,
    nativeDevices: row.native_devices,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  });
}

const accountValues = (account, now) => [
  account.username,
  JSON.stringify(account.password),
  JSON.stringify(account.petState),
  account.revision,
  JSON.stringify(account.processedActions),
  JSON.stringify(account.notificationSettings),
  JSON.stringify(account.pushSubscriptions),
  JSON.stringify(account.nativeDevices),
  now,
  account.id,
];

export class PostgresAccountStore {
  constructor({ connectionString, tokenSecret, pool } = {}) {
    this.pool = pool || new Pool({
      connectionString,
      application_name: "kern-sync",
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      max: 10,
    });
    this.tokenSecret = tokenSecret;
    this.kind = "postgres";
  }

  async initialize() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS kern_accounts (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        username_key TEXT NOT NULL UNIQUE,
        password JSONB NOT NULL,
        pet_state JSONB NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        processed_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
        notification_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
        push_subscriptions JSONB NOT NULL DEFAULT '[]'::jsonb,
        native_devices JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `);
    await this.pool.query(
      "ALTER TABLE kern_accounts ADD COLUMN IF NOT EXISTS notification_settings JSONB NOT NULL DEFAULT '{}'::jsonb",
    );
    await this.pool.query(
      "ALTER TABLE kern_accounts ADD COLUMN IF NOT EXISTS push_subscriptions JSONB NOT NULL DEFAULT '[]'::jsonb",
    );
    await this.pool.query(
      "ALTER TABLE kern_accounts ADD COLUMN IF NOT EXISTS native_devices JSONB NOT NULL DEFAULT '[]'::jsonb",
    );
    await this.pool.query(
      "CREATE INDEX IF NOT EXISTS kern_accounts_updated_at_idx ON kern_accounts (updated_at)",
    );
  }

  async accountByUsername(usernameKey) {
    const result = await this.pool.query(
      "SELECT * FROM kern_accounts WHERE username_key = $1",
      [usernameKey],
    );
    return accountFromRow(result.rows[0]);
  }

  async accountById(accountId) {
    const result = await this.pool.query("SELECT * FROM kern_accounts WHERE id = $1", [accountId]);
    return accountFromRow(result.rows[0]);
  }

  async createAccount({ usernameKey, displayName, passwordRecord, petState, now }) {
    const timestamp = now.toISOString();
    const accountId = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO kern_accounts (
        id, username, username_key, password, pet_state, revision,
        processed_actions, created_at, updated_at
      ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, 1, '[]'::jsonb, $6, $6)
      ON CONFLICT (username_key) DO NOTHING
      RETURNING *`,
      [
        accountId,
        displayName,
        usernameKey,
        JSON.stringify(passwordRecord),
        JSON.stringify(petState),
        timestamp,
      ],
    );
    const account = accountFromRow(result.rows[0]);
    return account?.id === accountId ? account : null;
  }

  async saveAccount(account, now = new Date()) {
    const timestamp = now.toISOString();
    const result = await this.pool.query(
      `UPDATE kern_accounts
       SET username = $1, password = $2::jsonb, pet_state = $3::jsonb, revision = $4,
           processed_actions = $5::jsonb, notification_settings = $6::jsonb,
           push_subscriptions = $7::jsonb, native_devices = $8::jsonb, updated_at = $9
       WHERE id = $10
       RETURNING *`,
      accountValues(account, timestamp),
    );
    return accountFromRow(result.rows[0]);
  }

  async mutateAccount(accountId, now, mutator) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const selected = await client.query(
        "SELECT * FROM kern_accounts WHERE id = $1 FOR UPDATE",
        [accountId],
      );
      const account = accountFromRow(selected.rows[0]);
      if (!account) {
        await client.query("ROLLBACK");
        return null;
      }

      const value = mutator(account);
      const timestamp = now.toISOString();
      const updated = await client.query(
        `UPDATE kern_accounts
         SET username = $1, password = $2::jsonb, pet_state = $3::jsonb, revision = $4,
             processed_actions = $5::jsonb, notification_settings = $6::jsonb,
             push_subscriptions = $7::jsonb, native_devices = $8::jsonb, updated_at = $9
         WHERE id = $10
         RETURNING *`,
        accountValues(account, timestamp),
      );
      await client.query("COMMIT");
      return { account: accountFromRow(updated.rows[0]), value };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async health() {
    await this.pool.query("SELECT 1");
    return true;
  }

  async close() {
    await this.pool.end();
  }

  async notificationAccounts() {
    const result = await this.pool.query(
      `SELECT * FROM kern_accounts
       WHERE notification_settings->>'enabled' = 'true'`,
    );
    return result.rows.map(accountFromRow).filter(
      (account) => account.pushSubscriptions.length + account.nativeDevices.length > 0,
    );
  }
}
