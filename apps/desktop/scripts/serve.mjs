import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(appRoot, "../..");
const atlasSource = path.join(
  repositoryRoot,
  "Great White Shark/work/final/spritesheet-extended.png",
);
const port = Number.parseInt(process.env.PORT || "4173", 10);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
]);

function localPathFor(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  if (pathname === "/assets/kern-spritesheet.png") return atlasSource;

  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const candidate = path.resolve(appRoot, relativePath);
  return candidate.startsWith(`${appRoot}${path.sep}`) ? candidate : null;
}

const server = createServer(async (request, response) => {
  const filePath = localPathFor(request.url || "/");
  if (!filePath || !["GET", "HEAD"].includes(request.method || "GET")) {
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
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Kern is ready at http://127.0.0.1:${port}`);
});
