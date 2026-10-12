import { fileURLToPath } from "node:url";
import path from "node:path";

import { createKernServer } from "../server/server.mjs";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(appRoot, "../..");
const atlasSource = path.join(
  repositoryRoot,
  "Great White Shark/work/final/spritesheet-extended.png",
);
const port = Number.parseInt(process.env.PORT || "4173", 10);
const host = process.env.HOST || "127.0.0.1";
const dataFile = process.env.KERN_DATA_FILE
  ? path.resolve(process.env.KERN_DATA_FILE)
  : path.join(appRoot, ".data/kern-sync.json");

const server = createKernServer({ appRoot, atlasSource, dataFile });
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Set PORT to another value and retry.`);
    process.exitCode = 1;
    return;
  }
  throw error;
});
server.listen(port, host, () => {
  console.log(`Kern is ready at http://${host}:${port}`);
  console.log(`Sync data: ${dataFile}`);
});
