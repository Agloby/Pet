import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(appRoot, "../..");
const outputRoot = path.join(appRoot, "dist");
const atlasSource = path.join(
  repositoryRoot,
  "Great White Shark/work/final/spritesheet-extended.png",
);

await rm(outputRoot, { recursive: true, force: true });
await mkdir(path.join(outputRoot, "assets"), { recursive: true });

for (const file of ["index.html", "styles.css", "manifest.webmanifest", "sw.js"]) {
  await cp(path.join(appRoot, file), path.join(outputRoot, file));
}

await cp(path.join(appRoot, "src"), path.join(outputRoot, "src"), { recursive: true });
await cp(path.join(appRoot, "assets/kern-icon.svg"), path.join(outputRoot, "assets/kern-icon.svg"));
await cp(atlasSource, path.join(outputRoot, "assets/kern-spritesheet.png"));

console.log(`Built Kern desktop prototype at ${outputRoot}`);
