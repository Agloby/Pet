import { createAccountStore } from "../server/create-store.mjs";
import { loadRuntimeConfig } from "../server/config.mjs";
import { createKernServer } from "../server/server.mjs";

const config = loadRuntimeConfig();

function writeLog(level, details) {
  const entry = { timestamp: new Date().toISOString(), level, ...details };
  if (config.logLevel === "pretty") {
    const message = details.message || details.event;
    const metadata = { ...details };
    delete metadata.message;
    delete metadata.event;
    const suffix = Object.keys(metadata).length ? ` ${JSON.stringify(metadata)}` : "";
    const method = level === "error" ? "error" : "log";
    console[method](`[kern] ${message}${suffix}`);
    return;
  }
  if (config.logLevel !== "silent") console.log(JSON.stringify(entry));
}

const logger = {
  info: (details) => writeLog("info", details),
  error: (details) => writeLog("error", details),
};

const store = await createAccountStore({
  databaseUrl: config.databaseUrl,
  dataFile: config.dataFile,
  tokenSecret: config.tokenSecret,
});
const server = createKernServer({
  appRoot: config.staticRoot,
  atlasSource: config.atlasSource,
  logger,
  publicOrigin: config.publicOrigin,
  requireHttps: config.requireHttps,
  store,
  trustProxy: config.trustProxy,
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    logger.error({ message: `Port ${config.port} is already in use. Set PORT to another value.` });
    process.exitCode = 1;
    return;
  }
  throw error;
});

server.listen(config.port, config.host, () => {
  logger.info({
    event: "server_ready",
    host: config.host,
    port: config.port,
    storage: store.kind,
    transport: config.requireHttps ? "https-proxy" : "http",
  });
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ event: "server_shutdown", signal });
  const forcedExit = setTimeout(() => {
    logger.error({ message: "Graceful shutdown timed out." });
    process.exit(1);
  }, 10_000);
  forcedExit.unref();

  await new Promise((resolve) => server.close(resolve));
  await store.close();
  clearTimeout(forcedExit);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
