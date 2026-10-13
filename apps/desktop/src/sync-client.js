import {
  clearSyncSession,
  loadPendingActions,
  loadSyncSession,
  savePendingActions,
  saveSyncSession,
} from "./storage.js";

export class SyncError extends Error {
  constructor(message, { code = "sync_error", status = 0 } = {}) {
    super(message);
    this.name = "SyncError";
    this.code = code;
    this.status = status;
  }
}

async function responseBody(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export class SyncClient {
  constructor({
    storage,
    fetchFn = (...arguments_) => globalThis.fetch(...arguments_),
    apiRoot = "./api",
  }) {
    this.storage = storage;
    this.fetchFn = fetchFn;
    this.apiRoot = apiRoot.replace(/\/$/, "");
    this.session = loadSyncSession(storage);
  }

  get isAuthenticated() {
    return Boolean(this.session);
  }

  get pendingCount() {
    if (!this.session) return 0;
    return loadPendingActions(this.storage).filter(
      (action) => action.accountId === this.session.accountId,
    ).length;
  }

  async request(path, { method = "GET", body, authenticated = false } = {}) {
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (authenticated && this.session) headers.Authorization = `Bearer ${this.session.token}`;

    let response;
    try {
      response = await this.fetchFn(`${this.apiRoot}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new SyncError("The sync service is unreachable.", { code: "offline" });
    }

    const payload = await responseBody(response);
    if (!response.ok) {
      if (response.status === 401 && authenticated) {
        clearSyncSession(this.storage);
        this.session = null;
      }
      throw new SyncError(payload.error || "The sync request failed.", {
        code: response.status === 401 ? "unauthorized" : "request_failed",
        status: response.status,
      });
    }
    return payload;
  }

  adoptSession(payload) {
    this.session = saveSyncSession(this.storage, {
      token: payload.token,
      accountId: payload.account.id,
      username: payload.account.username,
    });
    return payload;
  }

  async register({ username, password, initialState }) {
    const payload = await this.request("/auth/register", {
      method: "POST",
      body: { username, password, initialState },
    });
    return this.adoptSession(payload);
  }

  async login({ username, password }) {
    const payload = await this.request("/auth/login", {
      method: "POST",
      body: { username, password },
    });
    return this.adoptSession(payload);
  }

  logout() {
    clearSyncSession(this.storage);
    this.session = null;
  }

  enqueueSnack(now = new Date()) {
    if (!this.session) return null;
    const action = {
      id: globalThis.crypto?.randomUUID?.() || `${now.getTime()}-${Math.random()}`,
      accountId: this.session.accountId,
      type: "share_snack",
      occurredAt: now.toISOString(),
    };
    const actions = [...loadPendingActions(this.storage), action];
    savePendingActions(this.storage, actions);
    return action;
  }

  enqueueRename(name, now = new Date()) {
    if (!this.session) return null;
    const action = {
      id: globalThis.crypto?.randomUUID?.() || `${now.getTime()}-${Math.random()}`,
      accountId: this.session.accountId,
      type: "rename_pet",
      name,
      occurredAt: now.toISOString(),
    };
    const actions = [...loadPendingActions(this.storage), action];
    savePendingActions(this.storage, actions);
    return action;
  }

  async pull() {
    if (!this.session) return { status: "local" };
    const payload = await this.request("/pet", { authenticated: true });
    return { status: "synced", ...payload };
  }

  async flush() {
    if (!this.session) return { status: "local", pending: 0 };

    let actions = loadPendingActions(this.storage);
    const accountActions = actions.filter(
      (action) => action.accountId === this.session.accountId,
    );
    let latestPayload = null;

    for (const action of accountActions) {
      latestPayload = await this.request("/pet/actions", {
        method: "POST",
        authenticated: true,
        body: {
          actionId: action.id,
          type: action.type,
          occurredAt: action.occurredAt,
          ...(action.type === "rename_pet" ? { name: action.name } : {}),
        },
      });
      actions = actions.filter((candidate) => candidate.id !== action.id);
      savePendingActions(this.storage, actions);
    }

    if (!latestPayload) {
      latestPayload = await this.request("/pet", { authenticated: true });
    }

    return {
      status: "synced",
      pending: this.pendingCount,
      ...latestPayload,
    };
  }
}
